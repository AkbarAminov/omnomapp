-- Исправления к 014_admin_stats.sql. NOT applied automatically — review, then run by hand.
-- Только create or replace двух функций: таблицы, данные и остальные восемь функций не
-- затрагиваются.
--
-- ─── Что именно было не так ────────────────────────────────────────────────────────────
--
-- 1. WAU и MAU в admin_stats_kpi зависели от выбранного периода, а не должны. CTE `s`
--    урезал app_sessions до [p_from, p_to), и окна «7 суток» и «30 суток» применялись уже
--    внутри этого урезанного набора. На периоде «Сегодня» внутри окна оставались только
--    сегодняшние визиты, и WAU схлопывался в DAU. Проверено на живой базе до правки:
--      Сегодня     dau=18  wau=18  mau=18   ← неправда, настоящий WAU 41
--      7 дней      dau=18  wau=41  mau=41
--      Всё время   dau=18  wau=41  mau=41
--    WAU и MAU по определению не зависят от того, какой период выбран в панели: это всегда
--    «уникальные за последние 7 и 30 суток на конец периода». Теперь оба считаются из
--    полной таблицы, а не из урезанной.
--
-- 2. n у «Повторных подборов» в admin_stats_quality был равен общему числу событий (1002 на
--    живой базе) — то есть подпись «посчитано на n событиях» просто врала. Знаменатель у
--    этой метрики — подборы, а не все события.

-- ─── 1. admin_stats_kpi: WAU и MAU больше не зависят от периода ────────────────────────
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
  -- визиты периода: всё, что считается «за период»
  s as (
    select * from public.app_sessions
    where started_at >= p_from and started_at < p_to
      and (p_exclude is null or user_id <> p_exclude)
  ),
  -- визиты за всю историю: DAU, WAU и MAU — это скользящие окна на конец периода, и
  -- границы периода на них не влияют
  s_all as (
    select * from public.app_sessions
    where (p_exclude is null or user_id <> p_exclude)
  ),
  ev as (
    select e.* from public.user_events e
    where e.created_at >= p_from and e.created_at < p_to
      and (p_exclude is null or e.user_id <> p_exclude)
  ),
  last_day as (select (p_to at time zone 'Asia/Tashkent')::date - 1 as d),
  old as (
    select o.* from public.events o
    where o.created_at >= p_from and o.created_at < p_to
      and (p_exclude_tg is null or o.user_id <> p_exclude_tg)
  ),
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
        (select count(distinct user_id) from s_all
          where (started_at at time zone 'Asia/Tashkent')::date = (select d from last_day))::numeric,
        'чел', 'public.app_sessions (последние сутки периода)'),
      ('wau',
        (select count(distinct user_id) from s_all
          where started_at >= p_to - interval '7 days' and started_at < p_to)::numeric,
        'чел', 'public.app_sessions (7 суток на конец периода)'),
      ('mau',
        (select count(distinct user_id) from s_all
          where started_at >= p_to - interval '30 days' and started_at < p_to)::numeric,
        'чел', 'public.app_sessions (30 суток на конец периода)'),
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

-- ─── 2. admin_stats_quality: честный знаменатель у повторных подборов ──────────────────
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
  ),
  starts as (
    select count(distinct session_id) as n from ev where event_name = 'quiz_start'
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
      -- Было (select count(*) from ev) — общее число событий, то есть подпись врала.
      ('Повторных подборов',
        (select count(*) from ev where event_name = 'restart')::numeric,
        'шт', (select n from starts)::int, 'user_events.restart')
  ) as t (metric, value, unit, n, source);
$$;

-- Привилегии create or replace сохраняет, но повторяем явно: цена нулевая, а цена ошибки
-- здесь — открытые наружу агрегаты.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('admin_stats_kpi', 'admin_stats_quality')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
