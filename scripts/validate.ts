// node scripts/validate.ts — data coverage, random-session simulation, per-question report (reports/questions.md).
import fs from 'node:fs';
import path from 'node:path';
import {
  ANY_CUISINE, applyAnswer, isFinished, pickNextQuestion, rankResults, SHARE_MAX, SHARE_MIN, startSession, tagValue,
  top3Share, yesShare,
} from '../src/logic/engine.ts';
import type { Answer, Dish, Mode, Question } from '../src/logic/engine.ts';
import { loadDishes, loadQuestions } from './lib/csvData.ts';
import { runNoisy } from './lib/noisy.ts';
import type { NoisyResult, QuestionNoiseStat } from './lib/noisy.ts';

const RUNS = 1000;
const CUISINES = ['asian', 'central-asia', 'european', 'middle-east', 'slavic', 'fast-food'];
const MIN_DISTINCT: Record<Mode, number> = { meal: 10, snack: 15, dessert: 8 };
const MAX_FIRST_SHARE = 0.2;
const RARE_ASK_RATE = 0.05;
const ANSWERS: Answer[] = ['yes', 'no', 'any'];

const dishes = loadDishes();
const questions = loadQuestions();

type Variant = { label: string; mode: Mode; cuisine: string };
const variants: Variant[] = [
  ...CUISINES.map((c) => ({ label: `meal / ${c}`, mode: 'meal' as Mode, cuisine: c })),
  { label: 'meal / любая кухня', mode: 'meal', cuisine: ANY_CUISINE },
  { label: 'snack', mode: 'snack', cuisine: ANY_CUISINE },
  { label: 'dessert', mode: 'dessert', cuisine: ANY_CUISINE },
];

