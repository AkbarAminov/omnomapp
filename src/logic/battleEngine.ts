// «ИЛИ / ИЛИ» — выбор между двумя блюдами вместо вопросов о признаках.
// Чистый модуль без I/O и React, как engine.ts: UI только показывает пары и сообщает выбор.
import { ANY_CUISINE, getCandidates, traitValue } from './engine.ts';
import type { Dish, Rng } from './engine.ts';

// Признаки, по которым блюда «ощущаются разными». И форма, и ощущения: рис против теста
// различается для человека не меньше, чем жирное против постного.
const BATTLE_TRAITS = [
  'isHeavy', 'isFatty', 'isSpicy', 'isHot', 'isSoup', 'hasMeat', 'hasChicken', 'hasSeafood',
  'hasRice', 'hasDough', 'hasNoodles', 'isDumpling', 'isWrap', 'isGrilled', 'isFried',
  'isSteamed', 'hasCheese', 'hasVeggies', 'byHand', 'isFast',
] as const;

export const BATTLE_ROUNDS = 5;        // обычных сравнений; плюс финал — всего 6 тапов
export const MIN_POOL = 4;             // меньше — играть не из чего
const RECENT_MEMORY = 4;               // сколько последних блюд считаем «только что показанными»
const BIAS_STEP = 0.34;                // насколько один выбор сдвигает предпочтение по признаку
const MIN_TRAIT_GAP = 0.25;            // различие меньше этого сигналом не считаем
const INITIAL_PAIR_TIE = 0.15;         // насколько второй кандидат может уступать лучшему
const WIN_POINTS = 1;
const LOSS_POINTS = 0.5;

export type BattleChoice = { round: number; winnerId: string; loserId: string };
export type DishStat = { wins: number; losses: number; appearances: number; score: number };

export type BattleSession = {
  readonly pool: readonly Dish[];
  readonly maxRounds: number;
  readonly round: number;                       // номер сравнения на экране, с 1
  readonly pair: readonly [Dish, Dish] | null;
  readonly isFinal: boolean;
  readonly choices: readonly BattleChoice[];
  readonly stats: Readonly<Record<string, DishStat>>;
  readonly bias: Readonly<Record<string, number>>;
  readonly seenIds: readonly string[];
  readonly winner: Dish | null;
  readonly rng: Rng;
};

// ── Вспомогательное ──────────────────────────────────────────────────────────

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n);

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// 0 — блюда неразличимы, 1 — противоположны по всем признакам.
export function traitDistance(a: Dish, b: Dish): number {
  let sum = 0;
  for (const t of BATTLE_TRAITS) sum += Math.abs(traitValue(a, t) - traitValue(b, t));
  return sum / BATTLE_TRAITS.length;
}

// Насколько блюдо совпадает с тем, что человек уже выбирал. −1…1.
export function affinity(dish: Dish, bias: Readonly<Record<string, number>>): number {
  let sum = 0;
  let weight = 0;
  for (const [tag, b] of Object.entries(bias)) {
    if (b === 0) continue;
    sum += b * (traitValue(dish, tag) - 0.5) * 2;
    weight += Math.abs(b);
  }
  return weight > 0 ? clamp(sum / weight, -1, 1) : 0;
}

function emptyStat(): DishStat {
  return { wins: 0, losses: 0, appearances: 0, score: 0 };
}

// ── Пул ──────────────────────────────────────────────────────────────────────

// Аллергены убираются существующим фильтром: второй системы ограничений здесь нет.
// Блюда с фотографией идут вперёд — механика визуальная; если их мало, добираем остальными
// (эмодзи-заглушка в карточке выглядит прилично, но выбирать «вслепую» хуже).
export function buildPool(dishes: readonly Dish[], excludeAllergens: readonly string[]): Dish[] {
  const eligible = getCandidates(dishes, 'meal', ANY_CUISINE, excludeAllergens);
  const withImage = eligible.filter((d) => d.image);
  return withImage.length >= MIN_POOL * 3 ? withImage : eligible;
}

// ── Создание сессии ──────────────────────────────────────────────────────────

