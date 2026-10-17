-- Агрегаты для закрытой панели статистики. NOT applied automatically — review, then run
-- by hand like every other file here. Ничего не удаляет и не меняет данные: только
-- create / create or replace, ни одного drop table, delete или update.
--
-- Зачем функции, а если вьюхи уже есть (009_metrics.sql): существующие admin_* считают
-- за всё время и параметров не принимают, поэтому под переключатель «Сегодня / 7 / 30 /
-- 90 дней / Всё время» не годятся. Здесь то же самое, но с границами периода.
--
-- Правила безопасности, одинаковые для всех функций ниже:
--   * security definer + set search_path = public — функция читает таблицы под своим
--     владельцем, а не под вызывающим, и не может быть обманута подменой search_path;
--   * execute отзывается у anon и authenticated в самом конце файла. Одного «не выдавать
--     grant» мало: в Supabase на public-схеме есть default privileges, которые выдают
--     execute на новую функцию сами (та же мина, что 009/010 нашли для вью).
--     Вызывать эти функции может только service_role — то есть Edge Function admin-stats,
--     которая перед вызовом проверяет подпись Telegram initData.
--
-- Два пайплайна аналитики не связаны по пользователю: events.user_id — сырой Telegram id
-- текстом, user_events.user_id — uuid из auth. Поэтому исключение «моего аккаунта» берёт
-- два разных параметра: p_exclude (uuid нового пайплайна) и p_exclude_tg (текстовый id
-- старого). Оба приходят из проверенной подписи initData, в коде ничего не зашито.
--
-- Сутки везде считаются по Asia/Tashkent: границы периода приходят готовыми из Edge
-- Function, а группировка по дням делает at time zone явно.

-- ─── 1. Ключевые показатели ────────────────────────────────────────────────────────────
create or replace function public.admin_stats_kpi(
  p_from timestamptz,
  p_to timestamptz,
  p_exclude uuid default null,
  p_exclude_tg text default null
)
returns table (metric text, value numeric, unit text, source text)
language sql
stable
security definer
set search_path = public
as $$
  with
  -- визиты периода
  s as (
    select * from public.app_sessions
    where started_at >= p_from and started_at < p_to
      and (p_exclude is null or user_id <> p_exclude)
  ),
  ev as (
    select e.* from public.user_events e
    where e.created_at >= p_from and e.created_at < p_to
      and (p_exclude is null or e.user_id <> p_exclude)
  ),
  -- последние сутки периода по Ташкенту, для DAU
  last_day as (select (p_to at time zone 'Asia/Tashkent')::date - 1 as d),
  old as (
    select o.* from public.events o
    where o.created_at >= p_from and o.created_at < p_to
      and (p_exclude_tg is null or o.user_id <> p_exclude_tg)
  ),
  -- брошенные подборы: есть показанный вопрос, нет результата, и сессия уже остыла
  sess as (
    select
      session_id,
      max(created_at) as last_at,
      count(*) filter (where event = 'question_shown') as shown,
      count(*) filter (where event in ('test_completed', 'results_shown')) as done
    from old
    where session_id is not null
    group by session_id
  ),
  dur as (
    select ((props ->> 'duration_ms')::numeric) as ms
    from old
    where event = 'test_completed' and props ->> 'duration_ms' ~ '^[0-9]+$'
  )
  select * from (
    values
      ('users_total',
        (select count(*) from public.users u where p_exclude is null or u.id <> p_exclude)::numeric,
        'чел', 'public.users (за всё время)'),
      ('users_new',
        (select count(*) from public.users u
          where u.created_at >= p_from and u.created_at < p_to
            and (p_exclude is null or u.id <> p_exclude))::numeric,
        'чел', 'public.users'),
      ('dau',
        (select count(distinct user_id) from s
          where (started_at at time zone 'Asia/Tashkent')::date = (select d from last_day))::numeric,
        'чел', 'public.app_sessions'),
      ('wau',
        (select count(distinct user_id) from s where started_at >= p_to - interval '7 days')::numeric,
        'чел', 'public.app_sessions'),
      ('mau',
        (select count(distinct user_id) from s where started_at >= p_to - interval '30 days')::numeric,
        'чел', 'public.app_sessions'),
      ('visits', (select count(*) from s)::numeric, 'визитов', 'public.app_sessions'),
      ('quizzes_started',
        (select count(distinct session_id) from ev where event_name = 'quiz_start')::numeric,
        'подборов', 'user_events.quiz_start'),
      ('quizzes_completed',
        (select count(distinct session_id) from ev where event_name = 'results_shown')::numeric,
        'подборов', 'user_events.results_shown'),
      ('completion_pct',
        round(100.0 * (select count(distinct session_id) from ev where event_name = 'results_shown')
          / greatest((select count(distinct session_id) from ev where event_name = 'quiz_start'), 1), 1),
        '%', 'user_events'),
      ('quiz_seconds',
        round(coalesce((select percentile_cont(0.5) within group (order by ms) from dur)::numeric, 0) / 1000.0, 1),
        'с (медиана)', 'events.test_completed.duration_ms'),
      ('dish_choices',
        (select count(*) from public.history h
          where h.created_at >= p_from and h.created_at < p_to
            and (p_exclude is null or h.user_id::text <> p_exclude::text))::numeric,
        'выборов', 'public.history'),
      ('abandoned',
        (select count(*) from sess
          where shown > 0 and done = 0 and last_at < now() - interval '30 minutes')::numeric,
        'подборов', 'events (расчёт с тайм-аутом 30 мин)'),
      ('reminder_subs_optin',
        (select count(*) from public.reminder_subscribers where opted_in)::numeric,
        'чел', 'public.reminder_subscribers (за всё время)'),
      ('reminder_subs_total',
        (select count(*) from public.reminder_subscribers)::numeric,
        'чел', 'public.reminder_subscribers (за всё время)')
  ) as t (metric, value, unit, source);
