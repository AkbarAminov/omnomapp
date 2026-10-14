// node scripts/checkDishImages.ts
// Read-only отчёт: у каких блюд нет image_url, и у каких image_url задан, но реально не
// отвечает 200 (битая/удалённая ссылка). Данные НЕ меняет — только пишет reports/.
import fs from 'node:fs';
import path from 'node:path';
import { loadRawDishes } from './lib/csvData.ts';

const ROOT = path.join(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'reports', 'dish_images_report.md');
const CONCURRENCY = 4;
const TIMEOUT_MS = 8000;

// Supabase storage начинает отвечать 429, если бить по нему слишком параллельно — это
// самодиагностика, не битая картинка. Одна попытка повтора после паузы отличает одно от другого.
async function checkUrl(url: string, attempt = 0): Promise<number | 'error'> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      return checkUrl(url, attempt + 1);
    }
    return res.status;
  } catch {
    return 'error';
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const dishes = loadRawDishes();
  const missing: { id: string; name: string }[] = [];
  const broken: { id: string; name: string; image: string; status: number | 'error' }[] = [];

  let i = 0;
  async function worker() {
    while (i < dishes.length) {
      const row = dishes[i++];
      if (!row.image) { missing.push({ id: row.id, name: row.name }); continue; }
      const status = await checkUrl(row.image);
      if (status !== 200) broken.push({ id: row.id, name: row.name, image: row.image, status });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const lines = [
    `# Отчёт по фото блюд (${new Date().toISOString().slice(0, 10)})`,
    '',
    `Всего блюд: ${dishes.length}. Без \`image\`: ${missing.length}. Ссылка задана, но не 200: ${broken.length}.`,
    '',
    '## Без image_url',
    ...(missing.length ? missing.map((d) => `- \`${d.id}\` — ${d.name}`) : ['_(нет)_']),
    '',
    '## image_url задан, но не отвечает 200',
    ...(broken.length ? broken.map((d) => `- \`${d.id}\` — ${d.name} — ${d.image} — ${d.status}`) : ['_(нет)_']),
    '',
  ];
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`Готово: ${missing.length} без фото, ${broken.length} битых из ${dishes.length}. Отчёт: ${path.relative(ROOT, OUT)}`);
}

main();
