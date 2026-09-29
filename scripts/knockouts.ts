// node scripts/knockouts.ts — top dish×question pairs where a deviation (p = 1/7) knocked the target out of the results.
import { applyAnswer, getCandidates, isFinished, pickNextQuestion, rankResults, startSession, traitValue, ANY_CUISINE } from '../src/logic/engine.ts';
import type { Mode } from '../src/logic/engine.ts';
import { loadDishes, loadQuestions } from './lib/csvData.ts';
import { playerAnswer } from './lib/noisy.ts';
const dishes = loadDishes(), questions = loadQuestions();
let seed = 11; const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const variants: Array<[string, Mode, string]> = [
  ...['asian', 'central-asia', 'european', 'middle-east', 'slavic', 'fast-food'].map((c) => [`meal / ${c}`, 'meal' as Mode, c] as [string, Mode, string]),
  ['meal / любая кухня', 'meal', ANY_CUISINE], ['snack', 'snack', ANY_CUISINE], ['dessert', 'dessert', ANY_CUISINE],
];
const qName = new Map(questions.map((q) => [q.id, q.question_ru]));
for (const [label, mode, cuisine] of variants) {
  const pairs = new Map<string, number>();
  for (const t of getCandidates(dishes, mode, cuisine, [])) for (let r = 0; r < 10; r++) {
    let s = startSession(dishes, mode, cuisine, []); const dev: string[] = [];
    while (!isFinished(questions, s)) { const q = pickNextQuestion(questions, s)!; const a = playerAnswer(traitValue(t, q.tag), 1 / 7, rng); if (a.deviated) dev.push(q.id); s = applyAnswer(s, q, a.answer); }
    if (!rankResults(s).dishes.some((d) => d.id === t.id)) for (const id of dev) pairs.set(`${t.name} × ${qName.get(id)}`, (pairs.get(`${t.name} × ${qName.get(id)}`) ?? 0) + 1);
  }
  console.log(`${label}: ` + [...pairs].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k} (${n})`).join('; '));
}
