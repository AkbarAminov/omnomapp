// node scripts/genDishPhotos.ts [--limit 5] [--ids plov-01,samsa-04]
// Generates the missing dish photos from data/dish_image_manifest.csv with the Gemini image model
// («Nano Banana») and writes 400×400 webp into public/images/dishes/ — the same size and quality as
// the 60 existing photos. Safe to re-run: rows that already have a file or a photo are skipped.
// Key and model come from .env (GEMINI_API_KEY, GEMINI_IMAGE_MODEL); failures land in reports/.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadRawCsv, parseCsv } from './lib/csvData.ts';

const ROOT = path.join(import.meta.dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'dish_image_manifest.csv');
const FAILED = path.join(ROOT, 'reports', 'dish_images_failed.csv');

const DEFAULT_MODEL = 'gemini-nano-banana-2.1'; // current Nano Banana id per ai.google.dev, checked 2026-10-09
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'; // image models are v1beta-only
const CONCURRENCY = 5;
const ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 180_000;
// Retry-After on a 429 can come back in hours; waiting that out blind would hang the whole run,
// so the pause is capped and the next attempt just asks again.
const MAX_PAUSE_MS = 120_000;
const SIZE = 400;
const QUALITY = 82;

const style = (nameEn: string, description: string) =>
  `Appetizing professional food photograph of ${nameEn}: ${description} ` +
  'Authentic local presentation as served in Uzbekistan, on a simple ceramic plate or bowl, 45-degree angle, ' +
  'soft natural window light, shallow depth of field, warm neutral background, no people, no hands, no text, ' +
  'no watermark. Accurate traditional ingredients, realistic proportions.';
// The card crops to a square, so ask for square framing instead of cropping away half the plate.
const FRAMING = ' Square 1:1 composition, the dish centered and filling the frame.';

type Row = { id: string; name_en: string; description_en: string; target_path: string; has_image: string };

