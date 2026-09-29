// npm run calibrate — reads session_answers (service key from .env) and writes a smoothed «Да» share
// per dish×tag into data/omnom_dishes.csv → p_yes_calibrated (JSON). Used by the engine only with USE_CALIBRATED.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { TAG_P_YES, tagValue } from '../src/logic/engine.ts';
import { loadDishes, loadQuestions } from './lib/csvData.ts';

export const MIN_ANSWERS = 20;
export const PRIOR_WEIGHT = 4; // pseudo-answers pulling the estimate towards the hand-made tag

export function smoothedPYes(yes: number, no: number, prior: number): number {
  return Math.round(((yes + PRIOR_WEIGHT * prior) / (yes + no + PRIOR_WEIGHT)) * 100) / 100;
}

type Row = { question_id: string; answer: string; target_dish_id: string | null };

async function fetchAnswers(): Promise<Row[]> {
  const env = Object.fromEntries(
    fs.readFileSync(path.join(import.meta.dirname, '..', '.env'), 'utf-8').split('\n')
      .filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
  const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('session_answers').select('question_id, answer, target_dish_id')
      .not('target_dish_id', 'is', null).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (!data || data.length < 1000) return rows;
  }
}

if (import.meta.main ?? process.argv[1]?.endsWith('calibrate.ts')) {
  const dishes = new Map(loadDishes().map((d) => [d.id, d]));
  const tagOf = new Map(loadQuestions().map((q) => [q.id, q.tag]));
  const rows = await fetchAnswers();
  const counts = new Map<string, { yes: number; no: number }>();
  for (const r of rows) {
    const tag = tagOf.get(r.question_id);
    if (!tag || !r.target_dish_id || !dishes.has(r.target_dish_id) || r.answer === 'any') continue;
    const key = `${r.target_dish_id}|${tag}`;
    const c = counts.get(key) ?? { yes: 0, no: 0 };
    c[r.answer as 'yes' | 'no']++;
    counts.set(key, c);
  }
  const perDish = new Map<string, Record<string, number>>();
  const lines: string[] = [];
  for (const [key, c] of counts) {
    if (c.yes + c.no < MIN_ANSWERS) continue;
    const [dishId, tag] = key.split('|');
    const dish = dishes.get(dishId)!;
    const p = smoothedPYes(c.yes, c.no, TAG_P_YES[tagValue(dish, tag)]);
    perDish.set(dishId, { ...(perDish.get(dishId) ?? {}), [tag]: p });
    lines.push(`| ${dish.name} | \`${tag}\` | ${tagValue(dish, tag)} | ${c.yes} / ${c.no} | ${p} |`);
  }
  const changes = Object.fromEntries([...dishes.keys()].map((id) => [id, { p_yes_calibrated: perDish.has(id) ? JSON.stringify(perDish.get(id)) : '' }]));
  execFileSync('python3', ['-c', `import sys,json; sys.path.insert(0,'scripts/lib'); from csvEdit import edit; print(edit('data/omnom_dishes.csv', json.load(sys.stdin)))`],
    { input: JSON.stringify(changes), cwd: path.join(import.meta.dirname, '..'), stdio: ['pipe', 'inherit', 'inherit'] });
  fs.writeFileSync(path.join(import.meta.dirname, '..', 'reports', 'calibration.md'), [
    '# Калибровка по живым ответам', '', `Ответов с известным загаданным блюдом: ${rows.length}. Пар блюдо×тег с ≥ ${MIN_ANSWERS} ответами «Да/Нет»: ${lines.length}.`,
    `p_yes = (да + ${PRIOR_WEIGHT}·p_тега) / (да + нет + ${PRIOR_WEIGHT}). Включается флагом USE_CALIBRATED в src/logic/engine.ts, затем npm run gen:sql.`, '',
    '| блюдо | тег | ручной тег | да / нет | p_yes |', '|---|---|---|---|---|', ...lines, '',
  ].join('\n'));
  console.log(`calibrated pairs: ${lines.length} (answers with target: ${rows.length}) → reports/calibration.md`);
}
