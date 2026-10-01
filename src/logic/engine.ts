export type Tri = 'yes' | 'no' | 'any';
export type Answer = Tri;
export type Mode = 'meal' | 'snack' | 'dessert';
export type DishType = 'main' | 'side' | 'dessert';

export const ANY_CUISINE = 'all';
export const MODES: readonly Mode[] = ['meal', 'snack', 'dessert'];

export type Dish = {
  id: string;
  name: string;
  name_uz: string;
  description: string;
  description_uz: string;
  cuisine: string;
  emoji: string;
  image: string;
  allergens: string[];
  dishType: DishType;
  // How likely a person is to mean this dish when nothing distinguishes it from a neighbour:
  // plov and mashkichiri share a trait vector, but one of them is what people actually order.
  // Used only to break ties — it never moves a dish past one the answers ranked higher.
  prominence: number;
  // Share of real players who answered «Да» for this dish, per tag (npm run calibrate). Used only with USE_CALIBRATED.
  calibration: Readonly<Record<string, number>>;
  [tag: string]: unknown;
};

// matchPercent is null when no applicable Yes/No answers exist (e.g. all «Без разницы»).
export type MatchedDish = Dish & { matchPercent: number | null };

// exact = false: nothing passed the threshold, the single best dish is shown as «Точного совпадения нет».
export type ResultSet = { dishes: MatchedDish[]; exact: boolean };

export type Question = {
  id: string;
  mode: Mode;
  tag: string;
  question_group: string;
  question_ru: string;
  subtitle_ru: string;
  question_uz: string;
  subtitle_uz: string;
  applies_to: string;
  show_if: string | null;
  hide_if: string | null;
  priority: number;
  emoji: string;
  image: string | null;
  icon_hint: string;
};

export type LogEntry = { questionId: string; tag: string; answer: Answer; appliesTo: string };

export type Session = {
  mode: Mode;
  cuisine: string;
  candidates: readonly Dish[];
  weights: readonly number[];
  answers: Readonly<Record<string, Answer>>;
  log: readonly LogEntry[];
  answered: number;
  swipes: number;
};

export type Lookahead = { isLastQuestion: boolean; remainingEstimate: number };

export type Rng = () => number;

// Bump on any change to scoring, question selection, stop conditions — or to the wording of
// a question, since rewording changes what an answer means. Sessions recorded under
// different rules are then never averaged together.
export const ALGORITHM_VERSION = 'v0.5';

export const MAX_SWIPES = 9;
export const TOP3_STOP_SHARE = 0.7;
// Window a question must fall in among the current leaders.
export const SHARE_MIN = 0.15;
export const SHARE_MAX = 0.85;
// Catalogue-wide guard: only drops questions that say nothing about anyone.
export const GLOBAL_SHARE_MIN = 0.02;
export const GLOBAL_SHARE_MAX = 0.98;
// How many dishes count as "still in contention" when judging a question.
export const LEADER_COUNT = 8;
// A dish nobody marked up is neither famous nor obscure.
export const DEFAULT_PROMINENCE = 0.5;

// Phase A / phase B (spec §6–7). The split already lives in the data as question_group:
// «Ощущения» is the state you are in, «Направление» the cuisine you lean towards, and for
// desserts «Вкус» (шоколад / фрукты / сливки) is the craving itself. «Основа», «Форма»,
// «Способ» and «Формат» describe the dish, not the want. Asking about the craving first is
// a UX decision, not a mathematical one — it costs information, so the rule is soft: it only
// picks among questions that already passed the informativeness gate.
const CRAVING_GROUPS: ReadonlySet<string> = new Set(['Ощущения', 'Направление', 'Вкус']);
export const CRAVING_FIRST = 2;