class HttpError extends Error {
  status: number;
  retryAfterMs: number;
  body: string;
  constructor(status: number, retryAfterMs: number, body: string) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.body = body;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readEnv(): Record<string, string> {
  return Object.fromEntries(
    fs.readFileSync(path.join(ROOT, '.env'), 'utf-8').split('\n')
      .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
}

function hasFile(row: Row): boolean {
  const base = path.join(ROOT, row.target_path).replace(/\.webp$/, '');
  return ['webp', 'png', 'jpg'].some((ext) => fs.existsSync(`${base}.${ext}`));
}

// Через файл, а не через stdin: на пайпе magick иногда вставал намертво, а синхронный вызов
// блокировал весь event loop, и вместе с ним остальные четыре воркера.
async function writeWebp(raw: Buffer, target: string, mimeType: string): Promise<void> {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // Расширение берём из ответа: по нему magick понимает формат (.raw он принял бы за свой headerless).
  const tmp = `${target}.tmp.${(mimeType.split('/')[1] || 'png').replace('jpeg', 'jpg')}`;
  fs.writeFileSync(tmp, raw);
  try {
    await promisify(execFile)('magick', [
      tmp, '-resize', `${SIZE}x${SIZE}^`, '-gravity', 'center', '-extent', `${SIZE}x${SIZE}`,
      '-quality', String(QUALITY), target,
    ], { timeout: 60_000 });
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  if (!fs.existsSync(target) || fs.statSync(target).size < 1024) {
    fs.rmSync(target, { force: true });
    throw new Error('magick produced no usable file');
  }
}

async function generate(row: Row, key: string, model: string): Promise<void> {
  const res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [{ parts: [{ text: style(row.name_en, row.description_en) + FRAMING }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });
  if (!res.ok) {
    const after = Number(res.headers.get('retry-after')) * 1000;
    throw new HttpError(res.status, Number.isFinite(after) ? after : 0, (await res.text()).replace(/\s+/g, ' '));
  }
  const json = await res.json();
  const image = json.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData?.data);
  // A refusal or a safety block comes back as a normal 200 with no image part.
  if (!image) throw new Error(`no image in response: ${JSON.stringify(json).replace(/\s+/g, ' ').slice(0, 200)}`);
  await writeWebp(Buffer.from(image.inlineData.data, 'base64'), path.join(ROOT, row.target_path), image.inlineData.mimeType ?? 'image/png');
}

// Rate limits are per key, so one 429 pauses every worker, not just the one that hit it.
let pausedUntil = 0;
// A free-tier key has a hard quota of 0 on image models — retrying that is pointless, so the run stops.
const outOfQuota = (message: string) => /free_tier/.test(message) && /limit: 0/.test(message);
let fatal: string | null = null;

async function run(rows: Row[], key: string, model: string): Promise<{ id: string; reason: string }[]> {
  const failed: { id: string; reason: string }[] = [];
  const queue = [...rows];
  let done = 0;

  const worker = async () => {
    for (let row = queue.shift(); row && !fatal; row = queue.shift()) {
      for (let attempt = 1; ; attempt++) {
        const pause = pausedUntil - Date.now();
        if (pause > 0) await sleep(pause);
        try {
          await generate(row, key, model);
          console.log(`✓ ${++done}/${rows.length} ${row.id}`);
          break;
        } catch (e) {
          const status = e instanceof HttpError ? e.status : 0;
          const reason = e instanceof Error ? e.message : String(e);
          if (e instanceof HttpError && status === 429 && outOfQuota(e.body)) fatal = reason;
          const retryable = !fatal && (status === 0 || status === 429 || status >= 500);
          if (!retryable || attempt === ATTEMPTS) {
            failed.push({ id: row.id, reason });
            console.log(`✗ ${++done}/${rows.length} ${row.id} — ${reason}`);
            break;
          }
          if (status === 429) {
            const wait = Math.min((e as HttpError).retryAfterMs || 30_000 * attempt, MAX_PAUSE_MS);
            pausedUntil = Math.max(pausedUntil, Date.now() + wait);
            console.log(`… rate limit, pausing ${Math.round(wait / 1000)}s (${row.id})`);
          } else {
            await sleep(2_000 * attempt);
          }
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));
  return failed;
}

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  return args[i].includes('=') ? args[i].split('=')[1] : args[i + 1];
};

const env = readEnv();
const key = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!key) throw new Error('GEMINI_API_KEY is empty — put the key in .env');
const model = process.env.GEMINI_IMAGE_MODEL || env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;

const all = parseCsv(fs.readFileSync(MANIFEST, 'utf-8')) as unknown as Row[];
const onlyIds = arg('ids')?.split(',').map((s) => s.trim()).filter(Boolean);
const limit = Number(arg('limit')) || 0;

// Источник правды — колонка image в omnom_dishes.csv: после заливки в storage локальных файлов
// не остаётся, и одного has_image из манифеста хватило бы, чтобы перегенерить всё заново.
const withPhoto = new Set(loadRawCsv('omnom_dishes.csv').filter((d) => d.image).map((d) => d.id));
const skipped = all.filter((r) => r.has_image === 'yes' || withPhoto.has(r.id) || hasFile(r));
let todo = all.filter((r) => !skipped.includes(r));
if (onlyIds) todo = todo.filter((r) => onlyIds.includes(r.id));
if (limit) todo = todo.slice(0, limit);

console.log(`manifest ${all.length} dishes: ${skipped.length} already with a photo, ${all.length - skipped.length} missing → generating ${todo.length} with ${model}`);
const failed = todo.length ? await run(todo, key, model) : [];

fs.writeFileSync(FAILED, ['id,reason', ...failed.map((f) => `${f.id},"${f.reason.replace(/"/g, '""')}"`)].join('\n') + '\n');
if (fatal) console.log('stopped: image generation needs a billing-enabled key — the free tier has a quota of 0 on image models');
console.log(`generated ${todo.length - failed.length}, failed ${failed.length}${failed.length ? ` → ${path.relative(ROOT, FAILED)}` : ''}`);
