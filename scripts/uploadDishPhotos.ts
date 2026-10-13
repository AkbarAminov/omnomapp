// node scripts/uploadDishPhotos.ts [--keep-local]
// Заливает сгенерированные фото из public/images/dishes в Supabase storage (bucket dishes),
// проверяет каждый публичный адрес и проставляет его в data/omnom_dishes.csv → image.
// Дальше: npm run gen:sql и применить SQL в Supabase. Повторный запуск безопасен (upsert).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { loadRawCsv } from './lib/csvData.ts';

const ROOT = path.join(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'public', 'images', 'dishes');
const BUCKET = 'dishes';
const CONCURRENCY = 3; // на 8 Supabase отвечал «Too many connections issued to the database»

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env'), 'utf-8').split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const dishes = loadRawCsv('omnom_dishes.csv');
const dishIds = new Set(dishes.map((d) => d.id));
const withUrl = new Set(dishes.filter((d) => d.image).map((d) => d.id));
const onDisk = fs.readdirSync(DIR).filter((f) => f.endsWith('.webp'));
const unknown = onDisk.filter((f) => !dishIds.has(f.replace('.webp', '')));
if (unknown.length) throw new Error(`файлы без блюда в CSV: ${unknown.join(', ')}`);
// Адрес уже в CSV — значит файл залит и проверен; повтор заливает только остаток.
const files = onDisk.filter((f) => !withUrl.has(f.replace('.webp', '')));
console.log(`на диске ${onDisk.length}, уже в storage ${onDisk.length - files.length}, заливаем ${files.length}`);

const uploaded: Record<string, { image: string }> = {};
const failed: string[] = [];
let done = 0;

const queue = [...files];
const worker = async () => {
  for (let file = queue.shift(); file; file = queue.shift()) {
    const id = file.replace('.webp', '');
    try {
      const { error } = await db.storage.from(BUCKET).upload(file, fs.readFileSync(path.join(DIR, file)), {
        contentType: 'image/webp',
        upsert: true,
      });
      if (error) throw error;
      const url = db.storage.from(BUCKET).getPublicUrl(file).data.publicUrl;
      // Файл в бакете ≠ файл, доступный снаружи: политику или CDN проверяем настоящим запросом.
      const head = await fetch(url, { method: 'HEAD' });
      if (!head.ok) throw new Error(`публичный адрес отвечает ${head.status}`);
      uploaded[id] = { image: url };
      console.log(`✓ ${++done}/${files.length} ${id}`);
    } catch (e) {
      failed.push(id);
      console.log(`✗ ${++done}/${files.length} ${id} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
};
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));

if (Object.keys(uploaded).length) {
  const changed = execFileSync('python3', ['-c',
    "import sys,json; sys.path.insert(0,'scripts/lib'); from csvEdit import edit; print(edit('data/omnom_dishes.csv', json.load(sys.stdin)))",
  ], { input: JSON.stringify(uploaded), cwd: ROOT, encoding: 'utf-8' }).trim();
  console.log(`CSV: обновлено ячеек ${changed}`);
}

console.log(`залито ${Object.keys(uploaded).length}, ошибок ${failed.length}${failed.length ? `: ${failed.join(', ')}` : ''}`);
// Удаляем по свежему CSV, а не по списку залитого в этот заход: после дозаливки остаток уже
// был в storage, и копии на диске всё равно подлежат уборке.
if (!failed.length && !process.argv.includes('--keep-local')) {
  const inStorage = new Set(loadRawCsv('omnom_dishes.csv')
    .filter((d) => d.image.includes(`/storage/v1/object/public/${BUCKET}/`)).map((d) => d.id));
  const stale = onDisk.filter((f) => inStorage.has(f.replace('.webp', '')));
  for (const file of stale) fs.rmSync(path.join(DIR, file));
  console.log(`локальные копии удалены (${stale.length} файлов) — путь в CSV теперь ведёт в storage`);
}
console.log('дальше: npm run gen:sql и применить SQL в Supabase');
