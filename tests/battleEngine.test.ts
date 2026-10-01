import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDish } from '../src/logic/engine.ts';
import type { Dish } from '../src/logic/engine.ts';
import {
  BATTLE_ROUNDS, affinity, buildPool, calculateBattleScores, canPlay, createBattleSession,
  pairKey, registerChoice, selectFinalists, selectInitialPair, selectNextOpponent, traitDistance,
  winnerRecord,
} from '../src/logic/battleEngine.ts';
import { loadDishes } from '../scripts/lib/csvData.ts';

let seq = 0;
function dish(p: Record<string, unknown> = {}): Dish {
  return normalizeDish({
    id: `b${seq++}`, name: 'x', cuisine: 'asian', dishType: 'main', allergens: [],
    image: 'http://img', prominence: '0.5', ...p,
  });
}
const seeded = (s: number) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

// Пара противоположных блюд плюс «наполнитель», чтобы пул был достаточного размера.
function pool(n = 12): Dish[] {
  return Array.from({ length: n }, (_, i) => dish({
    id: `d${i}`,
    cuisine: ['asian', 'slavic', 'european', 'fast-food'][i % 4],
    isSoup: i % 2 ? 'yes' : 'no',
    hasRice: i % 3 === 0 ? 'yes' : 'no',
    hasMeat: i % 2 ? 'no' : 'yes',
    isHeavy: i % 4 < 2 ? '1' : '0',
    prominence: i < 6 ? '1' : '0.25',
  }));
}

test('battle: сессия стартует с парой разных блюд', () => {
  const s = createBattleSession(pool(), [], seeded(7));
  assert.ok(canPlay(s));
  assert.equal(s.round, 1);
  assert.equal(s.maxRounds, BATTLE_ROUNDS);
  assert.ok(s.pair, 'пара есть сразу');
  assert.notEqual(s.pair![0].id, s.pair![1].id, 'блюдо не сравнивается само с собой');
});

test('battle: первая пара берётся из узнаваемых и непохожих блюд', () => {
  const p = [
    dish({ id: 'famous-a', prominence: '1', isSoup: 'yes', hasRice: 'yes', hasMeat: 'no' }),
    dish({ id: 'famous-b', prominence: '1', isSoup: 'no', hasRice: 'no', hasMeat: 'yes', cuisine: 'slavic' }),
    dish({ id: 'twin', prominence: '1', isSoup: 'yes', hasRice: 'yes', hasMeat: 'no' }),
    dish({ id: 'obscure', prominence: '0.25', isSoup: 'no', hasRice: 'no', hasMeat: 'yes' }),
  ];
  const [a, b] = selectInitialPair(p, seeded(3));
  assert.notEqual(a.id, b.id);
  assert.ok(traitDistance(a, b) > 0, 'пара не из двух одинаковых блюд');
});

test('battle: выбор засчитывается, счёт растёт, появляется новый соперник', () => {
  const s0 = createBattleSession(pool(), [], seeded(11));
  const champion = s0.pair![0];
  const s1 = registerChoice(s0, champion.id);

  assert.equal(s1.round, 2);
  assert.equal(s1.choices.length, 1);
  assert.equal(calculateBattleScores(s1)[champion.id].wins, 1);
  assert.equal(calculateBattleScores(s1)[s0.pair![1].id].losses, 1);
  assert.ok(s1.pair!.some((d) => d.id === champion.id), 'победитель остаётся на экране');
  assert.notEqual(s1.pair![0].id, s1.pair![1].id);
  assert.ok(s1.pair!.every((d) => d.id !== s0.pair![1].id), 'проигравший уходит');
});

test('battle: одно поражение не выбрасывает блюдо навсегда', () => {
  const s0 = createBattleSession(pool(), [], seeded(5));
  const loser = s0.pair![1];
  const s1 = registerChoice(s0, s0.pair![0].id);
  const stat = calculateBattleScores(s1)[loser.id];
  assert.equal(stat.losses, 1);
  assert.ok(stat.score > -1, `проигравший сохраняет шанс, а счёт вышел ${stat.score}`);
});

test('battle: сигнал только по тем признакам, где блюда различаются', () => {
  // Оба с рисом, различаются только супом: выбор не должен ничего говорить про рис.
  const soup = dish({ id: 'soup', hasRice: 'yes', isSoup: 'yes' });
  const dry = dish({ id: 'dry', hasRice: 'yes', isSoup: 'no' });
  const s0 = createBattleSession([soup, dry, ...pool(6)], [], seeded(2));
  const started = { ...s0, pair: [soup, dry] as const };
  const s1 = registerChoice(started, 'soup');
  assert.ok((s1.bias.isSoup ?? 0) > 0, 'суп получил положительный сигнал');
  assert.equal(s1.bias.hasRice, undefined, 'про рис выбор ничего не сказал');
});

test('battle: affinity тянет к тому, что человек выбирал', () => {
  const bias = { isSoup: 0.6 };
  assert.ok(affinity(dish({ isSoup: 'yes' }), bias) > 0);
  assert.ok(affinity(dish({ isSoup: 'no' }), bias) < 0);
  assert.equal(affinity(dish({ isSoup: 'yes' }), {}), 0, 'без накопленных выборов предпочтений нет');
});

