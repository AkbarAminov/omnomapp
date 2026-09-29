import { applyAnswer, isFinished, pickNextQuestion, rankResults, startSession, matchPercent, traitValue, ANY_CUISINE } from '../src/logic/engine.ts';
import type { Answer, Mode } from '../src/logic/engine.ts';
import { loadDishes, loadQuestions } from '../scripts/lib/csvData.ts';
const dishes = loadDishes(), questions = loadQuestions();
const byId = new Map(dishes.map(d => [d.id, d]));
function trace(dishId: string, mode: Mode, cuisine: string, ans: Record<string, Answer>) {
  let s = startSession(dishes, mode, cuisine, []);
  const log: string[] = [];
  while (!isFinished(questions, s)) {
    const q = pickNextQuestion(questions, s)!;
    const a = ans[q.tag] ?? 'any';
    log.push(`${q.question_ru} [${q.tag}] → ${a}`);
    s = applyAnswer(s, q, a);
  }
  const t = byId.get(dishId)!;
  console.log(`\n### ${t.name}`);
  console.log(log.map(l => '  ' + l).join('\n'));
  const full = rankResults(s, s.candidates.length).dishes;
  console.log('  топ-5: ' + full.slice(0,5).map(d => `${d.name} ${d.matchPercent}%`).join(' | '));
  console.log(`  ${t.name}: ${matchPercent(t, s.log, mode)}%`);
  for (const e of s.log) {
    if (e.answer === 'any') continue;
    const win = full[0];
    console.log(`    ${e.tag.padEnd(12)} ответ=${e.answer.padEnd(3)} ${t.name}=${traitValue(t, e.tag)}  ${win.name}=${traitValue(win, e.tag)}`);
  }
}
const N='no' as Answer, Y='yes' as Answer, A='any' as Answer;
trace('plov-01','meal','central-asia',{isHeavy:Y,isFatty:Y,hasRice:Y,hasMeat:Y,isHot:Y,isSoup:N,hasDough:N,hasNoodles:N,isDumpling:N,isGrilled:N,isSteamed:N,isFried:N,hasSeafood:N,isWrap:N,isSweet:N,hasChicken:N,byHand:N,isFast:N,isSpicy:A,hasCheese:N,hasVeggies:N});
trace('olivier-277','meal','slavic',{isHeavy:N,isHot:N,hasVeggies:Y,hasMeat:Y,isFatty:Y,isSoup:N,hasDough:N,hasRice:N,hasNoodles:N,isDumpling:N,isGrilled:N,isSteamed:N,isFried:N,hasSeafood:N,isWrap:N,isSweet:N,hasChicken:A,byHand:N,isFast:A,hasCheese:N,isSpicy:N});
trace('hummus-04','snack',ANY_CUISINE,{'cuisine:middle-east':Y,isHeavy:N,isHot:N,byHand:Y,hasVeggies:A,isSpicy:N,hasMeat:N,hasSeafood:N,hasDough:N,hasCheese:N,isFried:N,hasChicken:N,isWrap:N,'cuisine:asian':N,'cuisine:fast-food':N,'cuisine:european':N});
