// node scripts/noisyOne.ts <mode> <cuisine> — quick noisy-player check for one variant.
import { loadDishes, loadQuestions } from './lib/csvData.ts';
import { runNoisy } from './lib/noisy.ts';
import type { Mode } from '../src/logic/engine.ts';
const [mode = 'meal', cuisine = 'all'] = process.argv.slice(2);
let seed = 42;
const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const dishes = loadDishes(), questions = loadQuestions();
const out = [0, 1 / 10, 1 / 7, 1 / 5].map((p) => {
  const r = runNoisy(dishes, questions, { label: '', mode: mode as Mode, cuisine }, p, 10, rng);
  return `${(r.top3 * 100).toFixed(0)}%`;
});
const r0 = runNoisy(dishes, questions, { label: '', mode: mode as Mode, cuisine }, 0, 10, rng);
console.log(`${mode}/${cuisine}: топ-3 при p=0/⅒/⅐/⅕: ${out.join(' ')} · свайпов ${r0.swipes.toFixed(1)} · 1-е при p=0 ${(r0.first * 100).toFixed(0)}%`);