$$;

-- ─── 2. По дням: новые, DAU, скользящий WAU, визиты, подборы ───────────────────────────
create or replace function public.admin_stats_daily(
  p_from timestamptz,
  p_to timestamptz,
  p_exclude uuid default null
)
returns table (
  day date, new_users int, dau int, wau_7d int,
  visits int, quizzes_started int, quizzes_completed int
)
language sql
stable
security definer
set search_path = public
as $$
  with
  days as (
    select generate_series(
      (p_from at time zone 'Asia/Tashkent')::date,
      (p_to at time zone 'Asia/Tashkent')::date - 1,
      interval '1 day'
    )::date as day
  ),
  -- визиты за всю историю: скользящий WAU смотрит назад за границу периода
  s_all as (
    select user_id, (started_at at time zone 'Asia/Tashkent')::date as day, id
    from public.app_sessions
    where p_exclude is null or user_id <> p_exclude
  ),
  u as (
    select (created_at at time zone 'Asia/Tashkent')::date as day, count(*) as n
    from public.users
    where p_exclude is null or id <> p_exclude
    group by 1
  ),
  q as (
    select
      (e.created_at at time zone 'Asia/Tashkent')::date as day,
      count(distinct e.session_id) filter (where e.event_name = 'quiz_start') as started,
      count(distinct e.session_id) filter (where e.event_name = 'results_shown') as completed
    from public.user_events e
    where p_exclude is null or e.user_id <> p_exclude
    group by 1
  )
  select
    d.day,
    coalesce(u.n, 0)::int,
    (select count(distinct s.user_id) from s_all s where s.day = d.day)::int,
    (select count(distinct s.user_id) from s_all s where s.day <= d.day and s.day > d.day - 7)::int,
    (select count(*) from s_all s where s.day = d.day)::int,
    coalesce(q.started, 0)::int,
    coalesce(q.completed, 0)::int
  from days d
  left join u on u.day = d.day
  left join q on q.day = d.day
  order by d.day;
