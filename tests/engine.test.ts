import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANY_CUISINE, applyAnswer, conditionMet, getCandidates, getLookahead, isEligible, isFinished, matchPercent, multiplier,
  nextProgress, normalizeDish, normalizeQuestion, pickNextQuestion, pickRandomDish, progressValue, questionLimit, rankResults,
  RESULT_MIN_PERCENT, SHARE_MIN, yesShare, allCuisinesResults, appliesToDish, answerFactor, pYes, TAG_P_YES, traitValue, USE_CALIBRATED, shouldStop, stackDepth, startSession, tagValue, top3Share, undoLast,
} from '../src/logic/engine.ts';
import type { Dish, Question, Session } from '../src/logic/engine.ts';
import { loadDishes, loadQuestions, loadRawDessertTags } from '../scripts/lib/csvData.ts';

let seq = 0;
function dish(p: Record<string, unknown> = {}): Dish {
  return normalizeDish({ id: `d${seq++}`, name: 'x', cuisine: 'asian', dishType: 'main', allergens: [], isSnack: 'no', isSweet: 'no', ...p });
}
function question(p: Record<string, unknown> = {}): Question {
  return normalizeQuestion({ id: `q${seq++}`, mode: 'meal', tag: 'isHot', applies_to: 'all', priority: 1, ...p });
}
function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

test('multiplier: yes/no/any per spec 3.2', () => {
  assert.equal(multiplier('yes', 'yes'), 0.9);
  assert.equal(multiplier('yes', 'no'), 0.1);
  assert.equal(multiplier('yes', 'any'), 0.5);
  assert.equal(multiplier('no', 'no'), 0.9);
  assert.equal(multiplier('no', 'yes'), 0.1);
  assert.equal(multiplier('no', 'any'), 0.5);
  for (const v of ['yes', 'no', 'any'] as const) assert.equal(multiplier('any', v), 1);
});

test('tagValue: column, cuisine:, allergen:, missing column', () => {
  const d = dish({ cuisine: 'slavic', isHot: 'any', allergens: '["nuts","gluten"]' });
  assert.equal(tagValue(d, 'isHot'), 'any');
  assert.equal(tagValue(d, 'cuisine:slavic'), 'yes');
  assert.equal(tagValue(d, 'cuisine:asian'), 'no');
  assert.equal(tagValue(d, 'allergen:nuts'), 'yes');
  assert.equal(tagValue(d, 'allergen:eggs'), 'no');
  assert.equal(tagValue(d, 'hasChocolate'), 'no');
});

test('graded traits generalize yes/any/no instead of replacing it', () => {
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
  assert.equal(traitValue(dish({ isSpicy: 'yes' }), 'isSpicy'), 1);
  assert.equal(traitValue(dish({ isSpicy: 'any' }), 'isSpicy'), 0.5);
  assert.equal(traitValue(dish({ isSpicy: 'no' }), 'isSpicy'), 0);
  assert.equal(traitValue(dish({}), 'isSpicy'), 0, 'a trait nobody wrote down is not carried');
  assert.equal(traitValue(dish({ isSpicy: '0.75' }), 'isSpicy'), 0.75, 'CSV numbers arrive as text');
  assert.equal(traitValue(dish({ isSpicy: 7 }), 'isSpicy'), 1, 'out of range clamps');

  near(pYes(dish({ isSpicy: 'yes' }), 'isSpicy'), TAG_P_YES.yes);
  near(pYes(dish({ isSpicy: 'any' }), 'isSpicy'), TAG_P_YES.any);
  near(pYes(dish({ isSpicy: 'no' }), 'isSpicy'), TAG_P_YES.no);
  near(pYes(dish({ isSpicy: 0.25 }), 'isSpicy'), 0.3);

  // Match is the share of the answer the dish carries, pulled towards 50% by MATCH_PRIOR:
  // one answer agreeing 0.75 reads (0.75 + 1) / (1 + 2) = 58%, not 75%.
  const log = [{ questionId: 'q', tag: 'isSpicy', answer: 'yes' as const, appliesTo: 'all' }];
  assert.equal(matchPercent(dish({ isSpicy: 0.75 }), log, 'meal'), 58);
  assert.equal(matchPercent(dish({ isSpicy: 'any' }), log, 'meal'), 50, 'a neutral dish stays at 50%');
  assert.equal(matchPercent(dish({ isSpicy: 0.75 }), [{ ...log[0], answer: 'no' }], 'meal'), 42);
});

