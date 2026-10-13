// Deno Edge Function. OMNOM Telegram-бот — «приёмная» перед Mini App: команды, помощь,
// обратная связь. Сам Mini App этот файл не трогает и не знает о его существовании.
//
// Деплой: supabase functions deploy telegram-bot --no-verify-jwt
// (--no-verify-jwt обязателен: вызывает только Telegram по вебхуку, у него нет Supabase JWT.)
//
// Секреты (supabase secrets set ...), значения не в коде и не в репозитории:
//   TELEGRAM_BOT_TOKEN — тот же токен, что уже использует auth-telegram (один бот)
//   WEBHOOK_SECRET      — секрет для заголовка X-Telegram-Bot-Api-Secret-Token
//   ADMIN_CHAT_ID       — numeric chat_id, куда падает фидбэк (узнать через @userinfobot)
//   MINIAPP_URL         — https://omnomapp.vercel.app (или текущий прод-домен, без query)
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')!;
const ADMIN_CHAT_ID = Number(Deno.env.get('ADMIN_CHAT_ID'));
const MINIAPP_URL = Deno.env.get('MINIAPP_URL')!;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── Тексты и клавиатуры — ровно как в ТЗ ───────────────────────────────────────
const START_TEXT = 'Привет! Я OMNOM 🍽 Помогу решить, что поесть, за минуту. Жми кнопку ниже 👇';

const HELP_TEXT = `OMNOM подбирает блюдо под настроение.

/start: открыть приложение
/help: как это работает
/feedback: написать автору
/privacy: какие данные мы храним

Свайпай карточки: Нет, Без разницы или Да. В конце получишь 3-5 блюд.`;

const PRIVACY_TEXT = `Что храним: обезличенный идентификатор, язык интерфейса, ответы в квизе и выбранные блюда.
Не храним: имя и username.
Вопросы и удаление данных — через /feedback.`;

const FEEDBACK_PROMPT = 'Напиши мне сообщение в ответ на это, я прочитаю';
const FEEDBACK_THANKS = 'Спасибо, передал ✅';
const FALLBACK_TEXT = 'Не понял команду 🙂 Жми кнопку — подберу блюдо, или смотри /help.';

// Mini App ничем не управляет здесь — просто дописываем метку источника в URL кнопки.
function miniAppUrl(): string {
  return MINIAPP_URL + (MINIAPP_URL.includes('?') ? '&' : '?') + 'src=bot';
}

const PICK_DISH_BTN = { text: '📱 Подобрать блюдо', web_app: { url: miniAppUrl() } };

const startKeyboard = () => ({
  inline_keyboard: [
    [PICK_DISH_BTN],
    [{ text: '💬 Посмотреть все команды', callback_data: 'cmds' }],
    [{ text: '✉️ Написать автору', callback_data: 'feedback' }],
  ],
});
const helpKeyboard = () => ({
  inline_keyboard: [[PICK_DISH_BTN], [{ text: '✉️ Написать автору', callback_data: 'feedback' }]],
});
const fallbackKeyboard = () => ({ inline_keyboard: [[PICK_DISH_BTN]] });

// ── Минимальные типы Telegram Update — только то, что реально используем ──────
interface TgChat { id: number }
interface TgUser { id: number; is_bot: boolean }
interface TgMessage {
  message_id: number;
  chat: TgChat;
  text?: string;
  reply_to_message?: { from?: TgUser; text?: string };
}
interface TgCallbackQuery {
  id: string;
  data?: string;
  message?: { chat: TgChat };
}
interface TgUpdate {
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

// ── Telegram API: один общий вызов, ошибки логируем без токена и без текста сообщений ──
async function tg(method: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // Тело ошибки Telegram — служебное ("Bad Request: ..."), не эхо нашего payload.
      const body = await res.text().catch(() => '');
      console.error(`[bot] ${method} failed: ${res.status} ${body.slice(0, 200)}`);
    }
  } catch (e) {
    console.error(`[bot] ${method} error:`, (e as Error).message);
  }
}

const sendMessage = (chatId: number, text: string, reply_markup?: unknown) =>
  tg('sendMessage', { chat_id: chatId, text, reply_markup });

const answerCallbackQuery = (id: string, text?: string) =>
  tg('answerCallbackQuery', { callback_query_id: id, text });

// copyMessage, не forwardMessage: автор фидбэка не раскрывается админу как «Forwarded from
// Имя Фамилия (@username)» — это противоречило бы «не храним имя и username». Если хочется
// иметь возможность ответить конкретному человеку через Telegram напрямую — замени на
// forwardMessage(ADMIN_CHAT_ID, chatId, message_id), тогда имя/username увидит админ (но
// это не БД, инструкция запрещает именно хранить, а не показать один раз живьём).
const copyMessage = (toChatId: number, fromChatId: number, messageId: number) =>
  tg('copyMessage', { chat_id: toChatId, from_chat_id: fromChatId, message_id: messageId });

// ── Обработка одного апдейта ────────────────────────────────────────────────────
async function handleMessage(msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;

  // Ответ на наш служебный промпт /feedback. Состояния в базе нет — опознаём по тому, что
  // реплай указывает на сообщение от бота с точно таким текстом, который мы сами же послали.
  if (msg.reply_to_message?.from?.is_bot && msg.reply_to_message.text === FEEDBACK_PROMPT) {
    await copyMessage(ADMIN_CHAT_ID, chatId, msg.message_id);
    await sendMessage(chatId, FEEDBACK_THANKS);
    return;
  }

  const text = (msg.text ?? '').trim();
  // В группах команды приходят как "/start@OmnomBot" — отрезаем @username и аргументы.
  const command = text.startsWith('/') ? text.split(/[\s@]/)[0] : '';

  switch (command) {
    case '/start':
      await sendMessage(chatId, START_TEXT, startKeyboard());
      return;
    case '/help':
      await sendMessage(chatId, HELP_TEXT, helpKeyboard());
      return;
    case '/feedback':
      await sendMessage(chatId, FEEDBACK_PROMPT, { force_reply: true });
      return;
    case '/privacy':
      await sendMessage(chatId, PRIVACY_TEXT);
      return;
    default:
      await sendMessage(chatId, FALLBACK_TEXT, fallbackKeyboard());
  }
}

async function handleCallback(cb: TgCallbackQuery): Promise<void> {
  // Обязательно и в первую очередь — иначе кнопка у пользователя «крутится» до таймаута.
  await answerCallbackQuery(cb.id);
  const chatId = cb.message?.chat.id;
  if (!chatId) return;

  if (cb.data === 'cmds') {
    await sendMessage(chatId, HELP_TEXT, helpKeyboard());
  } else if (cb.data === 'feedback') {
    await sendMessage(chatId, FEEDBACK_PROMPT, { force_reply: true });
  }
}

Deno.serve(async (req) => {
  // Пустой GET — ручная проверка, что функция вообще поднята, без секрета.
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  const secret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (secret !== WEBHOOK_SECRET) return new Response('unauthorized', { status: 401 });

  let update: TgUpdate;
  try {
    update = await req.json();
  } catch {
    return new Response('ok', { status: 200 });
  }

  // Телеграму всегда 200 и быстро — иначе он начнёт ретраить апдейт, а ошибку просто логируем.
  try {
    if (update.callback_query) await handleCallback(update.callback_query);
    else if (update.message) await handleMessage(update.message);
  } catch (e) {
    console.error('[bot] handleUpdate error:', (e as Error).message);
  }

  return new Response('ok', { status: 200 });
});
