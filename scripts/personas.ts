// node scripts/personas.ts — прогоняет «загаданные блюда» через движок и пишет
// reports/personas.md и reports/personas.csv.
//
// Ответы написаны от лица человека, который хочет конкретное блюдо, а НЕ списаны с
// тегов этого блюда: иначе тест проверял бы сам себя. Там, где человеку в жизни
// безразлично, стоит 'any' — так же, как он свайпнул бы «неважно» в приложении.
import fs from 'node:fs';
import path from 'node:path';
import {
  applyAnswer, isFinished, matchPercent, pickNextQuestion, rankResults, startSession, ANY_CUISINE,
} from '../src/logic/engine.ts';
import type { Answer, Mode } from '../src/logic/engine.ts';
import { loadDishes, loadQuestions } from './lib/csvData.ts';

type Persona = {
  dishId: string;
  mode: Mode;
  cuisine: string;
  answers: Record<string, Answer>;
};

const Y: Answer = 'yes', N: Answer = 'no', A: Answer = 'any';

const PERSONAS: Persona[] = [
  { dishId: 'plov-01', mode: 'meal', cuisine: 'central-asia', answers: {
    isHeavy: Y, isFatty: Y, hasRice: Y, hasMeat: Y, isHot: Y, isSoup: N, hasDough: N,
    hasNoodles: N, isDumpling: N, isGrilled: N, isSteamed: N, isFried: N, hasSeafood: N,
    isWrap: N, isSweet: N, hasChicken: N, byHand: N, isFast: N, isSpicy: A, hasCheese: N, hasVeggies: N } },

  { dishId: 'manti-03', mode: 'meal', cuisine: 'central-asia', answers: {
    isHeavy: Y, hasDough: Y, isSteamed: Y, hasMeat: Y, isDumpling: Y, isHot: Y, isFatty: Y,
    hasRice: N, hasNoodles: N, isSoup: N, isGrilled: N, isFried: N, byHand: A, isSpicy: N,
    hasSeafood: N, isWrap: N, isSweet: N, hasChicken: N, isFast: N, hasCheese: N, hasVeggies: N } },

  { dishId: 'shashlik-05', mode: 'meal', cuisine: 'central-asia', answers: {
    hasMeat: Y, isGrilled: Y, isHeavy: Y, isFatty: Y, isHot: Y, byHand: Y, isSoup: N,
    hasDough: N, hasRice: N, hasNoodles: N, isDumpling: N, isSteamed: N, isFried: N,
    hasSeafood: N, isWrap: N, isSweet: N, hasChicken: N, isSpicy: A, isFast: N, hasCheese: N, hasVeggies: N } },

  { dishId: 'lagman-02', mode: 'meal', cuisine: 'central-asia', answers: {
    hasNoodles: Y, isSoup: Y, hasMeat: Y, isHot: Y, isHeavy: Y, isFatty: Y, isSpicy: A,
    hasRice: N, hasDough: N, isDumpling: N, isGrilled: N, isSteamed: N, isFried: N,
    hasSeafood: N, isWrap: N, isSweet: N, hasChicken: N, byHand: N, isFast: N, hasCheese: N, hasVeggies: A } },

  { dishId: 'borsch-01', mode: 'meal', cuisine: 'slavic', answers: {
    isSoup: Y, isHot: Y, hasMeat: Y, hasVeggies: Y, isHeavy: A, isFatty: N, hasRice: N,
    hasDough: N, hasNoodles: N, isDumpling: N, isGrilled: N, isSteamed: N, isFried: N,
    hasSeafood: N, isWrap: N, isSweet: N, hasChicken: N, byHand: N, isFast: N, hasCheese: N, isSpicy: N } },

  { dishId: 'pelmeni-02', mode: 'meal', cuisine: 'slavic', answers: {
    isDumpling: Y, hasDough: Y, hasMeat: Y, isHot: Y, isHeavy: Y, isSoup: N, hasRice: N,
    hasNoodles: N, isSteamed: N, isGrilled: N, isFried: N, isFatty: A, hasSeafood: N,
    isWrap: N, isSweet: N, hasChicken: N, byHand: N, isFast: A, hasCheese: N, hasVeggies: N, isSpicy: N } },

  { dishId: 'olivier-277', mode: 'meal', cuisine: 'slavic', answers: {
    isHeavy: N, isHot: N, hasVeggies: Y, hasMeat: Y, isFatty: Y, isSoup: N, hasDough: N,
    hasRice: N, hasNoodles: N, isDumpling: N, isGrilled: N, isSteamed: N, isFried: N,
    hasSeafood: N, isWrap: N, isSweet: N, hasChicken: A, byHand: N, isFast: A, hasCheese: N, isSpicy: N } },

  { dishId: 'pizza-pepperoni-10', mode: 'meal', cuisine: 'european', answers: {
    hasDough: Y, hasCheese: Y, isHeavy: Y, isFatty: Y, byHand: Y, isHot: Y, hasMeat: Y,
    isSpicy: A, isSoup: N, hasRice: N, hasNoodles: N, isDumpling: N, isGrilled: N,
    isSteamed: N, isFried: N, hasSeafood: N, isWrap: N, isSweet: N, hasChicken: N, isFast: A, hasVeggies: N } },

  { dishId: 'carbonara-01', mode: 'meal', cuisine: 'european', answers: {
    hasNoodles: Y, hasCheese: Y, isFatty: Y, isHeavy: Y, isHot: Y, hasMeat: Y, isSoup: N,
    hasRice: N, hasDough: N, isDumpling: N, isGrilled: N, isSteamed: N, isFried: N,
    hasSeafood: N, isWrap: N, isSweet: N, hasChicken: N, byHand: N, isFast: N, hasVeggies: N, isSpicy: N } },

  { dishId: 'ribeye-steak-144', mode: 'meal', cuisine: 'european', answers: {
    hasMeat: Y, isGrilled: Y, isHeavy: Y, isFatty: Y, isHot: Y, hasRice: N, hasDough: N,
    hasNoodles: N, isSoup: N, isDumpling: N, isSteamed: N, isFried: N, hasSeafood: N,
    isWrap: N, isSweet: N, hasChicken: N, byHand: N, isFast: N, hasCheese: N, hasVeggies: N, isSpicy: N } },

  { dishId: 'sushi-01', mode: 'meal', cuisine: 'asian', answers: {
    hasRice: Y, hasSeafood: Y, isHot: N, isHeavy: N, isFatty: N, byHand: A, isSoup: N,
    hasDough: N, hasNoodles: N, isDumpling: N, isGrilled: N, isSteamed: N, isFried: N,
    isWrap: N, isSweet: N, hasMeat: N, hasChicken: N, isFast: A, hasCheese: N, hasVeggies: N, isSpicy: N } },

  { dishId: 'ramen-02', mode: 'meal', cuisine: 'asian', answers: {
    hasNoodles: Y, isSoup: Y, isHot: Y, hasMeat: Y, isHeavy: Y, isFatty: A, hasRice: N,
    hasDough: N, isDumpling: N, isGrilled: N, isSteamed: N, isFried: N, hasSeafood: N,
    isWrap: N, isSweet: N, hasChicken: N, byHand: N, isFast: N, hasCheese: N, hasVeggies: N, isSpicy: A } },

  { dishId: 'tom-yum-432', mode: 'meal', cuisine: 'asian', answers: {
    isSoup: Y, isSpicy: Y, isHot: Y, hasSeafood: Y, isHeavy: N, isFatty: N, hasRice: N,
    hasDough: N, hasNoodles: N, isDumpling: N, isGrilled: N, isSteamed: N, isFried: N,
    hasMeat: N, isWrap: N, isSweet: N, hasChicken: N, byHand: N, isFast: N, hasCheese: N, hasVeggies: A } },

  { dishId: 'burger-01', mode: 'meal', cuisine: 'fast-food', answers: {
    hasMeat: Y, byHand: Y, isFatty: Y, isHeavy: Y, isFast: Y, isHot: Y, hasCheese: A,
    hasDough: N, isSoup: N, hasRice: N, hasNoodles: N, isDumpling: N, isGrilled: A,
    isSteamed: N, isFried: N, hasSeafood: N, isWrap: N, isSweet: N, hasChicken: N, hasVeggies: N, isSpicy: N } },

  { dishId: 'adana-kebab-220', mode: 'meal', cuisine: 'middle-east', answers: {
    hasMeat: Y, isGrilled: Y, isSpicy: Y, isHeavy: Y, isFatty: Y, isHot: Y, isSoup: N,
    hasDough: N, hasRice: N, hasNoodles: N, isDumpling: N, isSteamed: N, isFried: N,
    hasSeafood: N, isWrap: A, isSweet: N, hasChicken: N, byHand: A, isFast: N, hasCheese: N, hasVeggies: N } },

  { dishId: 'hummus-04', mode: 'snack', cuisine: ANY_CUISINE, answers: {
    'cuisine:middle-east': Y, isHeavy: N, isHot: N, byHand: Y, hasVeggies: A, isSpicy: N,
    hasMeat: N, hasSeafood: N, hasDough: N, hasCheese: N, isFried: N, hasChicken: N,
    isWrap: N, 'cuisine:asian': N, 'cuisine:fast-food': N, 'cuisine:european': N } },

  { dishId: 'tiramisu-16', mode: 'dessert', cuisine: ANY_CUISINE, answers: {
    isCreamy: Y, hasChocolate: A, isFruity: N, isFrozen: N, isHot: N, byHand: N,
    'allergen:nuts': N, 'cuisine:middle-east': N, 'cuisine:slavic': N } },
];