test('normalizeDish parses allergens from jsonb, JSON text and text[] literal', () => {
  assert.deepEqual(dish({ allergens: ['eggs'] }).allergens, ['eggs']);
  assert.deepEqual(dish({ allergens: '["eggs","nuts"]' }).allergens, ['eggs', 'nuts']);
  assert.deepEqual(dish({ allergens: '{gluten,lactose}' }).allergens, ['gluten', 'lactose']);
  assert.deepEqual(dish({ allergens: null }).allergens, []);
});

test('candidates per mode and allergen hard filter', () => {
  const main = dish({ cuisine: 'asian' });
  const mainEu = dish({ cuisine: 'european' });
  const side = dish({ dishType: 'side' });
  const snackMain = dish({ isSnack: 'yes' });
  const dessert = dish({ dishType: 'dessert' });
  const sweetMain = dish({ isSweet: 'any' });
  const nutty = dish({ dishType: 'dessert', allergens: ['nuts'] });
  const all = [main, mainEu, side, snackMain, dessert, sweetMain, nutty];

  assert.deepEqual(getCandidates(all, 'meal', 'asian', []).map((d) => d.id), [main.id, snackMain.id, sweetMain.id]);
  assert.equal(getCandidates(all, 'meal', ANY_CUISINE, []).length, 4);
  assert.deepEqual(getCandidates(all, 'snack', ANY_CUISINE, []).map((d) => d.id), [side.id, snackMain.id]);
  assert.deepEqual(getCandidates(all, 'dessert', ANY_CUISINE, ['nuts']).map((d) => d.id), [dessert.id, sweetMain.id]);
  assert.equal(startSession(all, 'snack', 'asian', []).cuisine, ANY_CUISINE);
  const maybeSnack = dish({ isSnack: 'any' });
  assert.ok(getCandidates([maybeSnack], 'snack', ANY_CUISINE, []).length === 1, 'isSnack any counts as a snack');
});

test('applyAnswer: weights change, "any" is free, dishes never removed', () => {
  const hot = dish({ isHot: 'yes' });
  const cold = dish({ isHot: 'no' });
  const either = dish({ isHot: 'any' });
  const q = question({ tag: 'isHot' });
  let s = startSession([hot, cold, either], 'meal', ANY_CUISINE, []);
  s = applyAnswer(s, q, 'yes');
  assert.deepEqual(s.weights, [0.9, 0.1, 0.5]);
  assert.equal(s.answered, 1);
  assert.equal(s.swipes, 1);
  assert.equal(s.candidates.length, 3);

  const s2 = applyAnswer(s, question({ tag: 'isSoup' }), 'any');
  assert.deepEqual(s2.weights, s.weights);
  assert.equal(s2.answered, 1);
  assert.equal(s2.swipes, 2);
});

test('show_if / hide_if', () => {
  assert.equal(conditionMet('hasDough=yes', { hasDough: 'yes' }), true);
  assert.equal(conditionMet('hasDough=yes', { hasDough: 'no' }), false);
  assert.equal(conditionMet('hasDough=yes', {}), false);
  assert.equal(conditionMet('cuisine:asian=no', { 'cuisine:asian': 'no' }), true);

  const base = startSession([dish()], 'meal', ANY_CUISINE, []);
  const dumpling = question({ tag: 'isDumpling', show_if: 'hasDough=yes' });
  const fried = question({ tag: 'isFried', hide_if: 'isSoup=yes' });
  assert.equal(isEligible(dumpling, base), false);
  assert.equal(isEligible(dumpling, { ...base, answers: { hasDough: 'yes' } }), true);
  assert.equal(isEligible(dumpling, { ...base, answers: { hasDough: 'any' } }), false);
  assert.equal(isEligible(fried, base), true);
  assert.equal(isEligible(fried, { ...base, answers: { isSoup: 'yes' } }), false);
  assert.equal(isEligible(fried, { ...base, answers: { isSoup: 'no' } }), true);
});

