// Deno Edge Function. Ретеншн-эксперимент №1 (2026-10-17): раз в день пишет всем, кто включил
// /remind в боте, «Уже выбрали что покушать?» со ссылкой в Mini App. Отдельная функция, а не
// код внутри telegram-bot, потому что у неё другой триггер — не вебхук Telegram, а внешний cron.
//
// Деплой: supabase functions deploy send-reminders --no-verify-jwt
// (--no-verify-jwt обязателен: вызывающая сторона — cron, не Supabase-пользователь с JWT;
// авторизация своя, через заголовок ниже.)
//
// Триггер: Supabase Dashboard → Edge Functions → send-reminders → Cron, расписание
// `45 7 * * *` — это 07:45 UTC, то есть 12:45 по Ташкенту (UTC+5, без переходов на летнее
// время, так что пересчитывать дважды в год не придётся). Заголовок: `x-cron-secret: <CRON_SECRET>`.
// pg_cron не использован: он завязан на pg_net и требует отдельного включения расширений,
// а встроенный Cron в дашборде делает то же самое без лишней миграции.
//
// Секреты: TELEGRAM_BOT_TOKEN (тот же бот), MINIAPP_URL, CRON_SECRET (свой, не из Telegram —
// проверяет, что вызов пришёл от настроенного cron, а не от кого попало).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — инжектятся платформой.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const MINIAPP_URL = Deno.env.get('MINIAPP_URL')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET')!;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

// src=reminder уезжает в app_sessions.source (main.tsx читает ?src= из query) — так виден
// реальный эффект эксперимента: сколько открытий Mini App пришло именно по напоминанию.
function miniAppUrl(): string {
  return MINIAPP_URL + (MINIAPP_URL.includes('?') ? '&' : '?') + 'src=reminder';
}

const REMINDER_TEXT = 'Уже выбрали что покушать?';
const PICK_DISH_BTN = { text: '📱 Подобрать блюдо', web_app: { url: miniAppUrl() } };

// true = доставлено, false = бот заблокирован (отписать), null = временная ошибка (попробовать завтра).
async function sendReminder(chatId: number): Promise<boolean | null> {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: REMINDER_TEXT,
        reply_markup: { inline_keyboard: [[PICK_DISH_BTN]] },
      }),
    });
    if (res.ok) return true;
    // 403 здесь означает ровно одно: пользователь заблокировал бота или удалил чат.
    if (res.status === 403) return false;
    const body = await res.text().catch(() => '');
    console.error(`[send-reminders] sendMessage ${chatId} failed: ${res.status} ${body.slice(0, 200)}`);
    return null;
  } catch (e) {
    console.error(`[send-reminders] sendMessage ${chatId} error:`, (e as Error).message);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) return new Response('unauthorized', { status: 401 });

  // last_reminded_at < сегодня (UTC) — защита от повторного запуска в тот же день, если
  // расписание в дашборде случайно сработает дважды.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: subs, error } = await admin
    .from('reminder_subscribers')
    .select('chat_id, last_reminded_at')
    .eq('opted_in', true);
  if (error) {
    console.error('[send-reminders] query failed:', error.message);
    return new Response('query failed', { status: 500 });
  }

  const due = (subs ?? []).filter((s) => !s.last_reminded_at || new Date(s.last_reminded_at) < todayStart);
  let sent = 0, unsubscribed = 0, failed = 0;
  for (const s of due) {
    const result = await sendReminder(s.chat_id);
    if (result === true) {
      sent++;
      await admin.from('reminder_subscribers').update({ last_reminded_at: new Date().toISOString() }).eq('chat_id', s.chat_id);
    } else if (result === false) {
      unsubscribed++;
      await admin.from('reminder_subscribers').update({ opted_in: false }).eq('chat_id', s.chat_id);
    } else {
      failed++;
    }
  }

  const summary = { due: due.length, sent, unsubscribed, failed };
  console.log('[send-reminders]', JSON.stringify(summary));
  return new Response(JSON.stringify(summary), { headers: { 'content-type': 'application/json' } });
});