export function isCravingQuestion(q: Question): boolean {
  return CRAVING_GROUPS.has(q.question_group);
}
// Question value blends how well it splits the leaders with how well it splits the whole
// pool (spec §9). Pure leader-splitting reaches rare defining traits but loses sight of the
// rest of the catalogue; pure global splitting never asks «рис?» in a cuisine where only
// 11% of dishes have rice — and so can never single out plov.
// 0.5 chosen by sweeping 1.0 / 0.7 / 0.5 / 0.3 through npm run validate: it left the most
// of the catalogue reachable (82 dishes that can never be shown, against 116 before)
// without losing per-cuisine accuracy. Change it here to re-run that sweep.
export const LOCAL_WEIGHT = 0.5;
const PRIORITY_TIE = 0.03;
const TOP_N = 3;
// Сколько вариантов показываем на экране результатов. Отдельно от TOP_N: тот участвует
// в правиле остановки (top3Share), и менять его ради вёрстки нельзя.
export const RESULT_COUNT = 5;

// Results below this honest match percent are not shown.
export const RESULT_MIN_PERCENT = 50;
// At most this many dishes of one cuisine in the results. Strict one-per-cuisine meant a dish
// had to be the best of its entire cuisine to be shown at all, which left 43 of 99 snacks and
// 62 of 228 mains unreachable (npm run validate). Two keeps the spread — the simulator still
// returns 3.3 cuisines per result set — and returns ~18 points of snack accuracy.
export const RESULT_MAX_PER_CUISINE = 2;

const PROGRESS_CAP = 0.95;

// A tag is the probability that a player who has this dish in mind answers «Да».
export const TAG_P_YES: Readonly<Record<Tri, number>> = { yes: 0.9, no: 0.1, any: 0.5 };
// Graded traits keep that noise floor: 1 → 0.9, 0.5 → 0.5, 0 → 0.1, so yes/any/no data is unchanged.
export const P_YES_FLOOR = 0.1;
export const P_YES_RANGE = 0.8;
// Off until session_answers has enough data; then p_yes comes from calibration where available.
export const USE_CALIBRATED = false;
export const RANDOMIZER_LIKED_BOOST = 1.2;
export const RANDOMIZER_REJECTED_PENALTY = 0.5;

// ── Normalization (raw DB / CSV rows → typed objects) ─────────────────────────

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function parseAllergens(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  const s = str(v);
  if (!s) return [];
  if (s.startsWith('[')) {
    try { return (JSON.parse(s) as unknown[]).map(String); } catch { return []; }
  }
  // Postgres text[] literal: {gluten,eggs}
  return s.replace(/^\{|\}$/g, '').split(',').map((x) => x.trim()).filter(Boolean);
}

export function normalizeDish(raw: Record<string, unknown>): Dish {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = typeof v === 'string' ? v.trim() : v;
  const dishType = str(raw.dishType);
  return {
    ...out,
    id: str(raw.id),
    name: str(raw.name),
    name_uz: str(raw.name_uz),
    description: str(raw.description),
    description_uz: str(raw.description_uz),
    cuisine: str(raw.cuisine),
    emoji: str(raw.emoji) || '🍽️',
    image: str(raw.image),
    allergens: parseAllergens(raw.allergens),
    dishType: dishType === 'side' || dishType === 'dessert' ? dishType : 'main',
    prominence: raw.prominence == null || str(raw.prominence) === '' ? DEFAULT_PROMINENCE : clamp01(Number(raw.prominence)),
    calibration: parseCalibration(raw.p_yes_calibrated),
  };
}

function parseCalibration(v: unknown): Record<string, number> {
  let obj: unknown = v;
  if (typeof v === 'string') {
    if (!v.trim()) return {};
    try { obj = JSON.parse(v); } catch { return {}; }
  }
  if (!obj || typeof obj !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(obj as Record<string, unknown>)) {
    const n = Number(x);
    if (Number.isFinite(n) && n >= 0 && n <= 1) out[k] = n;
  }
  return out;
}