test('applies_to only restricts meal with a concrete cuisine; mode must match', () => {
  const q = question({ applies_to: 'asian;slavic' });
  const d = [dish({ cuisine: 'european' }), dish({ cuisine: 'asian' })];
  assert.equal(isEligible(q, startSession(d, 'meal', 'european', [])), false);
  assert.equal(isEligible(q, startSession(d, 'meal', 'asian', [])), true);
  assert.equal(isEligible(q, startSession(d, 'meal', ANY_CUISINE, [])), true);
  assert.equal(isEligible(question({ mode: 'snack' }), startSession(d, 'meal', ANY_CUISINE, [])), false);
});

test('pickNextQuestion: 15–85% window, closest to 50%, priority within 3%', () => {
  // Eight dishes, all still equally likely, so the leaders are the whole pool.
  const dishes = Array.from({ length: 8 }, (_, i) => dish({
    a: i < 1 ? 'yes' : 'no',   // 12.5% → skipped
    b: i < 7 ? 'yes' : 'no',   // 87.5% → skipped
    c: i < 3 ? 'yes' : 'no',   // 37.5%
    e: i < 4 ? 'yes' : 'no',   // 50%
  }));
  const s = startSession(dishes, 'meal', ANY_CUISINE, []);
  const qa = question({ tag: 'a', priority: 1 });
  const qb = question({ tag: 'b', priority: 1 });
  const qc = question({ tag: 'c', priority: 1 });
  const qe = question({ tag: 'e', priority: 5 });

  assert.equal(pickNextQuestion([qa, qb], s), null, 'nothing informative → no question');
  assert.equal(pickNextQuestion([qa, qb, qc], s)?.id, qc.id);
  assert.equal(pickNextQuestion([qc, qe], s)?.id, qe.id, 'exactly 50% beats 37.5%');
  assert.equal(pickNextQuestion([qc, qe], applyAnswer(s, qe, 'any'))?.id, qc.id, 'answered questions drop out');

  // Equal shares → the lower priority number wins.
  const even = Array.from({ length: 8 }, (_, i) => dish({ e: i < 4 ? 'yes' : 'no', f: i < 4 ? 'yes' : 'no' }));
  const qf = question({ tag: 'f', priority: 1 });
  assert.equal(pickNextQuestion([qe, qf], startSession(even, 'meal', ANY_CUISINE, []))?.id, qf.id);
});

test('pickNextQuestion asks a question that only splits the leaders, and falls back to the pool', () => {
  // 4 dishes of 100 are hot, and 2 of those 4 carry a trait almost nothing else has.
  const pool = Array.from({ length: 100 }, (_, i) => dish({
    isHot: i < 4 ? 'yes' : 'no',
    rare: i < 2 ? 'yes' : 'no',
    common: i % 2 === 0 ? 'yes' : 'no',
  }));
  const hot = question({ tag: 'isHot', priority: 1 });
  const rare = question({ tag: 'rare', priority: 1 });
  const common = question({ tag: 'common', priority: 1 });
  const s = applyAnswer(startSession(pool, 'meal', ANY_CUISINE, []), hot, 'yes');

  // Across the weighted pool «rare» is 13.6% — under the window, and previously discarded.
  // Among the leaders it splits them almost evenly, which is the only thing that can tell
  // the front-runners apart. This is the plov case: rice is rare, and decisive.
  assert.ok(yesShare(s, 'rare') < SHARE_MIN);
  assert.equal(pickNextQuestion([rare], s)?.id, rare.id);

  // When the leaders agree on everything, a question that splits the pool is still better
  // than ending the quiz — otherwise one answer would decide the whole session.
  const agreed = applyAnswer(startSession(pool, 'meal', ANY_CUISINE, []), rare, 'yes');
  assert.ok(pickNextQuestion([common], agreed) !== null);
});

test('any-valued dishes count half toward the yes share', () => {
  const dishes = [dish({ t: 'yes' }), dish({ t: 'any' }), dish({ t: 'no' }), dish({ t: 'no' })];
  const s = startSession(dishes, 'meal', ANY_CUISINE, []);
  // share = (1 + 0.5) / 4 = 37.5% → eligible
  assert.ok(pickNextQuestion([question({ tag: 't' })], s));
});

