// Deno Edge Function. OMNOM Telegram-бот — «приёмная» перед Mini App: команды, помощь,
// обратная связь. Сам Mini App этот файл не трогает и не знает о его существовании.
//
// Деплой: supabase functions deploy telegram-bot --no-verify-jwt
// (--no-verify-jwt обязателен: вызывает только Telegram по вебхуку, у него нет Supabase JWT.)
//
// Секреты (supabase secrets set ...), значения не в коде и не в репозитории:
//   TELEGRAM_BOT_TOKEN — тот же токен, что уже использует auth-telegram (один бот)
//   WEBHOOK_SECRET      — секрет для заголовка X-Telegram-Bot-Api-Secret-Token
//   ADMIN_CHAT_ID       — numeric chat_id, куда падает фидбэк и уведомления о донатах
//   MINIAPP_URL         — https://omnomapp.vercel.app (или текущий прод-домен, без query)
// Донаты Stars (/donate) новых секретов не требуют — currency 'XTR' не нужен provider_token.
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
/donate: поддержать проект звёздами

Свайпай карточки: Нет, Без разницы или Да. В конце получишь 3-5 блюд.`;

const PRIVACY_TEXT = `Что храним: обезличенный идентификатор, язык интерфейса, ответы в квизе и выбранные блюда.
Не храним: имя и username.
Вопросы и удаление данных — через /feedback.`;

const FEEDBACK_PROMPT = 'Напиши мне сообщение в ответ на это, я прочитаю';
const FEEDBACK_BACK_HINT = 'Или вернись в меню:';
const FEEDBACK_THANKS = 'Спасибо, передал ✅';
const FALLBACK_TEXT = 'Не понял команду 🙂 Жми кнопку — подберу блюдо, или смотри /help.';

// ── Донаты в Telegram Stars (XTR) ───────────────────────────────────────────────
// Для Stars не нужен ни provider_token, ни отдельный платёжный провайдер — только
// currency: 'XTR' и сумма звёзд прямо в amount (без умножения на 100, как у фиатных валют).
const DONATE_INTRO = 'Если нравится OMNOM — можно поддержать проект звёздами Telegram ⭐';
const DONATE_THANKS = 'Спасибо за поддержку! ⭐';
const DONATE_AMOUNTS = [50, 100, 250, 500];

// Метка источника уезжает в query Mini App, оттуда main.tsx кладёт её в app_sessions.source.
// Аргумент /start (t.me/Omnomfoodbot?start=channel → «/start channel») пробрасывается сюда,
// поэтому ссылку в канале достаточно опубликовать с ?start=<метка>, и приход будет виден.
// Пускаем только безопасные символы: метка уходит в URL и в базу.
function miniAppUrl(source = 'bot'): string {
  const safe = /^[a-zA-Z0-9_-]{1,32}$/.test(source) ? source : 'bot';
  return MINIAPP_URL + (MINIAPP_URL.includes('?') ? '&' : '?') + `src=${safe}`;
}

const pickDishBtn = (source?: string) => ({ text: '📱 Подобрать блюдо', web_app: { url: miniAppUrl(source) } });
const PICK_DISH_BTN = pickDishBtn();
const BACK_BTN = { text: '⬅️ Назад', callback_data: 'start' };

const startKeyboard = (source?: string) => ({
  inline_keyboard: [
    [pickDishBtn(source)],
    [{ text: '💬 Посмотреть все команды', callback_data: 'cmds' }],
    [{ text: '✉️ Написать автору', callback_data: 'feedback' }],
    [{ text: '⭐ Поддержать проект', callback_data: 'donate' }],
  ],
});
const helpKeyboard = () => ({
  inline_keyboard: [[PICK_DISH_BTN], [{ text: '✉️ Написать автору', callback_data: 'feedback' }], [BACK_BTN]],
});
const fallbackKeyboard = () => ({ inline_keyboard: [[PICK_DISH_BTN], [BACK_BTN]] });
// Назад идёт отдельной кнопкой, а не в одной клавиатуре с запросом текста — у reply_markup
// может быть только один тип разом (ForceReply ИЛИ inline_keyboard, не оба), поэтому «Назад»
// уходит отдельным сообщением рядом с force_reply, а не внутри него.
const backOnlyKeyboard = () => ({ inline_keyboard: [[BACK_BTN]] });
const donateKeyboard = () => {
  const buttons = DONATE_AMOUNTS.map((n) => ({ text: `${n} ⭐`, callback_data: `donate_${n}` }));
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return { inline_keyboard: [...rows, [BACK_BTN]] };
};

// ── Минимальные типы Telegram Update — только то, что реально используем ──────
interface TgChat { id: number }
interface TgUser { id: number; is_bot: boolean }
interface TgSuccessfulPayment { currency: string; total_amount: number; invoice_payload: string }
interface TgMessage {
  message_id: number;
  chat: TgChat;
  text?: string;
  reply_to_message?: { from?: TgUser; text?: string };
  successful_payment?: TgSuccessfulPayment;
}
interface TgCallbackQuery {
  id: string;
  data?: string;
  message?: { chat: TgChat };
}
interface TgPreCheckoutQuery {
  id: string;
  from: TgUser;
  currency: string;
  total_amount: number;
  invoice_payload: string;
}
interface TgUpdate {
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
  pre_checkout_query?: TgPreCheckoutQuery;
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

// Stars (XTR): provider_token пустой — платёж идёт через баланс Stars самого Telegram,
// внешний платёжный провайдер не участвует. amount — именно число звёзд, без множителя
// на 100 (в отличие от обычных валют, где amount — целые копейки/центы).
const sendInvoice = (chatId: number, amount: number) =>
  tg('sendInvoice', {
    chat_id: chatId,
    title: 'Поддержать OMNOM',
    description: 'Спасибо, что помогаешь развивать проект!',
    payload: `donate_${amount}`,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: `${amount} Stars`, amount }],
  });

// Обязательно ответить в течение 10 секунд, иначе Telegram сам отменит платёж пользователю.
// Проверять нечего — донат не привязан ни к какому заказу/остатку, поэтому всегда ok.
const answerPreCheckoutQuery = (id: string, ok: boolean) =>
  tg('answerPreCheckoutQuery', { pre_checkout_query_id: id, ok });

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

  // Оплата Stars прошла — admin уведомляется тем же способом, что и фидбэк, без БД.
  if (msg.successful_payment) {
    const amount = msg.successful_payment.total_amount;
    await sendMessage(chatId, DONATE_THANKS);
    await sendMessage(ADMIN_CHAT_ID, `⭐ Донат: ${amount} Stars (chat_id ${chatId})`);
    return;
  }

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
  // «/start channel» — аргумент диплинка t.me/Omnomfoodbot?start=channel: это и есть метка
  // источника, её надо донести до Mini App, иначе непонятно, откуда пришёл человек.
  const startArg = text.startsWith('/start') ? text.split(/\s+/)[1] : undefined;

  switch (command) {
    case '/start':
      await sendMessage(chatId, START_TEXT, startKeyboard(startArg));
      return;
    case '/help':
      await sendMessage(chatId, HELP_TEXT, helpKeyboard());
      return;
    case '/feedback':
      // «Назад» не кладётся в один reply_markup с force_reply — Bot API разрешает только
      // один тип клавиатуры разом, поэтому это два сообщения подряд.
      await sendMessage(chatId, FEEDBACK_BACK_HINT, backOnlyKeyboard());
      await sendMessage(chatId, FEEDBACK_PROMPT, { force_reply: true });
      return;
    case '/privacy':
      await sendMessage(chatId, PRIVACY_TEXT, backOnlyKeyboard());
      return;
    case '/donate':
      await sendMessage(chatId, DONATE_INTRO, donateKeyboard());
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

  if (cb.data === 'start') {
    await sendMessage(chatId, START_TEXT, startKeyboard());
  } else if (cb.data === 'cmds') {
    await sendMessage(chatId, HELP_TEXT, helpKeyboard());
  } else if (cb.data === 'feedback') {
    await sendMessage(chatId, FEEDBACK_BACK_HINT, backOnlyKeyboard());
    await sendMessage(chatId, FEEDBACK_PROMPT, { force_reply: true });
  } else if (cb.data === 'donate') {
    await sendMessage(chatId, DONATE_INTRO, donateKeyboard());
  } else if (cb.data?.startsWith('donate_')) {
    const amount = Number(cb.data.slice('donate_'.length));
    if (Number.isInteger(amount) && amount > 0) await sendInvoice(chatId, amount);
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
    else if (update.pre_checkout_query) await answerPreCheckoutQuery(update.pre_checkout_query.id, true);
    else if (update.message) await handleMessage(update.message);
  } catch (e) {
    console.error('[bot] handleUpdate error:', (e as Error).message);
  }

  return new Response('ok', { status: 200 });
});
