// Deno Edge Function. Deploy with: supabase functions deploy admin-stats
//
// В отличие от auth-telegram здесь НЕ нужен --no-verify-jwt: панель открывает уже
// авторизованный пользователь, поэтому платформенная проверка JWT остаётся включённой и
// работает как первый, внешний слой. Решает же доступ не она, а подпись initData ниже.
//
// Секреты (supabase secrets set ...):
//   ADMIN_TG_IDS      — Telegram id владельцев через запятую. Ровно поэтому личный id не
//                       лежит в репозитории: функция читает его из окружения проекта.
//   TELEGRAM_BOT_TOKEN, TG_HASH_SALT — уже заданы для auth-telegram, те же самые.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY подставляет платформа — руками не задавать.
//
// Модель доступа, три независимых условия, все обязательные:
//   1. Платформа проверила JWT (функция задеплоена без --no-verify-jwt).
//   2. Функция сама проверила HMAC-подпись Telegram initData ботовым токеном — то есть
//      Telegram id доказан криптографически, а не взят со слов клиента.
//   3. Доказанный id есть в ADMIN_TG_IDS.
// Только после этого service-role клиент вызывает admin_stats_* (scripts/sql/014). Сами
// функции в базе у anon и authenticated отозваны, поэтому даже с анонимным ключом на руках
// агрегаты из браузера не достать: единственный путь к ним — через эту проверку.
//
// service_role ключ живёт только здесь, в окружении функции, и в клиент не попадает.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const HASH_SALT = Deno.env.get('TG_HASH_SALT')!;
const ADMIN_TG_IDS = (Deno.env.get('ADMIN_TG_IDS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

// Узбекистан — UTC+5 круглый год, переход на летнее время отменён в 2005-м, поэтому
// фиксированного смещения достаточно и тащить библиотеку таймзон в Edge Function не нужно.
const TZ_OFFSET_MINUTES = 5 * 60;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

async function hmac(keyBytes: Uint8Array, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Намеренная копия verifyInitData из auth-telegram/index.ts, а не общий модуль в _shared:
// вынос затронул бы работающую авторизацию, а она здесь самое хрупкое место. Если правишь
// проверку — правь в обоих файлах.
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
async function verifyInitData(initData: string): Promise<{ id: number } | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const authDate = Number(params.get('auth_date') ?? '0');
  if (!authDate || Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) return null;

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = await hmac(new TextEncoder().encode('WebAppData'), BOT_TOKEN);
  const computedHash = toHex(await hmac(secretKey, dataCheckString));
  if (computedHash !== hash) return null;

  const userJson = params.get('user');
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

type Period = 'today' | '7d' | '30d' | '90d' | 'all';
const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = { today: 1, '7d': 7, '30d': 30, '90d': 90 };

// Полночь по Ташкенту как момент времени в UTC. Границы периодов выровнены по полуночи
// специально: admin_stats_daily строит ряд дней как [from, to), а admin_stats_kpi берёт
// последние сутки периода как (to - 1 день), поэтому «сегодня» должно заканчиваться
// началом следующих суток, а не текущей минутой — иначе сегодняшний день выпадает из ряда.
function tashkentMidnight(daysFromToday: number): Date {
  const shifted = new Date(Date.now() + TZ_OFFSET_MINUTES * 60_000);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate() + daysFromToday;
  return new Date(Date.UTC(y, m, d) - TZ_OFFSET_MINUTES * 60_000);
}

function windowFor(period: Period): { from: Date; to: Date; prevFrom: Date | null; prevTo: Date | null } {
  const to = tashkentMidnight(1); // начало следующих суток, конец включительного «сегодня»
  if (period === 'all') {
    // Данных раньше 2026-го в проекте нет, но дата намеренно взята с запасом, чтобы
    // «Всё время» не пришлось править, если в базу попадёт что-то старое.
    return { from: new Date(Date.UTC(2000, 0, 1)), to, prevFrom: null, prevTo: null };
  }
  const days = PERIOD_DAYS[period];
  const from = tashkentMidnight(1 - days);
  return { from, to, prevFrom: tashkentMidnight(1 - days * 2), prevTo: from };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = await req.json().catch(() => null);
    const initData = body?.initData;
    if (typeof initData !== 'string' || !initData) return json({ error: 'bad_request' }, 400);

    const tgUser = await verifyInitData(initData);
    if (!tgUser) return json({ error: 'invalid_signature' }, 401);

    const rawTgId = String(tgUser.id);
    const isAdmin = ADMIN_TG_IDS.includes(rawTgId);

    // probe нужен клиенту, чтобы решить, рисовать ли пункт «Статистика» в профиле, не зная
    // при этом ни одного админского id. Отвечает только «ты админ или нет» — про себя же,
    // поэтому 200 здесь ничего не раскрывает. Все агрегаты идут ниже и требуют isAdmin.
    if (body?.probe === true) return json({ admin: isAdmin });

    if (!isAdmin) return json({ error: 'forbidden' }, 403);

    const period: Period = ['today', '7d', '30d', '90d', 'all'].includes(body?.period)
      ? body.period
      : '7d';
    const { from, to, prevFrom, prevTo } = windowFor(period);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // «Не считать мой аккаунт»: у двух пайплайнов разные идентификаторы одного и того же
    // человека, поэтому исключение требует обоих. uuid достаётся по tg_hash — ровно так же,
    // как его считает auth-telegram, из доказанного подписью id.
    let excludeUuid: string | null = null;
    let excludeTg: string | null = null;
    if (body?.excludeSelf === true) {
      excludeTg = rawTgId;
      const tgHash = toHex(await hmac(new TextEncoder().encode(HASH_SALT), rawTgId));
      const { data } = await admin.from('users').select('id').eq('tg_hash', tgHash).maybeSingle();
      excludeUuid = data?.id ?? null;
    }

    const iso = (d: Date) => d.toISOString();
    const base = { p_from: iso(from), p_to: iso(to) };
    const withU = { ...base, p_exclude: excludeUuid };
    const withBoth = { ...withU, p_exclude_tg: excludeTg };

    const calls = {
      kpi: admin.rpc('admin_stats_kpi', withBoth),
      daily: admin.rpc('admin_stats_daily', withU),
      funnel: admin.rpc('admin_stats_funnel', withU),
      dishes: admin.rpc('admin_stats_dishes', { ...base, p_limit: 10, p_exclude: excludeUuid, p_exclude_tg: excludeTg }),
      cuisines: admin.rpc('admin_stats_cuisines', withU),
      dropoff: admin.rpc('admin_stats_dropoff', { ...base, p_limit: 8, p_timeout_minutes: 30, p_exclude_tg: excludeTg }),
      quality: admin.rpc('admin_stats_quality', withBoth),
      audience: admin.rpc('admin_stats_audience', withBoth),
      retention: admin.rpc('admin_stats_retention', withU),
      visits: admin.rpc('admin_stats_visits_per_user', withU),
    };

    // Сравнение с предыдущим периодом — только KPI и только когда предыдущий период
    // существует. Для «Всё время» его нет по определению, и клиент покажет «нет базы для
    // сравнения» вместо выдуманного прироста.
    const prevCall = prevFrom && prevTo
      ? admin.rpc('admin_stats_kpi', {
          p_from: iso(prevFrom), p_to: iso(prevTo), p_exclude: excludeUuid, p_exclude_tg: excludeTg,
        })
      : null;

    const keys = Object.keys(calls) as Array<keyof typeof calls>;
    const settled = await Promise.all([...keys.map((k) => calls[k]), prevCall ?? Promise.resolve(null)]);

    const out: Record<string, unknown> = {};
    const failed: string[] = [];
    keys.forEach((k, i) => {
      const res = settled[i] as { data: unknown; error: { message: string } | null };
      if (res?.error) {
        failed.push(k);
        out[k] = [];
      } else {
        out[k] = res?.data ?? [];
      }
    });
    const prevRes = settled[keys.length] as { data: unknown; error: unknown } | null;
    out.kpiPrev = prevRes && !prevRes.error ? prevRes.data : null;

    // Клиент получает только агрегаты — ни одной строки events, user_events или users.
    return json({
      ...out,
      meta: {
        period,
        from: iso(from),
        to: iso(to),
        prevFrom: prevFrom ? iso(prevFrom) : null,
        timezone: 'Asia/Tashkent (UTC+5)',
        excludedSelf: body?.excludeSelf === true,
        // Если 014 не применён, RPC не найдётся и список скажет, что именно отвалилось:
        // иначе на клиенте это выглядело бы как «просто пусто».
        failed,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch {
    return json({ error: 'internal_error' }, 500);
  }
});