test('question limits and stop conditions', () => {
  assert.equal(questionLimit('meal', 'asian'), 7);
  assert.equal(questionLimit('meal', ANY_CUISINE), 8);
  assert.equal(questionLimit('snack', ANY_CUISINE), 5);
  assert.equal(questionLimit('dessert', ANY_CUISINE), 4);

  const many = Array.from({ length: 30 }, () => dish({ dishType: 'dessert' }));
  const s = startSession(many, 'dessert', ANY_CUISINE, []);
  assert.equal(shouldStop(s), false);
  assert.equal(shouldStop({ ...s, answered: 4, swipes: 4 }), true);
  assert.equal(shouldStop({ ...s, answered: 3, swipes: 9 }), true);
  assert.equal(shouldStop({ ...s, answered: 3, swipes: 8 }), false);

  const skewed: Session = { ...s, weights: s.weights.map((_, i) => (i < 3 ? 10 : 0.1)) };
  assert.ok(top3Share(skewed) > 0.7);
  assert.equal(shouldStop(skewed), true);
  assert.equal(shouldStop(startSession([dish()], 'meal', ANY_CUISINE, [])), true);
  assert.equal(shouldStop(startSession([], 'meal', ANY_CUISINE, [])), true);
});

test('randomizer: skips last 3 picks, falls back when pool is exhausted, respects allergens', () => {
  const pool = Array.from({ length: 5 }, () => dish());
  const recent = pool.slice(0, 3).map((d) => d.id);
  for (let seed = 1; seed < 50; seed++) {
    const d = pickRandomDish({ dishes: pool, excludeAllergens: [], recentIds: recent, likedIds: [], rejectedIds: [], rng: seeded(seed) });
    assert.ok(d && !recent.includes(d.id));
  }
  const two = pool.slice(0, 2);
  assert.ok(pickRandomDish({ dishes: two, excludeAllergens: [], recentIds: two.map((d) => d.id), likedIds: [], rejectedIds: [] }));
  const nutty = [dish({ allergens: ['nuts'] })];
  assert.equal(pickRandomDish({ dishes: nutty, excludeAllergens: ['nuts'], recentIds: [], likedIds: [], rejectedIds: [] }), null);
});

test('randomizer: liked cuisine ×1.2, rejected cuisine ×0.5', () => {
  const a = dish({ cuisine: 'asian' });
  const b = dish({ cuisine: 'slavic' });
  const count = (rejectedIds: string[], likedIds: string[]) => {
    let hitsA = 0;
    const rng = seeded(7);
    for (let i = 0; i < 20000; i++) {
      const d = pickRandomDish({ dishes: [a, b], excludeAllergens: [], recentIds: [], likedIds, rejectedIds, rng });
      if (d?.id === a.id) hitsA++;
    }
    return hitsA / 20000;
  };
  assert.ok(Math.abs(count([], []) - 0.5) < 0.02);
  assert.ok(Math.abs(count([], [a.id]) - 1.2 / 2.2) < 0.02);
  assert.ok(Math.abs(count([a.id], []) - 1 / 3) < 0.02);
  const a2 = dish({ cuisine: 'asian' });
  let hits = 0;
  const rng = seeded(11);
  for (let i = 0; i < 20000; i++) {
    const d = pickRandomDish({ dishes: [a, a2, b], excludeAllergens: [], recentIds: [], likedIds: [], rejectedIds: [a.id], rng });
    if (d?.cuisine === 'asian') hits++;
  }
  assert.ok(Math.abs(hits / 20000 - 1 / 2) < 0.02, 'both asian dishes are penalized');
});

