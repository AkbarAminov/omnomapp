// node scripts/screenshots.ts <label>  → reports/result_screen/<label>-<lang>.png (375×667)
// Builds against scripts/mockApi.ts, serves with vite preview, plays meal → central-asia → always «Да».
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const label = process.argv[2] ?? 'shot';
const ROOT = path.join(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'reports', 'result_screen');
const DIST = path.join(ROOT, 'node_modules', '.tmp', 'screenshots-dist');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TEXT = {
  ru: { start: 'Начать!', meal: 'Плотно поесть', cuisine: 'Среднеазиатская', yes: 'Да', done: 'Пройти заново' },
  uz: { start: 'Boshlash!', meal: 'To‘yib ovqatlanish', cuisine: 'O\'rta Osiyo oshxonasi', yes: 'Ha', done: 'Qayta boshlash' },
};

fs.mkdirSync(OUT, { recursive: true });
execSync(`npx vite build --outDir ${DIST} --emptyOutDir`, {
  cwd: ROOT, stdio: 'ignore', env: { ...process.env, VITE_SUPABASE_URL: 'http://localhost:54329', VITE_SUPABASE_ANON_KEY: 'mock' },
});
const waitFor = (url: string) => new Promise<void>((resolve) => {
  const tick = () => fetch(url).then(() => resolve(), () => setTimeout(tick, 200));
  tick();
});
const preview = spawn('npx', ['vite', 'preview', '--outDir', DIST, '--port', '5190', '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
await waitFor('http://localhost:5190/');

const browser = await chromium.launch({ executablePath: CHROME });
try {
  for (const lang of ['ru', 'uz'] as const) {
    const mock: ChildProcess = spawn('node', ['scripts/mockApi.ts'], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, MOCK_LANG: lang } });
    await waitFor('http://localhost:54329/rest/v1/dishes');
    const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 });
    const t = TEXT[lang];
    await page.goto('http://localhost:5190/');
    await page.getByRole('button', { name: t.start }).click();
    await page.getByText(t.meal, { exact: true }).click();
    await page.getByText(t.cuisine, { exact: true }).click();
    const done = page.getByText(t.done).first();
    for (let i = 0; i < 12 && !(await done.isVisible().catch(() => false)); i++) {
      const yes = page.getByRole('button', { name: t.yes, exact: true });
      if (await yes.isVisible().catch(() => false)) await yes.click();
      await page.waitForTimeout(450);
    }
    await done.waitFor({ timeout: 15000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `${label}-${lang}.png`) });
    await page.screenshot({ path: path.join(OUT, `${label}-${lang}-full.png`), fullPage: true });
    await page.close();
    mock.kill();
    await new Promise((r) => setTimeout(r, 300));
  }
} finally {
  await browser.close();
  preview.kill();
}
console.log(`screenshots → ${path.relative(ROOT, OUT)}/${label}-{ru,uz}.png`);
