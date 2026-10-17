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
// Ташкенту в понедельник (UTC+5, без перехода на летнее время).
//
// Timeout в форме дашборда ограничен сверху 5000 мс — больше поставить нельзя. Поэтому
// функция обязана укладываться в эти пять секунд, и ниже сделано три вещи ровно для этого:
// отправка параллельная пулом, отметки ставятся одним запросом вместо одного на человека,
// и за один вызов берётся не больше BATCH_LIMIT адресов. Плюс сама операция идемпотентна и
// возобновляема: выборка идёт по consent_asked_at is null, так что любой обрыв посередине
// лечится следующим запуском — он подберёт тех, кого не успел отметить.
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

// Сколько адресов берём за один вызов. Защита от того, что при выросшем списке функция
// перестанет укладываться в таймаут: остаток уедет следующим запуском, никто не потерян.
const BATCH_LIMIT = 300;
// Параллельных отправок. Telegram разрешает порядка 30 сообщений в секунду разным людям,
// так что восемь — с большим запасом, и 300 адресов уходят примерно за 40 запросов подряд.
const CONCURRENCY = 8;

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
    .gt('chat_id', 0)
    .limit(BATCH_LIMIT);
  if (error) {
    console.error('[ask-consent] query failed:', error.message);
    return new Response('query failed', { status: 500 });
  }

  const chatIds = (rows ?? []).map((r) => r.chat_id as number);
  let asked = 0, unreachable = 0, failed = 0;
  // Отмечаем и доставленных, и недоступных: написать по такому адресу нельзя, и долбиться
  // в него каждую неделю бессмысленно. Разницу видно по consent_answered_at — у
  // недоступного он останется пустым, как и у того, кто промолчал.
  const toMark: number[] = [];

  // Пул на CONCURRENCY воркеров поверх общей очереди: простой Promise.all по всему списку
  // выстрелил бы 300 запросов разом и получил лимит Telegram, а последовательный цикл не
  // влезает в таймаут.
  const queue = [...chatIds];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (;;) {
        const chatId = queue.shift();
        if (chatId === undefined) return;
        const result = await ask(chatId);
        if (result === true) { asked++; toMark.push(chatId); }
        else if (result === false) { unreachable++; toMark.push(chatId); }
        // Временная ошибка: отметку не ставим, подберём следующим запуском.
        else failed++;
      }
    }),
  );

  // Один запрос на всю пачку вместо одного на человека — ради того же таймаута.
  if (toMark.length) {
    const { error: markErr } = await admin
      .from('reminder_subscribers')
      .update({ consent_asked_at: new Date().toISOString() })
      .in('chat_id', toMark);
    // Если отметка не записалась, вопрос уже отправлен, и следующий запуск отправит его
    // повторно. Поэтому это ошибка, а не предупреждение: единственный способ получить
    // дубль у человека.
    if (markErr) console.error('[ask-consent] mark failed, duplicates possible:', markErr.message);
  }

  const summary = { candidates: chatIds.length, asked, unreachable, failed, marked: toMark.length };
  console.log('[ask-consent]', JSON.stringify(summary));
  return new Response(JSON.stringify(summary), { headers: { 'content-type': 'application/json' } });
});