test('real data: every question tag and condition resolves', () => {
  const dishes = loadDishes();
  const questions = loadQuestions();
  const columns = new Set(dishes.flatMap((d) => Object.keys(d)));
  const cuisines = new Set(dishes.map((d) => d.cuisine));
  const allergens = new Set(dishes.flatMap((d) => d.allergens));

  assert.ok(dishes.length >= 256);
  assert.equal(questions.length, 46);
  for (const d of dishes) assert.ok(['', 'generated'].includes(String(d.source ?? '')), d.id);
  const dessertTagIds = new Set(loadRawDessertTags().map((r) => r.id));
  for (const d of getCandidates(dishes, 'dessert', ANY_CUISINE, [])) assert.ok(dessertTagIds.has(d.id), `no dessert tags for ${d.id}`);
  assert.equal(new Set(dishes.map((d) => d.id)).size, dishes.length);

  for (const q of questions) {
    if (q.tag.startsWith('cuisine:')) assert.ok(cuisines.has(q.tag.slice(8)), q.id);
    else if (q.tag.startsWith('allergen:')) assert.ok(allergens.has(q.tag.slice(9)), q.id);
    else assert.ok(columns.has(q.tag), `${q.id}: no column ${q.tag}`);

    for (const cond of [q.show_if, q.hide_if]) {
      if (!cond) continue;
      const tag = cond.split('=')[0];
      assert.ok(questions.some((o) => o.mode === q.mode && o.tag === tag), `${q.id}: ${cond} has no question in ${q.mode}`);
    }
    if (q.applies_to !== 'all') for (const c of q.applies_to.split(';')) assert.ok(cuisines.has(c), `${q.id}: ${c}`);
  }
  // Sensations may be graded on the 0 / 0.25 / 0.5 / 0.75 / 1 ladder; facts stay yes/no/any.
  // 0.5 means «no information» to the engine, so it is only for genuinely ambiguous dishes.
  const GRADED = new Set(['isHeavy', 'isFatty', 'isSpicy', 'isSweet']);
  const LADDER = ['0', '0.25', '0.5', '0.75', '1'];
  for (const d of dishes) {
    for (const q of questions) {
      if (q.tag.includes(':')) continue;
      const raw = String(d[q.tag]);
      const allowed = GRADED.has(q.tag) ? [...LADDER, 'yes', 'no', 'any'] : ['yes', 'no', 'any'];
      assert.ok(allowed.includes(raw), `${d.id}.${q.tag}=${raw}`);
    }
  }
});

// ── Stage 1–3: lookahead, progress, undo, edge cases ─────────────────────────

function binaryPool(n: number, tags: string[]): Dish[] {
  return Array.from({ length: n }, (_, i) => dish(Object.fromEntries(tags.map((t, k) => [t, (i >> k) & 1 ? 'yes' : 'no']))));
}

test('getLookahead: last question when both yes and no stop the quiz', () => {
  const tags = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'];
  const qs = tags.map((tag, i) => question({ tag, priority: i }));
  let s = startSession(binaryPool(256, tags), 'meal', 'asian', []);
  let seen = 0;
  while (!isFinished(qs, s)) {
    const q = pickNextQuestion(qs, s)!;
    const la = getLookahead(qs, s, q);
    const willEnd = isFinished(qs, applyAnswer(s, q, 'yes')) && isFinished(qs, applyAnswer(s, q, 'no'));
    assert.equal(la.isLastQuestion, willEnd);
    if (la.isLastQuestion) { assert.equal(stackDepth(la), 0); seen++; }
    else assert.ok(la.remainingEstimate >= 2 && stackDepth(la) >= 1 && stackDepth(la) <= 2);
    s = applyAnswer(s, q, 'yes');
  }
  assert.equal(seen, 1);
});

test('getLookahead: answer limit — 7th answered question is last for a single cuisine', () => {
  const tags = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'];
  const qs = tags.map((tag) => question({ tag }));
  let s = startSession(binaryPool(512, tags), 'meal', 'asian', []);
  for (let i = 0; i < 6; i++) s = applyAnswer(s, pickNextQuestion(qs, s)!, 'yes');
  const la = getLookahead(qs, s, pickNextQuestion(qs, s)!);
  assert.equal(la.isLastQuestion, true);
});

test('getLookahead: "any" spends swipes but not answers', () => {
  const tags = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'];
  const qs = tags.map((tag) => question({ tag }));
  let s = startSession(binaryPool(512, tags), 'meal', 'asian', []);
  for (let i = 0; i < 6; i++) s = applyAnswer(s, pickNextQuestion(qs, s)!, 'any');
  const la = getLookahead(qs, s, pickNextQuestion(qs, s)!);
  assert.equal(la.remainingEstimate, 3); // 9 swipes − 6
  assert.equal(stackDepth(la), 2);
});

