// node scripts/genImageManifest.ts → data/image_manifest.csv
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, imageTarget, loadRawDishes, loadRawQuestions } from './lib/csvData.ts';

const DISH_STYLE =
  'Warm food photography for the omnom app: single serving centered on a plain warm beige background (#FFF1DC), ' +
  'soft diffused daylight from the upper left, gentle shadows, top-down or 45° angle, realistic appetizing textures, ' +
  'square 1:1, no text, no logos, no hands, no cutlery clutter';
const QUESTION_STYLE =
  'omnom mascot illustration: round soft yellow-orange blob character with big friendly eyes, warm beige background (#FFF1DC), ' +
  'soft 3D clay look, gentle lighting, centered, square 1:1, no text';

const header = [
  '# Манифест картинок omnom. Сгенерирован `npm run gen:images` — не редактировать вручную.',
  `# Стиль блюд: ${DISH_STYLE}.`,
  `# Стиль вопросов: ${QUESTION_STYLE}.`,
  '# Готовый файл кладите в target_path (webp/png/jpg), затем npm run gen:sql — путь подставится в колонку image автоматически.',
];

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const rows: string[][] = [];

for (const d of loadRawDishes()) {
  rows.push([
    d.id, d.name, 'dish', d.image ? 'yes' : 'no', d.image, d.image ? '' : imageTarget('dishes', d.id),
    `${DISH_STYLE}. Dish: ${d.name} (${d.name_uz}) — ${d.description}`,
  ]);
}
for (const q of loadRawQuestions()) {
  rows.push([
    q.id, q.question_ru, 'question', q.image ? 'yes' : 'no', q.image, q.image ? '' : imageTarget('questions', q.id),
    `${QUESTION_STYLE}. Scene: ${q.icon_hint} (вопрос «${q.question_ru}»)`,
  ]);
}

const csv = [...header, 'id,name_ru,type,has_image,path,target_path,prompt', ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n';
const target = path.join(DATA_DIR, 'image_manifest.csv');
fs.writeFileSync(target, csv);
const missing = rows.filter((r) => r[3] === 'no');
console.log(`Wrote ${target}: ${rows.length} rows, missing images — dishes ${missing.filter((r) => r[2] === 'dish').length}, questions ${missing.filter((r) => r[2] === 'question').length}`);