const dishes = loadDishes();
const questions = loadQuestions();
const byId = new Map(dishes.map((d) => [d.id, d]));

type Row = {
  name: string; cuisine: string; mode: Mode; asked: number; answered: number;
  place: number | null; rawPlace: number; of: number; top1: boolean; top3: boolean;
  pct: number | null; winner: string; note: string;
};

const rows: Row[] = [];
for (const p of PERSONAS) {
  const target = byId.get(p.dishId);
  if (!target) throw new Error(`нет блюда ${p.dishId}`);
  let s = startSession(dishes, p.mode, p.cuisine, []);
  const asked: string[] = [];
  while (!isFinished(questions, s)) {
    const q = pickNextQuestion(questions, s)!;
    asked.push(q.tag);
    s = applyAnswer(s, q, p.answers[q.tag] ?? 'any');
  }
  // Что человек реально видит: с отсечкой по проценту и, в режимах закусок и «любой
  // кухни», с правилом «одно блюдо на кухню».
  const full = rankResults(s, s.candidates.length).dishes;
  const idx = full.findIndex((d) => d.id === target.id);

  // Чистый рейтинг по совпадению, без отсечек — чтобы отличить «проиграл по очкам»
  // от «вытеснен правилом разнообразия».
  const raw = s.candidates
    .map((d, i) => ({ d, pct: matchPercent(d, s.log, s.mode) ?? -1, w: s.weights[i] }))
    .sort((a, b) => b.pct - a.pct || b.w - a.w || b.d.prominence - a.d.prominence
      || a.d.id.localeCompare(b.d.id))
    .findIndex((x) => x.d.id === target.id) + 1;

  rows.push({
    name: target.name,
    cuisine: target.cuisine,
    mode: p.mode,
    asked: asked.length,
    answered: s.answered,
    place: idx >= 0 ? idx + 1 : null,
    rawPlace: raw,
    of: s.candidates.length,
    top1: idx === 0,
    top3: idx >= 0 && idx < 3,
    pct: matchPercent(target, s.log, s.mode),
    winner: full[0]?.name ?? '—',
    note: idx >= 0 ? '' : (raw <= 3 ? 'вытеснено правилом «одно блюдо на кухню»' : 'проиграло по очкам'),
  });
}