test('progress: capped at 0.95 while running, 1 at stop, never goes back', () => {
  const tags = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'];
  const qs = tags.map((tag) => question({ tag }));
  let s = startSession(binaryPool(256, tags), 'meal', ANY_CUISINE, []);
  let p = nextProgress(0, qs, s);
  const rng = seeded(5);
  while (!isFinished(qs, s)) {
    assert.ok(p <= 0.95);
    s = applyAnswer(s, pickNextQuestion(qs, s)!, (['yes', 'no', 'any'] as const)[Math.floor(rng() * 3)]);
    const np = nextProgress(p, qs, s);
    assert.ok(np >= p);
    p = np;
  }
  assert.equal(p, 1);
  assert.equal(progressValue(qs, s), 1);
  assert.equal(nextProgress(0.8, qs, startSession(binaryPool(256, tags), 'meal', ANY_CUISINE, [])), 0.8);
});

test('undoLast recomputes weights from scratch', () => {
  const tags = ['t0', 't1', 't2'];
  const qs = tags.map((tag) => question({ tag }));
  const s0 = startSession(binaryPool(8, tags), 'meal', ANY_CUISINE, []);
  const s1 = applyAnswer(s0, qs[0], 'yes');
  const s2 = applyAnswer(s1, qs[1], 'no');
  const s3 = applyAnswer(s2, qs[2], 'any');
  assert.deepEqual(undoLast(s3), s2);
  assert.deepEqual(undoLast(s2), s1);
  assert.deepEqual(undoLast(undoLast(s2)), s0);
  assert.equal(undoLast(s0), s0);
  assert.ok(isEligible(qs[1], undoLast(s2)));
});

// ── Stage 6: honest percent, threshold, all cuisines ─────────────────────────

const shown = (s: Session) => rankResults(s).dishes;

test('matchPercent: agree = 1, any = 0.5, against = 0; «Без разницы» ignored; nothing to count → null', () => {
  const qa = question({ tag: 'a' }), qb = question({ tag: 'b' }), qc = question({ tag: 'c' }), qd = question({ tag: 'd' });
  const d = dish({ a: 'yes', b: 'any', c: 'no', d: 'yes' });
  let s = startSession([d], 'meal', 'asian', []);
  s = applyAnswer(s, qa, 'yes');   // 1
  s = applyAnswer(s, qb, 'yes');   // 0.5
  s = applyAnswer(s, qc, 'yes');   // 0
  s = applyAnswer(s, qd, 'any');   // ignored
  assert.equal(matchPercent(d, s.log, 'meal'), 50);
  assert.equal(matchPercent(d, applyAnswer(startSession([d], 'meal', 'asian', []), qa, 'yes').log, 'meal'), 67,
    'one perfect answer is not a perfect match — the engine barely has evidence yet');
  assert.equal(matchPercent(d, applyAnswer(startSession([d], 'meal', 'asian', []), qd, 'any').log, 'meal'), null);
});

test('matchPercent: questions not applicable to the dish cuisine are ignored', () => {
  const q = question({ tag: 'isSpicy', applies_to: 'asian' });
  const slavic = dish({ cuisine: 'slavic', isSpicy: 'no' });
  const s = applyAnswer(startSession([slavic], 'meal', ANY_CUISINE, []), q, 'yes');
  assert.equal(matchPercent(slavic, s.log, 'meal'), null);
  assert.equal(s.weights[0], 1, 'weight untouched');
  assert.equal(appliesToDish('asian;slavic', slavic, 'meal'), true);
  assert.equal(appliesToDish('asian', slavic, 'snack'), true, 'applies_to only matters in meal');
});

test('rankResults: sorted by percent, ties by weight; percent never increases down the list', () => {
  const qs = ['a', 'b', 'c'].map((tag) => question({ tag }));
  // Percents are the shrunk ones: agreeing on all three answers reads 80%, never 100%.
  const pool = [
    dish({ id: 'p80', a: 'yes', b: 'yes', c: 'yes' }),
    dish({ id: 'p70', a: 'yes', b: 'yes', c: 'any' }),
    dish({ id: 'p60', a: 'yes', b: 'yes', c: 'no' }),
    dish({ id: 'p50', a: 'yes', b: 'any', c: 'no' }),
    dish({ id: 'p40', a: 'yes', b: 'no', c: 'no' }),
  ];
  let s = startSession(pool, 'meal', 'asian', []);
  for (const q of qs) s = applyAnswer(s, q, 'yes');
  const r = rankResults(s, 5);
  assert.deepEqual(r.dishes.map((d) => d.id), ['p80', 'p70', 'p60', 'p50'], 'p40 is below the threshold');
  assert.deepEqual(r.dishes.map((d) => d.matchPercent), [80, 70, 60, 50]);
  assert.deepEqual(rankResults(s).dishes.map((d) => d.id), ['p80', 'p70', 'p60']);
  assert.equal(r.exact, true);
  const all = rankResults(s, 10).dishes;
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].matchPercent! >= all[i].matchPercent!);
  assert.ok(all.every((d) => d.matchPercent! >= RESULT_MIN_PERCENT), 'nothing below 50% is shown');
});