export function createBattleSession(
  dishes: readonly Dish[],
  excludeAllergens: readonly string[] = [],
  rng: Rng = Math.random,
): BattleSession {
  const pool = buildPool(dishes, excludeAllergens);
  // На крошечном пуле столько раундов не отыграть — укорачиваем, а не показываем повторы.
  const maxRounds = Math.max(1, Math.min(BATTLE_ROUNDS, pool.length - 1));
  const base: BattleSession = {
    pool, maxRounds, round: 1, pair: null, isFinal: false,
    choices: [], stats: {}, bias: {}, seenIds: [], winner: null, rng,
  };
  if (pool.length < 2) return base;
  const pair = selectInitialPair(pool, rng);
  return withPair(base, pair);
}

export function canPlay(session: BattleSession): boolean {
  return session.pool.length >= 2;
}

function withPair(session: BattleSession, pair: readonly [Dish, Dish]): BattleSession {
  const stats = { ...session.stats };
  for (const d of pair) {
    const s = stats[d.id] ?? emptyStat();
    stats[d.id] = { ...s, appearances: s.appearances + 1 };
  }
  return {
    ...session,
    pair,
    stats,
    seenIds: [...session.seenIds, pair[0].id, pair[1].id],
  };
}

// Первая пара задаёт направление, поэтому блюда должны быть заметно разными и узнаваемыми:
// «Плов или Бургер» говорит о человеке больше, чем «Плов или Казан-кабоб».
export function selectInitialPair(pool: readonly Dish[], rng: Rng = Math.random): [Dish, Dish] {
  const known = pool.filter((d) => d.prominence >= 0.5);
  const from = known.length >= MIN_POOL ? known : pool;
  const first = from[Math.floor(rng() * from.length)] ?? pool[0];

  const ranked = pool
    .filter((d) => d.id !== first.id)
    .map((d) => ({
      d,
      s: traitDistance(d, first) + (d.cuisine === first.cuisine ? 0 : 0.2) + d.prominence * 0.25,
    }))
    .sort((a, b) => b.s - a.s);
  // Из почти равных лучших берём случайное, чтобы повторная игра не повторяла ту же пару.
  // Именно «почти равных», а не «первых пяти»: иначе в маленьком пуле случайность могла
  // вытащить блюдо, неотличимое от первого, и сравнение не давало бы никакой информации.
  const near = ranked.filter((x) => x.s >= (ranked[0]?.s ?? 0) - INITIAL_PAIR_TIE).slice(0, 5);
  const second = near[Math.floor(rng() * near.length)]?.d ?? pool[1] ?? first;
  return [first, second];
}

// ── Выбор пользователя ───────────────────────────────────────────────────────

export function registerChoice(session: BattleSession, winnerId: string): BattleSession {
  const pair = session.pair;
  if (!pair) return session;
  const champion = pair.find((d) => d.id === winnerId);
  const loser = pair.find((d) => d.id !== winnerId);
  if (!champion || !loser) return session;

  const stats = { ...session.stats };
  const w = stats[champion.id] ?? emptyStat();
  const l = stats[loser.id] ?? emptyStat();
  stats[champion.id] = { ...w, wins: w.wins + 1, score: (w.wins + 1) * WIN_POINTS - w.losses * LOSS_POINTS };
  stats[loser.id] = { ...l, losses: l.losses + 1, score: l.wins * WIN_POINTS - (l.losses + 1) * LOSS_POINTS };

  const next: BattleSession = {
    ...session,
    stats,
    bias: updateBias(session.bias, champion, loser),
    choices: [...session.choices, { round: session.round, winnerId: champion.id, loserId: loser.id }],
  };

  if (session.isFinal) return { ...next, winner: champion, pair: null };

  if (session.round >= session.maxRounds) {
    const finalists = selectFinalists(next, champion);
    // Финалистов меньше двух бывает только на крошечном пуле — тогда победитель уже определён.
    if (!finalists) return { ...next, winner: champion, pair: null };
    return withPair({ ...next, round: session.round + 1, isFinal: true }, finalists);
  }

  const opponent = selectNextOpponent(next, champion);
  if (!opponent) return { ...next, winner: champion, pair: null };
  return withPair({ ...next, round: session.round + 1 }, [champion, opponent]);
}

// Сигнал появляется только там, где блюда действительно различаются: выбор том-яма над пловом
// ничего не говорит о рисе, если рис есть у обоих.
function updateBias(
  bias: Readonly<Record<string, number>>,
  champion: Dish,
  loser: Dish,
): Record<string, number> {
  const next = { ...bias };
  for (const tag of BATTLE_TRAITS) {
    const diff = traitValue(champion, tag) - traitValue(loser, tag);
    if (Math.abs(diff) < MIN_TRAIT_GAP) continue;
    next[tag] = clamp((next[tag] ?? 0) + diff * BIAS_STEP, -1, 1);
  }
  return next;
}

