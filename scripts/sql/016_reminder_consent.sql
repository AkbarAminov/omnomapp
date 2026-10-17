-- Спрос согласия на напоминание про обед. NOT applied automatically — review, then run by hand.
-- Только add column if not exists: данные и существующие согласия не затрагиваются.
--
-- ─── Зачем ─────────────────────────────────────────────────────────────────────────────
-- В таблице было два состояния, а нужно четыре. opted_in = false означало сразу и «человек
-- отказался», и «мы просто знаем адрес, но ничего не спрашивали» — различить нельзя, а
-- это ровно та разница, из-за которой нельзя ни корректно разослать вопрос (кому?), ни
-- посчитать конверсию согласия.
--
-- consent_asked_at   — когда вопрос был отправлен. NULL = ещё не спрашивали.
--                      Рассылка вопроса выбирает именно по NULL, поэтому один человек
--                      получает его ровно один раз и повторов не будет при любом числе
--                      запусков cron.
-- consent_answered_at — когда человек нажал «Да» или «Нет». NULL при заполненном
--                      consent_asked_at = промолчал. Молчание считаем отказом, но видим
--                      его отдельно от явного «нет»: это разные вещи для продукта.
-- first_seen_from    — откуда узнали chat_id: 'bot' (написал боту) или 'app' (вход в
--                      Mini App). Нужно, чтобы понимать, что вообще даёт охват.
--
-- ─── Что меняется в поведении (важно, это отход от 012) ────────────────────────────────
-- До сих пор строка в этой таблице появлялась ТОЛЬКО по явному согласию, и в комментарии
-- к 012 это записано принципом: сырой Telegram id живёт лишь в таблице бота, а пайплайн
-- Mini App его не касается. Теперь chat_id записывается и при входе в приложение — иначе
-- охват рассылки навсегда остаётся теми, кто когда-то нажал кнопку (10 адресов на 41
-- пользователя, причём 25 из них бота точно открывали, но их id были выброшены).
-- Запись идёт с opted_in = false: адрес знаем, согласия нет, рассылки нет. Само согласие
-- по-прежнему только по кнопке.
alter table public.reminder_subscribers
  add column if not exists consent_asked_at timestamptz;

alter table public.reminder_subscribers
  add column if not exists consent_answered_at timestamptz;

alter table public.reminder_subscribers
  add column if not exists first_seen_from text;

-- Те 10 строк от 17 октября остались с той поры, когда подписка ставилась автоматически,
-- а 013 их погасил. Вопроса им не задавали ни разу, поэтому consent_asked_at у них NULL —
-- то есть они попадут в первую же рассылку вопроса, и это именно то, что нужно.
-- Источник у них бот: других способов записать chat_id тогда не существовало.
update public.reminder_subscribers
set first_seen_from = 'bot'
where first_seen_from is null;

-- Выборка рассылки вопроса: consent_asked_at is null при положительном chat_id.
create index if not exists reminder_subscribers_unasked_idx
  on public.reminder_subscribers (consent_asked_at)
  where chat_id > 0;

-- Проверка после запуска: сколько адресов ждут вопроса и сколько уже ответили.
-- select count(*) filter (where consent_asked_at is null and chat_id > 0) as ждут_вопроса,
--        count(*) filter (where consent_answered_at is not null)          as ответили,
--        count(*) filter (where opted_in)                                 as подписаны,
--        count(*)                                                        as всего
-- from public.reminder_subscribers;