let seed = 42;
const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// One stream per (variant, noise level): editing one cuisine's data must not move another's
// numbers. With a single shared stream it did, and differences of a few points were noise.
function streamFor(key: string): () => number {
  let s = 0;
  for (const ch of key) s = (s * 31 + ch.charCodeAt(0)) % 2147483647;
  s = (s % 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

type QStat = { asked: number; gainSum: number; gainN: number };

function simulate(v: Variant) {
  const rng = streamFor(`coverage:${v.label}`);
  const firsts = new Map<string, number>();
  const stats = new Map<string, QStat>();
  let swipes = 0;
  for (let i = 0; i < RUNS; i++) {
    let s = startSession(dishes, v.mode, v.cuisine, []);
    while (!isFinished(questions, s)) {
      const q = pickNextQuestion(questions, s)!;
      const answer = ANSWERS[Math.floor(rng() * 3)];
      const before = top3Share(s);
      s = applyAnswer(s, q, answer);
      const st = stats.get(q.id) ?? { asked: 0, gainSum: 0, gainN: 0 };
      st.asked++;
      if (answer !== 'any') { st.gainSum += top3Share(s) - before; st.gainN++; }
      stats.set(q.id, st);
    }
    swipes += s.swipes;
    const top = rankResults(s).dishes;
    if (top[0]) firsts.set(top[0].id, (firsts.get(top[0].id) ?? 0) + 1);
  }
  return { firsts, stats, avgSwipes: swipes / RUNS };
}

function appliesTo(q: Question, v: Variant): boolean {
  if (q.mode !== v.mode) return false;
  if (v.mode !== 'meal' || v.cuisine === ANY_CUISINE || q.applies_to === 'all') return true;
  return q.applies_to.split(';').includes(v.cuisine);
}

function rareReason(q: Question, share: number): string {
  if (q.show_if) return `открывается только после ${q.show_if}; на старте yes-доля ${pct(share)}`;
  if (share < SHARE_MIN) return `на старте yes-доля ${pct(share)} < 15% — почти у всех кандидатов «нет»`;
  if (share > SHARE_MAX) return `на старте yes-доля ${pct(share)} > 85% — почти у всех кандидатов «да»`;
  if (q.show_if) return `открывается только после ${q.show_if}`;
  return `проходит порог, но проигрывает вопросам ближе к 50% (priority ${q.priority})`;
}

const name = (id: string) => dishes.find((d) => d.id === id)?.name ?? id;
const summary: string[] = [];
const md: string[] = [
  '# Отчёт по вопросам',
  '',
  `Сгенерирован \`npm run validate\`: ${RUNS} случайных сессий на вариант, ответы Да/Нет/Без разницы равновероятны.`,
  '',
  '- **yes-доля** — доля веса кандидатов с yes (any = половина) на старте; вопрос задаётся только при 15–85%.',
  '- **задаётся** — в скольких сессиях вопрос реально задан.',
  '- **прирост** — средний рост доли топ-3 после ответа Да/Нет (в процентных пунктах); выше = вопрос сильнее сужает выбор.',
  '',
];
const rare: string[] = [];
let failures = 0;

for (const v of variants) {
  const start = startSession(dishes, v.mode, v.cuisine, []);
  const pool = start.candidates as Dish[];
  const { firsts, stats, avgSwipes } = simulate(v);

  const hot = [...firsts].filter(([, n]) => n / RUNS > MAX_FIRST_SHARE).sort((a, b) => b[1] - a[1]);
  const never = pool.filter((d) => !firsts.has(d.id));
  const distinct = firsts.size;
  const target = MIN_DISTINCT[v.mode];
  const pass = distinct >= target && hot.length === 0;
  if (!pass) failures++;

  md.push(`## ${v.label} — кандидатов ${pool.length}, в среднем свайпов ${avgSwipes.toFixed(1)}`, '');
  md.push('| вопрос | тег | yes / no / any | yes-доля | задаётся | прирост |', '|---|---|---|---|---|---|');
  for (const q of questions.filter((x) => x.mode === v.mode)) {
    const applies = appliesTo(q, v);
    const counts = { yes: 0, no: 0, any: 0 };
    for (const d of pool) counts[tagValue(d, q.tag)]++;
    const share = yesShare(start, q.tag);
    const st = stats.get(q.id);
    const askRate = (st?.asked ?? 0) / RUNS;
    const gain = st && st.gainN ? (st.gainSum / st.gainN) * 100 : 0;
    const flag = !applies ? '—' : share < SHARE_MIN || share > SHARE_MAX ? '⚠️' : '';
    md.push(
      `| ${q.question_ru} \`${q.id}\` | \`${q.tag}\` | ${counts.yes} / ${counts.no} / ${counts.any} | ${applies ? pct(share) : '—'} ${flag} | ${pct(askRate)} | ${gain.toFixed(1)} п.п. |`,
    );
    if (applies && askRate < RARE_ASK_RATE) {
      rare.push(`| ${v.label} | ${q.question_ru} \`${q.id}\` | ${pct(askRate)} | ${rareReason(q, share)} |`);
    }
  }
  const top5 = [...firsts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `${name(id)} ${pct(n / RUNS)}`);
  md.push('', `Разных блюд на 1-м месте: **${distinct}** (цель ≥ ${target}) · чаще 20%: ${hot.length ? hot.map(([id, n]) => `${name(id)} ${pct(n / RUNS)}`).join(', ') : 'нет'}`);
  md.push(`Топ-5 первых мест: ${top5.join(', ')}`);
  md.push(`Никогда не на 1-м месте (${never.length}): ${never.map((d) => d.name).join(', ') || '—'}`, '');

  summary.push(
    `${v.label.padEnd(22)} кандидатов ${String(pool.length).padStart(3)}  свайпов ${avgSwipes.toFixed(1)}  разных №1 ${String(distinct).padStart(3)}/${target}  >20%: ${hot.length}  никогда: ${String(never.length).padStart(3)}  ${pass ? 'OK' : 'FAIL'}`,
  );
}

md.push('## Редко задаваемые вопросы (< 5% сессий там, где применимы)', '', '| вариант | вопрос | задаётся | причина |', '|---|---|---|---|', ...rare, '');

const REPORTS = path.join(import.meta.dirname, '..', 'reports');
fs.mkdirSync(REPORTS, { recursive: true });
fs.writeFileSync(path.join(REPORTS, 'questions.md'), md.join('\n'));

// ── Target dish + noisy player ────────────────────────────────────────────────
const NOISE_LEVELS: Array<[string, number]> = [['0', 0], ['1/10', 1 / 10], ['1/7', 1 / 7], ['1/5', 1 / 5]];
const NOISY_RUNS = 6;
const KNOCKOUT_P = '1/7';
const writeBaseline = process.argv.includes('--baseline');
const baselinePath = path.join(REPORTS, 'baseline.json');
const baseline: Record<string, Record<string, NoisyResult>> | null =
  !writeBaseline && fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf-8')) : null;

const noisy: Record<string, Record<string, NoisyResult>> = {};
const qNoise = new Map<string, QuestionNoiseStat>();
for (const v of variants) {
  noisy[v.label] = {};
  for (const [label, p] of NOISE_LEVELS) {
    noisy[v.label][label] = runNoisy(
      dishes, questions, v, p, NOISY_RUNS, streamFor(`noisy:${v.label}:${label}`),
      label === KNOCKOUT_P ? qNoise : undefined,
    );
  }
}

const delta = (now: number, was: number | undefined) =>
  was === undefined ? '' : ` (${now - was >= 0 ? '+' : ''}${((now - was) * 100).toFixed(0)})`;
const nm: string[] = [
  writeBaseline ? '# Базовая линия: загаданное блюдо + шумный игрок' : '# Загаданное блюдо + шумный игрок',
  '',
  `Для каждого блюда-кандидата ${NOISY_RUNS} сессий. Игрок отвечает по тегам загаданного блюда; при теге yes/no с вероятностью p отвечает иначе`,
  '(противоположно или «Без разницы», поровну); при теге any — случайно да/нет/без разницы.',
  '**топ-3** — блюдо есть в показанной выдаче; **1-е** — показано первым; **макс. №1** — доля сессий у самого частого первого блюда.',
  baseline ? 'В скобках — изменение в п.п. относительно reports/baseline.md.' : '',
  '',
  '| вариант | p | 1-е | топ-3 | свайпов | макс. №1 |',
  '|---|---|---|---|---|---|',
];
for (const v of variants) {
  for (const [label] of NOISE_LEVELS) {
    const r = noisy[v.label][label];
    const b = baseline?.[v.label]?.[label];
    nm.push(`| ${v.label} | ${label} | ${pct(r.first)}${delta(r.first, b?.first)} | **${pct(r.top3)}**${delta(r.top3, b?.top3)} | ${r.swipes.toFixed(1)}${b ? ` (${b.swipes.toFixed(1)})` : ''} | ${pct(r.maxFirstShare)} ${r.maxFirstDish} |`);
  }
}

nm.push('', `## Вопросы (p = ${KNOCKOUT_P}, все варианты)`, '',
  '**yes-доля на старте** по вариантам meal (asian / c-asia / euro / m-east / slavic / fast / любая) и snack, dessert; **задан** — сколько раз задан; **выбил** — сколько раз ответ игрока на этом вопросе разошёлся с тегом, а загаданное блюдо не попало в выдачу.', '',
  '| вопрос | тег | yes-доля на старте | задан | выбил |', '|---|---|---|---|---|');
const starts = new Map(variants.map((v) => [v.label, startSession(dishes, v.mode, v.cuisine, [])]));
for (const q of [...questions].sort((a, b) => (qNoise.get(b.id)?.knockouts ?? 0) - (qNoise.get(a.id)?.knockouts ?? 0))) {
  const shares = variants
    .filter((v) => v.mode === q.mode)
    .map((v) => (appliesTo(q, v) ? pct(yesShare(starts.get(v.label)!, q.tag)) : '—'))
    .join(' / ');
  const st = qNoise.get(q.id) ?? { asked: 0, knockouts: 0 };
  nm.push(`| ${q.question_ru} \`${q.id}\` | \`${q.tag}\` | ${shares} | ${st.asked} | ${st.knockouts} |`);
}

fs.writeFileSync(path.join(REPORTS, writeBaseline ? 'baseline.md' : 'noisy.md'), nm.join('\n') + '\n');
fs.writeFileSync(path.join(REPORTS, writeBaseline ? 'baseline.json' : 'noisy.json'), JSON.stringify(noisy, null, 1));
console.log('\nЗагаданное блюдо, топ-3 при p = 0 / 1/10 / 1/7 / 1/5:');
for (const v of variants) {
  console.log(`  ${v.label.padEnd(22)} ${NOISE_LEVELS.map(([l]) => pct(noisy[v.label][l].top3).padStart(4)).join('  ')}   свайпов ${noisy[v.label]['0'].swipes.toFixed(1)}`);
}

console.log(summary.join('\n'));
console.log(`\nРедко задаваемых (вариант × вопрос): ${rare.length}. Отчёт: reports/questions.md`);
process.exitCode = failures ? 1 : 0;