export function normalizeQuestion(raw: Record<string, unknown>): Question {
  const mode = str(raw.mode) as Mode;
  return {
    id: str(raw.id),
    mode: MODES.includes(mode) ? mode : 'meal',
    tag: str(raw.tag),
    question_group: str(raw.question_group),
    question_ru: str(raw.question_ru),
    subtitle_ru: str(raw.subtitle_ru),
    question_uz: str(raw.question_uz) || str(raw.question_ru),
    subtitle_uz: str(raw.subtitle_uz) || str(raw.subtitle_ru),
    applies_to: str(raw.applies_to) || 'all',
    show_if: str(raw.show_if) || null,
    hide_if: str(raw.hide_if) || null,
    priority: Number(raw.priority) || 99,
    emoji: str(raw.emoji) || '❓',
    image: str(raw.image) || null,
    icon_hint: str(raw.icon_hint),
  };
}

// ── Tags ──────────────────────────────────────────────────────────────────────

// How strongly a dish carries a trait, 0…1. Sensation traits (heavy, spicy, fatty, sweet)
// may be graded; facts (rice, dough, soup) stay 0 or 1. 'yes'/'any'/'no' read as 1/0.5/0,
// so hand-written tri-state data and graded data live in the same column.
export function traitValue(dish: Dish, tag: string): number {
  if (tag.startsWith('cuisine:')) return dish.cuisine === tag.slice(8) ? 1 : 0;
  if (tag.startsWith('allergen:')) return dish.allergens.includes(tag.slice(9)) ? 1 : 0;
  return parseTrait(dish[tag]);
}

