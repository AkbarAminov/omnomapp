// Deno Edge Function. Один раз спрашивает человека, хочет ли он напоминание про обед.
// Отдельная функция, а не режим внутри send-reminders: у неё другая выборка (те, кого ещё
// не спрашивали), другое расписание (раз в неделю, не каждый день) и другое сообщение.
//
// Деплой: supabase functions deploy ask-consent --no-verify-jwt
// (--no-verify-jwt обязателен: вызывает cron, а не Supabase-пользователь с JWT; авторизация
// своя, через заголовок x-cron-secret, как в send-reminders.)
//
// Триггер: Supabase Dashboard → Integrations → Cron (НЕ внутри Edge Functions), тип задания
// «Supabase Edge Function», метод POST, заголовок `x-cron-secret: <CRON_SECRET>`.
// Расписание `45 7 * * 1`: поле в дашборде всегда в GMT, то есть 07:45 UTC = 12:45 по
// Ташкенту в понедельник (UTC+5, без перехода на летнее время). Timeout поставить 30000:
// рассылка последовательная, по запросу к Telegram на человека.
//
// Секреты те же, что у send-reminders: TELEGRAM_BOT_TOKEN, MINIAPP_URL, CRON_SECRET.
//
// ─── Почему один раз, а не каждый понедельник ──────────────────────────────────────────
// Выборка идёт по consent_asked_at is null, и отметка ставится сразу после отправки. Значит
// при любом числе запусков cron (включая случайный повторный) один человек получает вопрос
// ровно один раз. Молчание считаем отказом: бота, который переспрашивает, выключают первым.
// Зато каждый НОВЫЙ адрес, попавший в таблицу за неделю, получит вопрос в следующий
// понедельник автоматически — ничего настраивать заново не нужно.
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

// src=consent уезжает в app_sessions.source, так видно, сколько открытий дал сам вопрос,
// отдельно от src=reminder у ежедневной рассылки.
function miniAppUrl(): string {
  return MINIAPP_URL + (MINIAPP_URL.includes('?') ? '&' : '?') + 'src=consent';
}

const ASK_TEXT = [
  'Время обедать 🍜',
  '',
  'Если не можешь выбрать — загляни в OmNom, подберём за пару вопросов.',
  '',
  'Присылать такое напоминание каждый день около обеда?',
].join('\n');

// Три кнопки, а не две: сообщение должно быть полезным само по себе, а не только опросом.
// Сначала то, зачем человек пришёл (подобрать блюдо), потом уже да/нет.
const askKeyboard = () => ({
  inline_keyboard: [
    [{ text: '🍽 Подобрать блюдо', web_app: { url: miniAppUrl() } }],
    [
      { text: '👍 Да, напоминай', callback_data: 'remind_on' },
      { text: '🙅 Нет, спасибо', callback_data: 'remind_off' },
    ],
  ],
});

// true = доставлено, false = бот заблокирован или чат не начат, null = временная ошибка.
async function ask(chatId: number): Promise<boolean | null> {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: ASK_TEXT, reply_markup: askKeyboard() }),
    });
    if (res.ok) return true;
    // 403 это «заблокировал бота» ИЛИ «бот не может начать разговор первым» — человек
    // открывал Mini App, но /start боту не писал. Разницы для нас нет: написать нельзя.
    if (res.status === 403) return false;
    const body = await res.text().catch(() => '');
    console.error(`[ask-consent] sendMessage ${chatId} failed: ${res.status} ${body.slice(0, 200)}`);
    return null;
  } catch (e) {
    console.error(`[ask-consent] sendMessage ${chatId} error:`, (e as Error).message);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) return new Response('unauthorized', { status: 401 });

  // gt('chat_id', 0) — только личные чаты: у групп и супергрупп id отрицательный, а в
  // группы рассылок нет вовсе (см. 013).
  const { data: rows, error } = await admin
    .from('reminder_subscribers')
    .select('chat_id')
    .is('consent_asked_at', null)
    .gt('chat_id', 0);
  if (error) {
    console.error('[ask-consent] query failed:', error.message);
    return new Response('query failed', { status: 500 });
  }

  const now = new Date().toISOString();
  let asked = 0, unreachable = 0, failed = 0;
  for (const r of rows ?? []) {
    const result = await ask(r.chat_id);
    if (result === true) {
      asked++;
      await admin.from('reminder_subscribers').update({ consent_asked_at: now }).eq('chat_id', r.chat_id);
    } else if (result === false) {
      // Отметку ставим и здесь: написать этому адресу нельзя, и долбиться в него каждую
      // неделю бессмысленно. consent_answered_at остаётся пустым, так что в статистике это
      // видно отдельно от явного отказа.
      unreachable++;
      await admin.from('reminder_subscribers').update({ consent_asked_at: now }).eq('chat_id', r.chat_id);
    } else {
      // Временная ошибка: отметку не ставим, попробуем в следующий понедельник.
      failed++;
    }
  }

  const summary = { candidates: (rows ?? []).length, asked, unreachable, failed };
  console.log('[ask-consent]', JSON.stringify(summary));
  return new Response(JSON.stringify(summary), { headers: { 'content-type': 'application/json' } });
});
