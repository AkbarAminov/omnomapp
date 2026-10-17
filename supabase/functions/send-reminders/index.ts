// Deno Edge Function. Ретеншн-эксперимент №1 (2026-10-17): раз в день пишет всем, кто включил
// /remind в боте, «Уже выбрали что покушать?» со ссылкой в Mini App. Отдельная функция, а не
// код внутри telegram-bot, потому что у неё другой триггер — не вебхук Telegram, а внешний cron.
//
// Деплой: supabase functions deploy send-reminders --no-verify-jwt
// (--no-verify-jwt обязателен: вызывающая сторона — cron, не Supabase-пользователь с JWT;
// авторизация своя, через заголовок ниже.)
//
// Триггер: Supabase Dashboard → Integrations → Cron (НЕ внутри Edge Functions), тип задания
// «Supabase Edge Function», метод POST, заголовок `x-cron-secret: <CRON_SECRET>`.
// Требует обоих расширений — pg_cron (хранит расписание в cron.job) и pg_net (сам HTTP-вызов);
// оба ставятся кнопкой в дашборде, без них типы заданий с HTTP недоступны.
// Расписание `45 7 * * *`: поле в дашборде всегда в GMT, то есть 07:45 UTC = 12:45 по Ташкенту
// (UTC+5, без перехода на летнее время — пересчитывать дважды в год не придётся). Проверять
// удобно по колонке Next run: она показана уже в местном поясе.
// Timeout в форме по умолчанию 1000 мс — мало: рассылка идёт последовательно, по запросу к
// Telegram на подписчика, поэтому поставлен 30000.
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

let cachedUsername = '';
async function botUsername(): Promise<string> {
  if (cachedUsername) return cachedUsername;
  try {
    const res = await fetch(`${TELEGRAM_API}/getMe`);
    const body = await res.json();
    cachedUsername = body?.result?.username ?? '';
  } catch (e) {
    console.error('[send-reminders] getMe failed:', (e as Error).message);
  }
  return cachedUsername;
}

// Отрицательный chat_id у Telegram означает группу или супергруппу. Разбираем именно по
// знаку, а не по отдельной колонке с типом чата: web_app-кнопку в группу слать нельзя
// (сообщение отклоняется целиком), а заводить ради этого новую миграцию — дороже, чем
// опереться на документированное свойство идентификаторов.
async function pickDishButton(chatId: number): Promise<Record<string, unknown>> {
  if (chatId > 0) return { text: '📱 Подобрать блюдо', web_app: { url: miniAppUrl() } };
  const username = await botUsername();
  return username
    ? { text: '📱 Подобрать блюдо', url: `https://t.me/${username}?start=reminder` }
    : { text: '📱 Подобрать блюдо', url: miniAppUrl() };
}

// true = доставлено, false = бот заблокирован (отписать), null = временная ошибка (попробовать завтра).
async function sendReminder(chatId: number): Promise<boolean | null> {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: REMINDER_TEXT,
        reply_markup: { inline_keyboard: [[await pickDishButton(chatId)]] },
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