export function calculateBattleScores(session: BattleSession): Record<string, DishStat> {
  return { ...session.stats };
}

// ── Следующий соперник ───────────────────────────────────────────────────────

export function selectNextOpponent(session: BattleSession, champion: Dish): Dish | null {
  const recent = new Set(session.seenIds.slice(-RECENT_MEMORY));
  const used = new Set(session.choices.map((c) => pairKey(c.winnerId, c.loserId)));
  const recentCuisines = session.seenIds
    .slice(-RECENT_MEMORY)
    .map((id) => session.pool.find((d) => d.id === id)?.cuisine);

  // Сначала разведка — соперник должен быть непохожим; ближе к финалу важнее совпадение
  // с тем, что человек уже выбирал.
  const progress = session.round / Math.max(1, session.maxRounds);
  const wDiff = 0.15 + 0.6 * (1 - progress);
  const wBias = 0.15 + 0.6 * progress;

  let best: Dish | null = null;
  let bestScore = -Infinity;
  for (const d of session.pool) {
    if (d.id === champion.id) continue;
    if (used.has(pairKey(champion.id, d.id))) continue;
    const sameCuisineRecently = recentCuisines.filter((c) => c === d.cuisine).length;
    const score =
      wDiff * traitDistance(d, champion)
      + wBias * (affinity(d, session.bias) + 1) / 2
      + 0.25 * d.prominence
      - (recent.has(d.id) ? 0.6 : 0)
      - (d.cuisine === champion.cuisine ? 0.2 : 0)
      - 0.1 * sameCuisineRecently
      - (session.stats[d.id]?.losses ?? 0) * 0.15
      + session.rng() * 0.08;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

// ── Финал ────────────────────────────────────────────────────────────────────

// Двое сильнейших по ходу игры. Чемпион последнего раунда участвует почти всегда, но если
// кто-то выиграл больше сравнений — в финал идёт он.
export function selectFinalists(session: BattleSession, champion: Dish): [Dish, Dish] | null {
  const seen = [...new Set(session.seenIds)]
    .map((id) => session.pool.find((d) => d.id === id))
    .filter((d): d is Dish => !!d);
  const ranked = seen.sort((a, b) => {
    const sa = session.stats[a.id] ?? emptyStat();
    const sb = session.stats[b.id] ?? emptyStat();
    return sb.score - sa.score || sb.wins - sa.wins || b.prominence - a.prominence
      || a.id.localeCompare(b.id);
  });
  const first = ranked.find((d) => d.id === champion.id) ?? ranked[0];
  if (!first) return null;
  const used = new Set(session.choices.map((c) => pairKey(c.winnerId, c.loserId)));
  const unplayed = (d: Dish) => d.id !== first.id && !used.has(pairKey(first.id, d.id));

  // 1. Сильнейший из уже игравших, с кем финалист ещё не встречался.
  const fromSeen = ranked.find(unplayed);
  if (fromSeen) return [first, fromSeen];

  // 2. Чемпион обыграл всех, кого видел. Повторять сравнение, на которое человек уже
  //    ответил, бессмысленно — выводим нового претендента, максимально похожего на то,
  //    что человек выбирал весь раунд.
  const seenIds = new Set(session.seenIds);
  let challenger: Dish | null = null;
  let bestScore = -Infinity;
  for (const d of session.pool) {
    if (seenIds.has(d.id) || !unplayed(d)) continue;
    const score = affinity(d, session.bias) + d.prominence * 0.5
      - (d.cuisine === first.cuisine ? 0.2 : 0);
    if (score > bestScore) {
      bestScore = score;
      challenger = d;
    }
  }
  if (challenger) return [first, challenger];

  // 3. Крошечный пул: играть больше не с кем.
  const fallback = ranked.find((d) => d.id !== first.id);
  return fallback ? [first, fallback] : null;
}

export function finishBattle(session: BattleSession, winnerId: string): BattleSession {
  const winner = session.pool.find((d) => d.id === winnerId) ?? null;
  return { ...session, winner, pair: null };
}

// Для экрана результата: «5 побед из 6».
export function winnerRecord(session: BattleSession): { wins: number; of: number } {
  const id = session.winner?.id;
  const stat = id ? session.stats[id] : undefined;
  return { wins: stat?.wins ?? 0, of: session.choices.length };
}
