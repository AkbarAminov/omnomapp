// Local stand-in for the Supabase REST API, serving data/*.csv — for UI checks and screenshots without the real DB.
//   node scripts/mockApi.ts            → http://localhost:54329
//   MOCK_LANG=uz MOCK_ALLERGENS=nuts,eggs node scripts/mockApi.ts
// then: VITE_SUPABASE_URL=http://localhost:54329 VITE_SUPABASE_ANON_KEY=mock npx vite
import http from 'node:http';
import { loadRawDishes, loadRawQuestions } from './lib/csvData.ts';

const PORT = Number(process.env.MOCK_PORT ?? 54329);
const dishes = loadRawDishes().map((d) => ({ ...d, allergens: JSON.parse(d.allergens || '[]') }));
const questions = loadRawQuestions().map((q) => ({
  ...q, priority: Number(q.priority), image: q.image || null, show_if: q.show_if || null, hide_if: q.hide_if || null,
}));
const settings = { lang: process.env.MOCK_LANG ?? 'ru', allergens: (process.env.MOCK_ALLERGENS ?? '').split(',').filter(Boolean) };
const tables: Record<string, unknown[]> = { history: [], session_answers: [], events: [] };

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const table = new URL(req.url ?? '/', 'http://x').pathname.replace('/rest/v1/', '');
  let body = '';
  req.on('data', (c) => (body += c)).on('end', () => {
    const json = (status: number, data: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (table === 'dishes') return json(200, dishes);
    if (table === 'questions') return json(200, questions);
    if (table === 'places' || table === 'menu_items') return json(200, []);
    if (table === 'user_settings') return req.method === 'GET' ? json(200, [settings]) : json(201, []);
    if (table in tables) {
      if (req.method === 'POST') {
        const rows = JSON.parse(body || '[]');
        tables[table].unshift(...(Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r, created_at: new Date().toISOString() })));
        return json(201, []);
      }
      if (req.method === 'DELETE') { tables[table].length = 0; return json(204, []); }
      return json(200, tables[table]);
    }
    json(404, { message: `table ${table} is not mocked` });
  });
}).listen(PORT, () => console.log(`mock Supabase on http://localhost:${PORT} (lang ${settings.lang})`));