$$;

-- ─── 3. Воронка подбора ────────────────────────────────────────────────────────────────
-- Четыре шага, а не пять: dish_selected срабатывает ещё в Battle и в «на удачу», поэтому
-- выбор блюда не является подмножеством «увидел результат» и пятым шагом воронки быть не
-- может. Фактические выборы считает admin_stats_kpi как отдельный показатель.
create or replace function public.admin_stats_funnel(
  p_from timestamptz,
  p_to timestamptz,
  p_exclude uuid default null
)
returns table (stage text, step int, visits int)
language sql
stable
security definer
set search_path = public
as $$
  with
  s as (
    select id from public.app_sessions
    where started_at >= p_from and started_at < p_to
      and (p_exclude is null or user_id <> p_exclude)
  ),
  ev as (
    select e.session_id, e.event_name
    from public.user_events e
    join s on s.id = e.session_id
  )
  select * from (
    values
      ('Открыл приложение', 1, (select count(*) from s)::int),
      ('Начал подбор', 2, (select count(distinct session_id) from ev where event_name = 'quiz_start')::int),
      ('Ответил хотя бы раз', 3, (select count(distinct session_id) from ev where event_name = 'answer_given')::int),
      ('Увидел результат', 4, (select count(distinct session_id) from ev where event_name = 'results_shown')::int)
  ) as t (stage, step, visits);
$$;

-- ─── 4. Рейтинги блюд ──────────────────────────────────────────────────────────────────
create or replace function public.admin_stats_dishes(
  p_from timestamptz,
  p_to timestamptz,
  p_limit int default 10,
  p_exclude uuid default null,
  p_exclude_tg text default null
)
returns table (list text, dish_id text, dish text, cuisine text, n int)
language sql
stable
security definer
set search_path = public
as $$
  with
  chosen as (
    select h.dish_id, count(*) as n
    from public.history h
    where h.created_at >= p_from and h.created_at < p_to
      and (p_exclude is null or h.user_id::text <> p_exclude::text)
    group by 1
  ),
  old as (
    select o.event, o.dish_id
    from public.events o
    where o.created_at >= p_from and o.created_at < p_to
      and o.dish_id is not null
      and (p_exclude_tg is null or o.user_id <> p_exclude_tg)
  ),
  ranked as (
    select 'Выбрали' as list, dish_id, n from chosen
    union all
    select 'Рекомендовали', dish_id, count(*) from old where event = 'results_shown' group by dish_id
    union all
    select 'Победы в Battle', dish_id, count(*) from old
      where event in ('battle_winner', 'battle_choice') group by dish_id
    union all
    select 'Отклонили', dish_id, count(*) from old where event = 'recommendation_rejected' group by dish_id
  ),
  top as (
    select r.*, row_number() over (partition by r.list order by r.n desc, r.dish_id) as rn
    from ranked r
  )
  select
    t.list,
    t.dish_id,
    -- id, которого нет в public.dishes, показывается как есть: подставлять выдуманное
    -- название нельзя, а молча прятать строку — значит терять выбор из статистики
    coalesce(d.name, t.dish_id) as dish,
    coalesce(d.cuisine, '—') as cuisine,
    t.n::int
  from top t
  left join public.dishes d on d.id = t.dish_id
  where t.rn <= p_limit
  order by t.list, t.n desc;
$$;

-- ─── 5. Кухни фактических выборов ──────────────────────────────────────────────────────
create or replace function public.admin_stats_cuisines(
  p_from timestamptz,
  p_to timestamptz,
  p_exclude uuid default null
)
returns table (cuisine text, chosen int)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(d.cuisine, '—') as cuisine, count(*)::int as chosen
  from public.history h
  left join public.dishes d on d.id = h.dish_id
  where h.created_at >= p_from and h.created_at < p_to
    and (p_exclude is null or h.user_id::text <> p_exclude::text)
  group by 1
  order by 2 desc;