function parseTrait(v: unknown): number {
  if (typeof v === 'number') return clamp01(v);
  const s = str(v);
  if (s === 'yes') return 1;
  if (s === 'any') return 0.5;
  if (s === 'no' || s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? clamp01(n) : 0;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// Tri-state view of a trait, for reports and the noisy-player simulation.
export function tagValue(dish: Dish, tag: string): Tri {
  const t = traitValue(dish, tag);
  return t >= 0.75 ? 'yes' : t <= 0.25 ? 'no' : 'any';
}

// ── Candidates ────────────────────────────────────────────────────────────────

function fitsMode(d: Dish, mode: Mode, cuisine: string): boolean {
  if (mode === 'meal') return d.dishType === 'main' && (cuisine === ANY_CUISINE || d.cuisine === cuisine);
  if (mode === 'snack') return d.dishType === 'side' || traitValue(d, 'isSnack') > 0;
  return d.dishType === 'dessert' || (d.dishType === 'main' && traitValue(d, 'isSweet') > 0);
}

export function getCandidates(dishes: readonly Dish[], mode: Mode, cuisine: string, excludeAllergens: readonly string[]): Dish[] {
  return dishes.filter(
    (d) => fitsMode(d, mode, cuisine) && !d.allergens.some((a) => excludeAllergens.includes(a)),
  );
}

export function startSession(
  dishes: readonly Dish[],
  mode: Mode,
  cuisine: string,
  excludeAllergens: readonly string[],
): Session {
  const effectiveCuisine = mode === 'meal' ? cuisine : ANY_CUISINE;
  const candidates = getCandidates(dishes, mode, effectiveCuisine, excludeAllergens);
  return {
    mode,
    cuisine: effectiveCuisine,
    candidates,
    weights: candidates.map(() => 1),
    answers: {},
    log: [],
    answered: 0,
    swipes: 0,
  };
}

// ── Answers ───────────────────────────────────────────────────────────────────

export function answerFactor(answer: Answer, pYesValue: number): number {
  if (answer === 'any') return 1;
  return answer === 'yes' ? pYesValue : Math.round((1 - pYesValue) * 1e9) / 1e9;
}

export function multiplier(answer: Answer, value: Tri): number {
  return answerFactor(answer, TAG_P_YES[value]);
}

export function pYes(dish: Dish, tag: string, useCalibrated: boolean = USE_CALIBRATED): number {
  const calibrated = useCalibrated ? dish.calibration[tag] : undefined;
  return calibrated ?? P_YES_FLOOR + P_YES_RANGE * traitValue(dish, tag);
}

// A meal question limited by applies_to says nothing about dishes of other cuisines.
export function appliesToDish(appliesTo: string, dish: Dish, mode: Mode): boolean {
  if (mode !== 'meal' || appliesTo === 'all') return true;
  return appliesTo.split(';').some((c) => c.trim() === dish.cuisine);
}

function reweigh(candidates: readonly Dish[], weights: readonly number[], entry: LogEntry, mode: Mode): number[] {
  return candidates.map((d, i) =>
    appliesToDish(entry.appliesTo, d, mode) ? weights[i] * answerFactor(entry.answer, pYes(d, entry.tag)) : weights[i],
  );
}

function applyEntry(session: Session, entry: LogEntry): Session {
  const counts = entry.answer !== 'any';
  return {
    ...session,
    weights: counts ? reweigh(session.candidates, session.weights, entry, session.mode) : session.weights,
    answers: { ...session.answers, [entry.tag]: entry.answer },
    log: [...session.log, entry],
    answered: session.answered + (counts ? 1 : 0),
    swipes: session.swipes + 1,
  };
}

export function applyAnswer(session: Session, question: Question, answer: Answer): Session {
  return applyEntry(session, { questionId: question.id, tag: question.tag, answer, appliesTo: question.applies_to });
}

// Recomputes from scratch by replaying the log, so no inverse math on weights.
export function undoLast(session: Session): Session {
  if (session.log.length === 0) return session;
  const base: Session = { ...session, weights: session.candidates.map(() => 1), answers: {}, log: [], answered: 0, swipes: 0 };
  return session.log.slice(0, -1).reduce(applyEntry, base);
}

// ── Question selection ───────────────────────────────────────────────────────

export function conditionMet(condition: string | null, answers: Readonly<Record<string, Answer>>): boolean {
  if (!condition) return false;
  const eq = condition.lastIndexOf('=');
  if (eq <= 0) return false;
  return answers[condition.slice(0, eq).trim()] === condition.slice(eq + 1).trim();
}

export function isEligible(q: Question, session: Session): boolean {
  if (q.mode !== session.mode) return false;
  if (q.tag in session.answers || session.log.some((e) => e.questionId === q.id)) return false;
  if (session.mode === 'meal' && session.cuisine !== ANY_CUISINE && q.applies_to !== 'all') {
    if (!q.applies_to.split(';').map((c) => c.trim()).includes(session.cuisine)) return false;
  }
  if (q.show_if && !conditionMet(q.show_if, session.answers)) return false;
  if (q.hide_if && conditionMet(q.hide_if, session.answers)) return false;
  return true;
}

function totalWeight(session: Session): number {
  let s = 0;
  for (const w of session.weights) s += w;
  return s;
}

export function yesShare(session: Session, tag: string, appliesTo = 'all'): number {
  return shareOver(session, tag, appliesTo, session.candidates.map((_, i) => i));
}

function shareOver(session: Session, tag: string, appliesTo: string, indexes: readonly number[]): number {
  let total = 0;
  let yes = 0;
  for (const i of indexes) {
    const d = session.candidates[i];
    if (!appliesToDish(appliesTo, d, session.mode)) continue;
    const w = session.weights[i];
    total += w;
    yes += w * traitValue(d, tag);
  }
  return total > 0 ? yes / total : 0;
}

// The dishes still in contention. A question is worth asking when it splits *these*,
// even if it barely splits the catalogue: «рис?» divides plov from the stews around it
// while only 11% of the cuisine has rice, so a catalogue-wide share would discard it.
function leaderIndexes(session: Session): number[] {
  return session.candidates
    .map((_, i) => i)
    .sort((a, b) => session.weights[b] - session.weights[a])
    .slice(0, LEADER_COUNT);
}

function informativeQuestions(questions: readonly Question[], session: Session): Array<{ q: Question; dist: number }> {
  const leaders = leaderIndexes(session);
  const byLeaders: Array<{ q: Question; dist: number }> = [];
  const byPool: Array<{ q: Question; dist: number }> = [];
  for (const q of questions) {
    if (!isEligible(q, session)) continue;
    // A question nobody in the whole pool would answer differently is noise, whatever the
    // leaders look like; the catalogue-wide guard is deliberately loose.
    const global = yesShare(session, q.tag, q.applies_to);
    if (global < GLOBAL_SHARE_MIN || global > GLOBAL_SHARE_MAX) continue;
    const local = shareOver(session, q.tag, q.applies_to, leaders);
    const dist = LOCAL_WEIGHT * Math.abs(local - 0.5) + (1 - LOCAL_WEIGHT) * Math.abs(global - 0.5);
    if (local >= SHARE_MIN && local <= SHARE_MAX) byLeaders.push({ q, dist });
    else if (global >= SHARE_MIN && global <= SHARE_MAX) byPool.push({ q, dist });
  }
  // Splitting the leaders is what shortens the quiz, so those questions come first. But when
  // the leaders agree on everything, falling back to the pool beats ending the quiz on a
  // single answer — which is how «жирное?» alone used to decide the whole session.
  // Открываем разговор с того, чего человеку хочется, а не с состава блюда — но только
  // если такой вопрос вообще что-то разделяет. «Неважно» не тратит эту квоту: она
  // считается по информативным ответам. Ищем желание в обоих списках: вопрос про
  // состояние стоит задать, даже если лидеров он делит хуже, чем вопрос про состав.
  // Ищем желание только среди вопросов, которые и так хорошо делят лидеров: тянуть сюда
  // вопрос из запасного списка ради «правильного» порядка стоило 6 пунктов точности на
  // персонах и лишних полвопроса, а выигрыш от него — гипотеза, которую ещё не подтвердили
  // живые сессии.
  const tier = byLeaders.length > 0 ? byLeaders : byPool;
  if (session.answered >= CRAVING_FIRST) return tier;
  const craving = tier.filter((o) => isCravingQuestion(o.q));
  return craving.length > 0 ? craving : tier;
}

export function pickNextQuestion(questions: readonly Question[], session: Session, excludeIds: readonly string[] = []): Question | null {
  const options = informativeQuestions(questions, session).filter((o) => !excludeIds.includes(o.q.id));
  if (options.length === 0) return null;
  const best = Math.min(...options.map((o) => o.dist));
  const near = options.filter((o) => o.dist - best < PRIORITY_TIE);
  near.sort((a, b) => a.q.priority - b.q.priority || a.dist - b.dist);
  return near[0].q;
}

// ── Stop condition ───────────────────────────────────────────────────────────

export function questionLimit(mode: Mode, cuisine: string): number {
  if (mode === 'meal') return cuisine === ANY_CUISINE ? 8 : 7;
  return mode === 'snack' ? 5 : 4;
}

export function top3Share(session: Session): number {
  const total = totalWeight(session);
  if (total <= 0) return 0;
  const top = [...session.weights].sort((a, b) => b - a).slice(0, TOP_N);
  return top.reduce((s, w) => s + w, 0) / total;
}

export function shouldStop(session: Session): boolean {
  if (session.candidates.length === 0) return true;
  if (session.answered >= questionLimit(session.mode, session.cuisine)) return true;
  if (session.swipes >= MAX_SWIPES) return true;
  return top3Share(session) > TOP3_STOP_SHARE;
}

export function isFinished(questions: readonly Question[], session: Session): boolean {
  return shouldStop(session) || pickNextQuestion(questions, session) === null;
}

// Peeks one answer ahead to size the card stack and the "≈ ещё K" hint.
// remainingEstimate counts the current question.
export function getLookahead(questions: readonly Question[], session: Session, current: Question): Lookahead {
  const endsAfter = (a: Answer) => isFinished(questions, applyAnswer(session, current, a));
  if (endsAfter('yes') && endsAfter('no')) return { isLastQuestion: true, remainingEstimate: 1 };
  const byLimit = questionLimit(session.mode, session.cuisine) - session.answered;
  const bySwipes = MAX_SWIPES - session.swipes;
  const byQuestions = informativeQuestions(questions, session).length;
  return { isLastQuestion: false, remainingEstimate: Math.max(2, Math.min(byLimit, bySwipes, byQuestions)) };
}

export function stackDepth(lookahead: Lookahead): number {
  return lookahead.isLastQuestion ? 0 : Math.max(0, Math.min(2, lookahead.remainingEstimate - 1));
}

// 1 only once the quiz has stopped; callers keep it monotonic with nextProgress.
export function progressValue(questions: readonly Question[], session: Session): number {
  if (isFinished(questions, session)) return 1;
  const limit = questionLimit(session.mode, session.cuisine);
  const raw = Math.max(session.answered / limit, session.swipes / MAX_SWIPES, top3Share(session) / TOP3_STOP_SHARE);
  return Math.min(PROGRESS_CAP, raw);
}

export function nextProgress(prev: number, questions: readonly Question[], session: Session): number {
  return Math.max(prev, progressValue(questions, session));
}

// ── Results ──────────────────────────────────────────────────────────────────

// Match is the share of applicable Yes/No answers the dish agrees with, pulled towards 50%
// by MATCH_PRIOR imaginary neutral answers. Three agreeing answers therefore read 80%, not
// 100%: after three questions the engine genuinely does not know enough to promise a perfect
// fit, and showing 100% there is a lie the player can feel. The ceiling rises with evidence.
export const MATCH_PRIOR = 2;

export function matchPercent(dish: Dish, log: readonly LogEntry[], mode: Mode): number | null {
  let score = 0;
  let count = 0;
  for (const e of log) {
    if (e.answer === 'any' || !appliesToDish(e.appliesTo, dish, mode)) continue;
    const t = traitValue(dish, e.tag);
    count++;
    score += e.answer === 'yes' ? t : 1 - t;
  }
  if (count === 0) return null;
  return Math.round(((score + MATCH_PRIOR * 0.5) / (count + MATCH_PRIOR)) * 100);
}

export function usesCuisineDiversity(session: Pick<Session, 'mode' | 'cuisine'>): boolean {
  return session.mode === 'snack' || (session.mode === 'meal' && session.cuisine === ANY_CUISINE);
}

type Ranked = { dish: Dish; w: number; pct: number | null };

// Percent desc, then engine weight desc; unknown percent (no Yes/No answers) sorts by weight only.
function rank(candidates: readonly Dish[], weights: readonly number[], log: readonly LogEntry[], mode: Mode): Ranked[] {
  return candidates
    .map((dish, i) => ({ dish, w: weights[i], pct: matchPercent(dish, log, mode) }))
    .sort((a, b) =>
      (b.pct ?? -1) - (a.pct ?? -1)
      || b.w - a.w
      // Dishes the answers cannot separate are ordered by what people actually mean,
      // not by whose id sorts first — that used to hand plov's slot to mashkichiri.
      || b.dish.prominence - a.dish.prominence
      || a.dish.id.localeCompare(b.dish.id));
}

// A cap above 1 is a preference: if it cannot fill n slots, cuisine stops mattering for the
// rest — five options are worth more than the spread. A cap of 1 («Все кухни») is a promise
// the screen makes and is never relaxed.
function pickDiverse(pool: Ranked[], n: number, maxPerCuisine: number): Ranked[] {
  const picked: Ranked[] = [];
  const perCuisine = new Map<string, number>();
  const take = (max: number) => {
    for (const x of pool) {
      if (picked.length >= n) return;
      if (picked.includes(x) || (perCuisine.get(x.dish.cuisine) ?? 0) >= max) continue;
      picked.push(x);
      perCuisine.set(x.dish.cuisine, (perCuisine.get(x.dish.cuisine) ?? 0) + 1);
    }
  };
  take(maxPerCuisine);
  if (picked.length < n && maxPerCuisine > 1) take(Infinity);
  return picked.sort((a, b) => pool.indexOf(a) - pool.indexOf(b));
}

function toResultSet(ranked: Ranked[], diverse: boolean, maxPerCuisine: number, n: number): ResultSet {
  if (ranked.length === 0) return { dishes: [], exact: true };
  const toMatched = (x: Ranked): MatchedDish => ({ ...x.dish, matchPercent: x.pct });
  if (ranked[0].pct === null) {
    const top = diverse ? pickDiverse(ranked, n, maxPerCuisine) : ranked.slice(0, n);
    return { dishes: top.map(toMatched), exact: true };
  }
  const passed = ranked.filter((x) => x.pct !== null && x.pct >= RESULT_MIN_PERCENT);
  if (passed.length === 0) return { dishes: [toMatched(ranked[0])], exact: false };
  const top = diverse ? pickDiverse(passed, n, maxPerCuisine) : passed.slice(0, n);
  return { dishes: top.map(toMatched), exact: true };
}

export function rankResults(session: Session, n: number = TOP_N): ResultSet {
  const ranked = rank(session.candidates, session.weights, session.log, session.mode);
  return toResultSet(ranked, usesCuisineDiversity(session), RESULT_MAX_PER_CUISINE, n);
}

// «Все кухни»: the same answers replayed over every cuisine's mains, one dish per cuisine.
export function allCuisinesResults(
  dishes: readonly Dish[],
  log: readonly LogEntry[],
  excludeAllergens: readonly string[],
  n: number = TOP_N,
): ResultSet {
  const candidates = getCandidates(dishes, 'meal', ANY_CUISINE, excludeAllergens);
  let weights = candidates.map(() => 1);
  for (const e of log) if (e.answer !== 'any') weights = reweigh(candidates, weights, e, 'meal');
  return toResultSet(rank(candidates, weights, log, 'meal'), true, 1, n);
}

// ── Randomizer ───────────────────────────────────────────────────────────────

export type RandomizerInput = {
  dishes: readonly Dish[];
  excludeAllergens: readonly string[];
  recentIds: readonly string[];
  likedIds: readonly string[];
  rejectedIds: readonly string[];
  rng?: Rng;
};

export function randomizerWeight(dish: Dish, likedCuisines: ReadonlySet<string>, rejectedCuisines: ReadonlySet<string>): number {
  let w = 1;
  if (likedCuisines.has(dish.cuisine)) w *= RANDOMIZER_LIKED_BOOST;
  if (rejectedCuisines.has(dish.cuisine)) w *= RANDOMIZER_REJECTED_PENALTY;
  return w;
}

export function pickRandomDish({
  dishes, excludeAllergens, recentIds, likedIds, rejectedIds, rng = Math.random,
}: RandomizerInput): Dish | null {
  const all = getCandidates(dishes, 'meal', ANY_CUISINE, excludeAllergens);
  if (all.length === 0) return null;
  const recent = new Set(recentIds.slice(0, 3));
  const fresh = all.filter((d) => !recent.has(d.id));
  const pool = fresh.length > 0 ? fresh : all;

  const byId = new Map(dishes.map((d) => [d.id, d]));
  const cuisinesOf = (ids: readonly string[]) => new Set(ids.map((id) => byId.get(id)?.cuisine).filter((c): c is string => !!c));
  const likedCuisines = cuisinesOf(likedIds);
  const rejectedCuisines = cuisinesOf(rejectedIds);

  const weights = pool.map((d) => randomizerWeight(d, likedCuisines, rejectedCuisines));
  let r = rng() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
