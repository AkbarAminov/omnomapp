import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALGORITHM_VERSION, applyAnswer, normalizeDish, normalizeQuestion, startSession, ANY_CUISINE } from '../src/logic/engine.ts';
import { buildSessionRows } from '../src/logic/sessionRows.ts';
import { smoothedPYes, MIN_ANSWERS } from '../scripts/calibrate.ts';

const d = normalizeDish({ id: 'd1', cuisine: 'asian', dishType: 'main', isHot: 'yes' });
const q1 = normalizeQuestion({ id: 'q1', mode: 'meal', tag: 'isHot', applies_to: 'all', priority: 1 });
const q2 = normalizeQuestion({ id: 'q2', mode: 'meal', tag: 'hasMeat', applies_to: 'all', priority: 1 });
const session = applyAnswer(applyAnswer(startSession([d], 'meal', ANY_CUISINE, []), q1, 'yes'), q2, 'any');

test('session rows: one per answered question, target from feedback', () => {
  const guessed = buildSessionRows('s1', session, 'd1', { guessed: true, targetDishId: null });
  assert.equal(guessed.length, 2);
  assert.deepEqual(guessed.map((r) => [r.question_id, r.answer, r.target_dish_id]), [['q1', 'yes', 'd1'], ['q2', 'any', 'd1']]);
  assert.equal(guessed[0].cuisine, 'all');
  assert.equal(buildSessionRows('s1', session, 'd1', { guessed: false, targetDishId: 'd9' })[0].target_dish_id, 'd9');
  assert.equal(buildSessionRows('s1', session, 'd1', { guessed: false, targetDishId: null })[0].target_dish_id, null);
  assert.equal(buildSessionRows('s1', session, 'd1', null)[0].target_dish_id, null);
});

test('session rows carry the algorithm version that produced them', () => {
  const rows = buildSessionRows('s1', session, 'd1', null);
  assert.ok(/^v\d+\.\d+$/.test(ALGORITHM_VERSION));
  assert.ok(rows.every((r) => r.algorithm_version === ALGORITHM_VERSION));
});

test('calibration smoothing pulls towards the hand-made tag and stays in [0, 1]', () => {
  assert.equal(MIN_ANSWERS, 20);
  assert.equal(smoothedPYes(20, 0, 0.9), 0.98);
  assert.equal(smoothedPYes(0, 20, 0.9), 0.15);
  assert.equal(smoothedPYes(10, 10, 0.5), 0.5);
});