$$;

-- ─── 6. Обрывы подбора ─────────────────────────────────────────────────────────────────
-- Считается серверно и с тайм-аутом, а не по событию test_abandoned: оно отправляется из
-- вебвью перед закрытием и теряется почти всегда (за всё время одна строка против 19
-- брошенных сессий по этому расчёту). p_timeout_minutes отсекает подборы, которые прямо
-- сейчас идут и ещё не дошли до результата.
create or replace function public.admin_stats_dropoff(
  p_from timestamptz,
  p_to timestamptz,
  p_limit int default 8,
  p_timeout_minutes int default 30,
  p_exclude_tg text default null
)
returns table (question_id text, question text, step int, abandoned int)
language sql
stable
security definer
set search_path = public
as $$
  with
  old as (
    select o.session_id, o.event, o.question_id, o.question_index, o.created_at
    from public.events o
    where o.created_at >= p_from and o.created_at < p_to
      and o.session_id is not null
      and (p_exclude_tg is null or o.user_id <> p_exclude_tg)
  ),
  sess as (
    select
      session_id,
      max(created_at) as last_at,
      count(*) filter (where event = 'question_shown') as shown,
      count(*) filter (where event in ('test_completed', 'results_shown')) as done
    from old
    group by session_id
  ),
  abandoned as (
    select session_id from sess
    where shown > 0 and done = 0
      and last_at < now() - make_interval(mins => p_timeout_minutes)
  ),
  last_q as (
    select distinct on (o.session_id)
      o.session_id, o.question_id, o.question_index
    from old o
    join abandoned a on a.session_id = o.session_id
    where o.event = 'question_shown'
    order by o.session_id, o.question_index desc nulls last, o.created_at desc
  )
  select
    l.question_id,
    coalesce(q.question_ru, l.question_id) as question,
    coalesce(max(l.question_index), 0)::int as step,
    count(*)::int as abandoned
  from last_q l
  left join public.questions q on q.id = l.question_id
  group by l.question_id, q.question_ru
  order by abandoned desc, question
  limit p_limit;
$$;

-- ─── 7. Качество алгоритма ─────────────────────────────────────────────────────────────
create or replace function public.admin_stats_quality(
  p_from timestamptz,
  p_to timestamptz,
  p_exclude uuid default null,
  p_exclude_tg text default null
)
returns table (metric text, value numeric, unit text, n int, source text)
language sql
stable
security definer
set search_path = public
as $$
  with
  ev as (
    select e.* from public.user_events e
    where e.created_at >= p_from and e.created_at < p_to
      and (p_exclude is null or e.user_id <> p_exclude)
  ),
  answers as (
    select ((properties ->> 'time_ms')::numeric) as ms
    from ev
    where event_name = 'answer_given' and properties ->> 'time_ms' ~ '^[0-9]+$'
  ),
  per_sess as (
    select session_id, count(*) as cnt from ev where event_name = 'answer_given' group by 1
  ),
  dur as (
    select ((props ->> 'duration_ms')::numeric) as ms
    from public.events o
    where o.event = 'test_completed'
      and o.created_at >= p_from and o.created_at < p_to
      and o.props ->> 'duration_ms' ~ '^[0-9]+$'
      and (p_exclude_tg is null or o.user_id <> p_exclude_tg)
  ),
  pct as (
    select h.match_percent::numeric as v
    from public.history h
    where h.created_at >= p_from and h.created_at < p_to
      and h.match_percent is not null
      and (p_exclude is null or h.user_id::text <> p_exclude::text)
  ),
  fb as (
    select properties ->> 'value' as v from ev where event_name = 'result_feedback'
  )
  select * from (
    values
      ('Вопросов за подбор',
        round(coalesce((select avg(cnt) from per_sess), 0), 2),
        'шт', (select count(*) from per_sess)::int, 'user_events.answer_given'),
      ('Время на один ответ',
        round(coalesce((select percentile_cont(0.5) within group (order by ms) from answers)::numeric, 0) / 1000.0, 1),
        'с (медиана)', (select count(*) from answers)::int, 'user_events.answer_given.time_ms'),
      ('Длительность подбора',
        round(coalesce((select percentile_cont(0.5) within group (order by ms) from dur)::numeric, 0) / 1000.0, 1),
        'с (медиана)', (select count(*) from dur)::int, 'events.test_completed.duration_ms'),
      ('Совпадение с блюдом',
        round(coalesce((select avg(v) from pct), 0), 1),
        '%', (select count(*) from pct)::int, 'history.match_percent'),
      ('Оценка «нравится»',
        (select count(*) from fb where v = 'up')::numeric,
        'шт', (select count(*) from fb)::int, 'user_events.result_feedback'),
      ('Оценка «не нравится»',
        (select count(*) from fb where v = 'down')::numeric,
        'шт', (select count(*) from fb)::int, 'user_events.result_feedback'),
      ('Повторных подборов',
        (select count(*) from ev where event_name = 'restart')::numeric,
        'шт', (select count(*) from ev)::int, 'user_events.restart')
  ) as t (metric, value, unit, n, source);