const top1 = rows.filter((r) => r.top1).length;
const top3 = rows.filter((r) => r.top3).length;
const avgQ = (rows.reduce((a, r) => a + r.asked, 0) / rows.length).toFixed(1);

const md = [
  '# Точность подбора: загаданные блюда',
  '',
  `Сгенерировано \`node scripts/personas.ts\`. Блюд: ${rows.length}.`,
  '',
  'Ответы написаны от лица человека, который хочет конкретное блюдо, а не списаны с тегов',
  'этого блюда — иначе тест проверял бы собственную разметку. Там, где человеку в жизни',
  'безразлично, стоит «неважно».',
  '',
  `**Топ-1: ${top1} из ${rows.length} (${Math.round((100 * top1) / rows.length)}%)** · ` +
  `**Топ-3: ${top3} из ${rows.length} (${Math.round((100 * top3) / rows.length)}%)** · ` +
  `вопросов в среднем: ${avgQ}`,
  '',
  '| Блюдо | Кухня | Режим | Вопросов | Место в выдаче | По совпадению | Топ-1 | Топ-3 | Совпадение | Кто победил |',
  '|---|---|---|---|---|---|:-:|:-:|---|---|',
  ...rows.map((r) => `| ${r.name} | ${r.cuisine} | ${r.mode} | ${r.asked} | ` +
    `${r.place ?? `не показано — ${r.note}`} | ${r.rawPlace} из ${r.of} | ` +
    `${r.top1 ? '✅' : '—'} | ${r.top3 ? '✅' : '—'} | ${r.pct ?? '—'}% | ${r.winner} |`),
  '',
].join('\n');

const csv = [
  'dish,cuisine,mode,questions,place_shown,place_by_match,candidates,top1,top3,match_percent,winner,note',
  ...rows.map((r) => [
    `"${r.name}"`, r.cuisine, r.mode, r.asked, r.place ?? '', r.rawPlace, r.of,
    r.top1 ? 1 : 0, r.top3 ? 1 : 0, r.pct ?? '', `"${r.winner}"`, `"${r.note}"`,
  ].join(',')),
].join('\n');

const out = path.join(import.meta.dirname, '..', 'reports');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'personas.md'), md);
fs.writeFileSync(path.join(out, 'personas.csv'), csv + '\n');
console.log(md);
console.log(`→ reports/personas.md, reports/personas.csv`);
