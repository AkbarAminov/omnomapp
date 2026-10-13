-- Profile-scoped sessions + events. NOT applied automatically — review, then run by hand.
-- Named app_sessions/user_events on purpose: public.events already exists (scripts/sql/004)
-- with a different, open-RLS shape and is actively written by src/logic/analytics.ts — left
-- untouched. These are the new, auth-scoped tables used by src/logic/metrics.ts only.

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  app_version text,
  platform text,
  source text
);
create index if not exists app_sessions_user_idx on public.app_sessions (user_id);

alter table public.app_sessions enable row level security;
drop policy if exists "users insert own sessions" on public.app_sessions;
create policy "users insert own sessions" on public.app_sessions for insert with check (user_id = auth.uid());
grant insert on public.app_sessions to authenticated;
-- No select/update/delete policy for anon/authenticated → denied by default.

create table if not exists public.user_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.app_sessions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  event_name text not null,
  properties jsonb not null default '{}',
  created_at timestamptz not null default now(),
  app_version text
);
create index if not exists user_events_name_idx on public.user_events (event_name, created_at);
create index if not exists user_events_user_idx on public.user_events (user_id);

alter table public.user_events enable row level security;
drop policy if exists "users insert own events" on public.user_events;
create policy "users insert own events" on public.user_events for insert with check (user_id = auth.uid());
grant insert on public.user_events to authenticated;
-- No select/update/delete policy for anon/authenticated → denied by default.

-- ─── Admin views — только для SQL editor / service_role. Одного «не выдавать grant» мало:
-- в Supabase на public-схеме есть default privileges для anon и authenticated, поэтому права
-- на новую вью выдаются сами, а вью по умолчанию исполняется с правами владельца и RLS
-- нижележащих таблиц обходит. Поэтому ниже, после создания, права явно отзываются и вью
-- переводятся на security_invoker (см. также 010_admin_views_lockdown.sql). ───────────────

create or replace view public.admin_funnel as
select event_name, count(distinct session_id) as sessions
from public.user_events
where event_name in ('app_open', 'quiz_start', 'question_shown', 'results_shown', 'dish_selected')
group by event_name
order by sessions desc;

create or replace view public.admin_dau_wau as
select
  date_trunc('day', created_at)::date as day,
  count(distinct user_id) filter (where event_name = 'app_open') as dau,
  count(distinct user_id) filter (
    where event_name = 'app_open'
    and created_at >= date_trunc('day', created_at) - interval '6 days'
  ) as wau_trailing_7d
from public.user_events
group by 1
order by 1 desc;

create or replace view public.admin_quiz_completion as
select
  count(distinct session_id) filter (where event_name = 'quiz_start') as quiz_started,
  count(distinct session_id) filter (where event_name = 'results_shown') as quiz_completed,
  round(
    100.0 * count(distinct session_id) filter (where event_name = 'results_shown')
    / greatest(count(distinct session_id) filter (where event_name = 'quiz_start'), 1),
    1
  ) as completion_pct
from public.user_events;

create or replace view public.admin_avg_questions as
select avg(cnt)::numeric(10, 2) as avg_questions_per_session
from (
  select session_id, count(*) as cnt
  from public.user_events
  where event_name = 'answer_given'
  group by session_id
) per_session;

create or replace view public.admin_top_dishes as
select properties ->> 'dish_id' as dish_id, count(*) as selections
from public.user_events
where event_name = 'dish_selected'
group by 1
order by selections desc
limit 50;

create or replace view public.admin_feedback_share as
select
  properties ->> 'value' as value,
  count(*) as n,
  round(100.0 * count(*) / greatest(sum(count(*)) over (), 1), 1) as pct
from public.user_events
where event_name = 'result_feedback'
group by 1;

create or replace view public.admin_breakdown as
select
  u.source,
  u.language,
  count(distinct e.session_id) filter (where e.event_name = 'quiz_start') as quiz_started,
  count(distinct e.session_id) filter (where e.event_name = 'results_shown') as quiz_completed
from public.user_events e
join public.users u on u.id = e.user_id
group by u.source, u.language
order by quiz_started desc;

do $$
declare v text;
begin
  foreach v in array array[
    'admin_funnel', 'admin_dau_wau', 'admin_quiz_completion', 'admin_avg_questions',
    'admin_top_dishes', 'admin_feedback_share', 'admin_breakdown'
  ] loop
    execute format('revoke all on public.%I from anon, authenticated', v);
    execute format('alter view public.%I set (security_invoker = on)', v);
  end loop;
end $$;