test('rankResults: deterministic — same input, same order', () => {
  const pool = Array.from({ length: 8 }, () => dish({ w: 'yes' }));
  const s = applyAnswer(startSession(pool, 'meal', 'asian', []), question({ tag: 'w' }), 'yes');
  assert.deepEqual(shown(s).map((d) => d.id), shown(s).map((d) => d.id));
});

test('rankResults: nothing reaches 50% → top-1 with honest percent and exact = false', () => {
  const qs = ['a', 'b'].map((tag) => question({ tag }));
  const pool = [dish({ a: 'no', b: 'no' }), dish({ a: 'no', b: 'any' })];
  let s = startSession(pool, 'meal', 'asian', []);
  for (const q of qs) s = applyAnswer(s, q, 'yes');
  const r = rankResults(s);
  assert.equal(r.exact, false);
  assert.equal(r.dishes.length, 1);
  assert.equal(r.dishes[0].matchPercent, 38);
});

test('rankResults: one dish per cuisine for meal/any and snack, second of a cuisine only if it passed', () => {
  const q = question({ tag: 'w' });
  const mk = (cuisine: string, w: string) => dish({ cuisine, w, isSnack: 'yes' });
  const pool = [mk('asian', 'yes'), mk('asian', 'yes'), mk('asian', 'yes'), mk('slavic', 'yes'), mk('european', 'no')];
  const any = applyAnswer(startSession(pool, 'meal', ANY_CUISINE, []), q, 'yes');
  assert.deepEqual(shown(any).map((d) => d.cuisine).sort(), ['asian', 'asian', 'slavic'], 'european 0% not shown; second asian fills the gap');
  const snack = applyAnswer(startSession(pool, 'snack', ANY_CUISINE, []), q, 'yes');
  assert.equal(shown(snack).filter((d) => d.cuisine === 'asian').length, 2);
  const single = applyAnswer(startSession(pool, 'meal', 'asian', []), q, 'yes');
  assert.deepEqual(shown(single).map((d) => d.cuisine), ['asian', 'asian', 'asian']);
  const five = Array.from({ length: 5 }, () => mk('asian', 'yes'));
  assert.equal(shown(applyAnswer(startSession(five, 'meal', ANY_CUISINE, []), q, 'yes')).length, 2, 'at most two per cuisine');
});

test('allCuisinesResults: all cuisines, one per cuisine, 50% threshold, allergens, neutral foreign questions', () => {
  const spicy = question({ tag: 'isSpicy', applies_to: 'asian' });
  const meat = question({ tag: 'hasMeat' });
  const pool = [
    dish({ id: 'a1', cuisine: 'asian', isSpicy: 'yes', hasMeat: 'yes' }),
    dish({ id: 'a2', cuisine: 'asian', isSpicy: 'yes', hasMeat: 'yes' }),
    dish({ id: 's1', cuisine: 'slavic', isSpicy: 'no', hasMeat: 'yes' }),
    dish({ id: 'e1', cuisine: 'european', hasMeat: 'no' }),
    dish({ id: 'm1', cuisine: 'middle-east', hasMeat: 'yes', allergens: ['nuts'] }),
    dish({ id: 'x1', cuisine: 'slavic', dishType: 'dessert', hasMeat: 'yes' }),
  ];
  let s = startSession(pool, 'meal', 'asian', []);
  s = applyAnswer(s, spicy, 'yes');
  s = applyAnswer(s, meat, 'yes');
  const r = allCuisinesResults(pool, s.log, ['nuts']);
  assert.equal(new Set(r.dishes.map((d) => d.cuisine)).size, r.dishes.length, 'one per cuisine');
  assert.ok(r.dishes.some((d) => d.id === 's1'), 'spicy question is neutral for slavic dish');
  assert.equal(r.dishes.find((d) => d.id === 's1')!.matchPercent, 67);
  assert.ok(!r.dishes.some((d) => d.id === 'e1'), 'e1 0% not shown');
  assert.ok(!r.dishes.some((d) => d.id === 'm1'), 'allergen filtered');
  assert.ok(!r.dishes.some((d) => d.id === 'x1'), 'only mains');
});