$$;

-- ─── 8. Источники, платформы, языки, версии алгоритма ──────────────────────────────────
create or replace function public.admin_stats_audience(
  p_from timestamptz,
  p_to timestamptz,
  p_exclude uuid default null,
  p_exclude_tg text default null
)
returns table (dimension text, label text, count int)
language sql
stable
security definer
set search_path = public
as $$
  -- users.source пуст у всех: startAppSession кладёт start_param только в app_sessions и
  -- в профиль его не переносит. Поэтому источник берётся из визитов, а не из users.
  select 'Источник визита', coalesce(s.source, 'прямое открытие'), count(*)::int
  from public.app_sessions s
  where s.started_at >= p_from and s.started_at < p_to
    and (p_exclude is null or s.user_id <> p_exclude)
  group by 2
  union all
  select 'Платформа', coalesce(s.platform, 'неизвестно'), count(*)::int
  from public.app_sessions s
  where s.started_at >= p_from and s.started_at < p_to
    and (p_exclude is null or s.user_id <> p_exclude)
  group by 2
  union all
  select 'Язык интерфейса', coalesce(u.language, 'не указан'), count(*)::int
  from public.users u
  where u.created_at >= p_from and u.created_at < p_to
    and (p_exclude is null or u.id <> p_exclude)
  group by 2
  union all
  select 'Версия алгоритма', o.algorithm_version, count(*)::int
  from public.events o
  where o.created_at >= p_from and o.created_at < p_to
    and (p_exclude_tg is null or o.user_id <> p_exclude_tg)
  group by 2
  order by 1, 3 desc;
$$;