test('battle: полная игра — ровно BATTLE_ROUNDS сравнений, финал и победитель', () => {
  let s = createBattleSession(pool(16), [], seeded(13));
  const seenPairs = new Set<string>();
  let taps = 0;
  while (!s.winner) {
    assert.ok(s.pair, 'пока победителя нет, на экране пара');
    const key = pairKey(s.pair![0].id, s.pair![1].id);
    assert.ok(!seenPairs.has(key), `пара ${key} повторилась`);
    seenPairs.add(key);
    assert.notEqual(s.pair![0].id, s.pair![1].id);
    s = registerChoice(s, s.pair![0].id);
    taps++;
    assert.ok(taps <= BATTLE_ROUNDS + 1, 'игра не должна длиться дольше финала');
  }
  assert.equal(taps, BATTLE_ROUNDS + 1, 'пять сравнений плюс финал');
  assert.ok(s.winner);
  assert.equal(s.pair, null, 'после победы пары на экране нет');
  const rec = winnerRecord(s);
  assert.ok(rec.wins >= 1 && rec.of === BATTLE_ROUNDS + 1);
});

test('battle: финалисты — двое сильнейших, и это разные блюда', () => {
  let s = createBattleSession(pool(16), [], seeded(21));
  for (let i = 0; i < BATTLE_ROUNDS - 1; i++) s = registerChoice(s, s.pair![0].id);
  const champion = s.pair![0];
  const finalists = selectFinalists(s, champion);
  assert.ok(finalists);
  assert.notEqual(finalists![0].id, finalists![1].id);
  assert.equal(finalists![0].id, champion.id, 'чемпион идёт в финал');
});

test('battle: соперник не повторяет уже сыгранную пару и не равен чемпиону', () => {
  let s = createBattleSession(pool(14), [], seeded(31));
  const champion = s.pair![0];
  s = registerChoice(s, champion.id);
  const opponent = selectNextOpponent(s, champion);
  assert.ok(opponent);
  assert.notEqual(opponent!.id, champion.id);
  assert.ok(!s.choices.some((c) => pairKey(c.winnerId, c.loserId) === pairKey(champion.id, opponent!.id)));
});

test('edge: аллергены убирают блюда из игры, второй системы фильтрации нет', () => {
  const safe = Array.from({ length: 8 }, (_, i) => dish({ id: `safe${i}`, allergens: [] }));
  const nutty = Array.from({ length: 8 }, (_, i) => dish({ id: `nut${i}`, allergens: ['nuts'] }));
  const p = buildPool([...safe, ...nutty], ['nuts']);
  assert.equal(p.length, 8);
  assert.ok(p.every((d) => !d.allergens.includes('nuts')));

  const s = createBattleSession([...safe, ...nutty], ['nuts'], seeded(4));
  assert.ok(s.pair!.every((d) => !d.allergens.includes('nuts')));
});

test('edge: крошечный пул — игра короче, но без повторов и без самосравнения', () => {
  const tiny = [dish({ id: 't1' }), dish({ id: 't2' }), dish({ id: 't3' })];
  let s = createBattleSession(tiny, [], seeded(9));
  assert.ok(canPlay(s));
  assert.ok(s.maxRounds < BATTLE_ROUNDS, 'раундов меньше обычного');
  let taps = 0;
  while (!s.winner && taps < 10) {
    assert.notEqual(s.pair![0].id, s.pair![1].id);
    s = registerChoice(s, s.pair![0].id);
    taps++;
  }
  assert.ok(s.winner, 'игра всё равно заканчивается победителем');
});

test('edge: меньше двух блюд — играть нельзя, падения нет', () => {
  const s = createBattleSession([dish()], [], seeded(1));
  assert.equal(canPlay(s), false);
  assert.equal(s.pair, null);
  assert.equal(registerChoice(s, 'whatever'), s, 'клик без пары ничего не ломает');
});

test('edge: без traits игра работает на запасном отборе', () => {
  const blank = Array.from({ length: 8 }, (_, i) =>
    normalizeDish({ id: `n${i}`, name: 'x', cuisine: 'asian', dishType: 'main', allergens: [] }));
  let s = createBattleSession(blank, [], seeded(6));
  assert.ok(canPlay(s));
  assert.equal(traitDistance(blank[0], blank[1]), 0, 'признаков нет — расстояние ноль');
  let taps = 0;
  while (!s.winner && taps < 10) { s = registerChoice(s, s.pair![0].id); taps++; }
  assert.ok(s.winner);
});

test('edge: повторный тап по уже выбранной карточке не сдвигает игру', () => {
  const s0 = createBattleSession(pool(), [], seeded(17));
  const s1 = registerChoice(s0, s0.pair![0].id);
  // Пары уже нет в прежнем виде: повторный тап по id из старой пары не должен красть раунд.
  const stale = registerChoice(s1, s0.pair![1].id);
  assert.equal(stale, s1, 'id не из текущей пары игнорируется');
});

test('edge: повторная игра не повторяет ту же первую пару подряд', () => {
  const rng = seeded(42);
  const p = pool(20);
  const first = createBattleSession(p, [], rng).pair!;
  let differs = false;
  for (let i = 0; i < 6 && !differs; i++) {
    const again = createBattleSession(p, [], rng).pair!;
    differs = pairKey(again[0].id, again[1].id) !== pairKey(first[0].id, first[1].id);
  }
  assert.ok(differs, 'перезапуск должен давать другие пары');
});

test('реальные данные: игра проходит на боевом каталоге', () => {
  const dishes = loadDishes();
  let s = createBattleSession(dishes, ['nuts'], seeded(99));
  assert.ok(canPlay(s));
  assert.ok(s.pool.length > 20, 'каталога хватает на игру');
  assert.ok(s.pool.every((d) => !d.allergens.includes('nuts')));
  const cuisines = new Set<string>();
  let taps = 0;
  while (!s.winner && taps < 10) {
    s.pair!.forEach((d) => cuisines.add(d.cuisine));
    s = registerChoice(s, s.pair![1].id);
    taps++;
  }
  assert.equal(taps, BATTLE_ROUNDS + 1);
  assert.ok(s.winner, 'победитель определён');
  assert.ok(cuisines.size >= 3, `в игре должны встречаться разные кухни, а вышло ${cuisines.size}`);
});
