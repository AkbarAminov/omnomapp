import { normalizeDish } from '../src/logic/engine.ts';
import { createBattleSession, registerChoice, pairKey } from '../src/logic/battleEngine.ts';
const seeded = (s: number) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const pool = Array.from({ length: 16 }, (_, i) => normalizeDish({
  id: `d${i}`, name: 'x', dishType: 'main', allergens: [], image: 'http://img',
  cuisine: ['asian','slavic','european','fast-food'][i % 4],
  isSoup: i % 2 ? 'yes' : 'no', hasRice: i % 3 === 0 ? 'yes' : 'no',
  hasMeat: i % 2 ? 'no' : 'yes', isHeavy: i % 4 < 2 ? '1' : '0',
  prominence: i < 6 ? '1' : '0.25',
}));
let s = createBattleSession(pool, [], seeded(13));
let n = 0;
while (!s.winner && n < 8) {
  console.log(`раунд ${s.round}${s.isFinal ? ' (финал)' : ''}: ${s.pair![0].id} vs ${s.pair![1].id}  key=${pairKey(s.pair![0].id, s.pair![1].id)}`);
  s = registerChoice(s, s.pair![0].id);
  n++;
}
console.log('победитель:', s.winner?.id, '| choices:', s.choices.map(c => `${c.winnerId}>${c.loserId}`).join(', '));