-- ─── 9. Возврат ────────────────────────────────────────────────────────────────────────
-- Период здесь ограничивает только знаменатель (кого считаем), а визиты смотрятся за всю
-- историю: иначе «вернулся на следующий день» у человека, зарегистрированного в последний
-- день периода, не мог бы быть посчитан никогда.
create or replace function public.admin_stats_retention(
  p_from timestamptz,
  p_to timestamptz,
  p_exclude uuid default null
)
returns table (metric text, users int, base int, pct numeric, note text)
language sql
stable
security definer
set search_path = public
as $$
  with
  cohort as (
    select u.id, u.created_at from public.users u
    where u.created_at >= p_from and u.created_at < p_to
      and (p_exclude is null or u.id <> p_exclude)
  ),
  per_user as (
    select
      c.id,
      c.created_at,
      (select count(*) from public.app_sessions s where s.user_id = c.id) as visits,
      (select count(distinct (s.started_at at time zone 'Asia/Tashkent')::date)
        from public.app_sessions s where s.user_id = c.id) as days
    from cohort c
  ),
  -- на D1 можно смотреть только тех, кто успел прожить сутки
  eligible as (select * from per_user where created_at < now() - interval '1 day')
  select * from (
    values
      ('Заходили 2+ дня',
        (select count(*) from per_user where days > 1)::int,
        (select count(*) from per_user)::int,
        round(100.0 * (select count(*) from per_user where days > 1)
          / greatest((select count(*) from per_user), 1), 1),
        'все пользователи периода'),
      ('Больше одного визита',
        (select count(*) from per_user where visits > 1)::int,
        (select count(*) from per_user)::int,
        round(100.0 * (select count(*) from per_user where visits > 1)
          / greatest((select count(*) from per_user), 1), 1),
        'все пользователи периода'),
      ('Вернулись на следующий день',
        (select count(*) from eligible where days > 1)::int,
        (select count(*) from eligible)::int,
        round(100.0 * (select count(*) from eligible where days > 1)
          / greatest((select count(*) from eligible), 1), 1),
        'только те, кто старше суток')
  ) as t (metric, users, base, pct, note);
$$;

-- ─── 10. Сколько раз заходил один человек ──────────────────────────────────────────────
create or replace function public.admin_stats_visits_per_user(
  p_from timestamptz,
  p_to timestamptz,
  p_exclude uuid default null
)
returns table (bucket text, users int)
language sql
stable
security definer
set search_path = public
as $$
  with per_user as (
    select s.user_id, count(*) as n
    from public.app_sessions s
    where s.started_at >= p_from and s.started_at < p_to
      and (p_exclude is null or s.user_id <> p_exclude)
    group by 1
  )
  select
    case when n >= 4 then '4+' else n::text end as bucket,
    count(*)::int as users
  from per_user
  group by 1
  order by 1;
$$;

-- ─── 11. Починка admin_dau_wau из 009_metrics.sql ──────────────────────────────────────
-- Было: count(distinct user_id) filter (where created_at >= date_trunc('day', created_at)
-- - interval '6 days') — условие сравнивает строку с её же днём и всегда истинно, поэтому
-- wau_trailing_7d тождественно равнялся dau (видно в данных: за 17.10 оба по 10).
-- Стало: честное окно в 7 суток, и источником взяты app_sessions вместо user_events.
-- app_open теряется, когда trackEvent срабатывает до того, как доехала авторизация, а
-- строка в app_sessions пишется на каждый визит с профилем.
create or replace view public.admin_dau_wau as
with d as (
  select distinct
    (started_at at time zone 'Asia/Tashkent')::date as day,
    user_id
  from public.app_sessions
)
select
  d1.day,
  count(distinct d1.user_id) as dau,
  (select count(distinct d2.user_id) from d d2 where d2.day <= d1.day and d2.day > d1.day - 7) as wau_trailing_7d
from d d1
group by d1.day
order by d1.day desc;

-- ─── Права ─────────────────────────────────────────────────────────────────────────────
-- Отзываем execute со всех admin_stats_* сразу, по сигнатурам из pg_proc, а не руками.
--
-- Отзывать нужно именно у public, а не только у anon и authenticated: Postgres при
-- создании функции сам выдаёт execute роли public, в которую входят все остальные роли.
-- Проверено на одноразовом postgres: с отзывом только у anon и authenticated роль anon
-- спокойно вызывала admin_stats_kpi. После отзыва у public функции остаются доступны
-- только service_role, то есть Edge Function admin-stats, которая перед вызовом проверяет
-- подпись Telegram initData.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'admin\_stats\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- Пересозданная вью теряет настройки из 010/009, поэтому запираем её заново.
revoke all on public.admin_dau_wau from public, anon, authenticated;
alter view public.admin_dau_wau set (security_invoker = on);