test('edge: zero candidates after allergens → empty result', () => {
  const s = startSession([dish({ allergens: ['nuts'] })], 'meal', ANY_CUISINE, ['nuts']);
  assert.equal(s.candidates.length, 0);
  assert.equal(shouldStop(s), true);
  assert.deepEqual(rankResults(s), { dishes: [], exact: true });
});

test('edge: nine «Без разницы» → normal result without a percent', () => {
  const tags = Array.from({ length: 10 }, (_, i) => `t${i}`);
  const qs = tags.map((tag) => question({ tag }));
  let s = startSession(binaryPool(1024, tags), 'meal', ANY_CUISINE, []);
  while (!isFinished(qs, s)) s = applyAnswer(s, pickNextQuestion(qs, s)!, 'any');
  assert.equal(s.swipes, 9);
  const r = rankResults(s);
  assert.ok(r.dishes.length >= 1);
  assert.ok(r.dishes.every((d) => d.matchPercent === null));
});

test('edge: questions run out before the limit → finished with a result', () => {
  const qs = [question({ tag: 'a' })];
  let s = startSession(Array.from({ length: 10 }, (_, i) => dish({ a: i < 5 ? 'yes' : 'no' })), 'meal', 'asian', []);
  assert.equal(getLookahead(qs, s, qs[0]).isLastQuestion, true);
  s = applyAnswer(s, qs[0], 'yes');
  assert.equal(isFinished(qs, s), true);
  assert.ok(shown(s).length >= 1);
});

test('edge: one or two candidates → result without questions', () => {
  const qs = [question({ tag: 'a' })];
  for (const n of [1, 2]) {
    const s = startSession(Array.from({ length: n }, (_, i) => dish({ a: i ? 'yes' : 'no' })), 'meal', 'asian', []);
    assert.equal(isFinished(qs, s), true);
    assert.ok(shown(s).length >= 1);
  }
});

test('edge: percent is never NaN, negative or above 100', () => {
  const tags = ['t0', 't1', 't2', 't3', 't4'];
  const qs = tags.map((tag) => question({ tag }));
  const rng = seeded(21);
  for (let k = 0; k < 200; k++) {
    let s = startSession(binaryPool(32, tags), 'meal', 'asian', []);
    while (!isFinished(qs, s)) s = applyAnswer(s, pickNextQuestion(qs, s)!, (['yes', 'no', 'any'] as const)[Math.floor(rng() * 3)]);
    for (const d of rankResults(s, 32).dishes) {
      if (d.matchPercent === null) continue;
      assert.ok(Number.isFinite(d.matchPercent) && d.matchPercent >= 0 && d.matchPercent <= 100);
    }
  }
});

// ── Stage 9: p_yes model and calibration flag ────────────────────────────────

test('p_yes model reproduces the 0.9 / 0.1 / 0.5 weights exactly', () => {
  for (const tag of ['yes', 'no', 'any'] as const) {
    assert.equal(answerFactor('yes', TAG_P_YES[tag]), multiplier('yes', tag));
    assert.equal(answerFactor('no', TAG_P_YES[tag]), multiplier('no', tag));
  }
  assert.equal(answerFactor('any', 0.73), 1);
});

test('calibration is parsed but ignored while USE_CALIBRATED is off', () => {
  const d = dish({ isHot: 'yes', p_yes_calibrated: '{"isHot":0.62,"bad":7}' });
  assert.deepEqual(d.calibration, { isHot: 0.62 });
  assert.equal(USE_CALIBRATED, false);
  assert.equal(pYes(d, 'isHot'), 0.9);
  assert.equal(pYes(d, 'isHot', true), 0.62);
  assert.equal(pYes(d, 'hasMeat', true), 0.1, 'falls back to the tag');
});
