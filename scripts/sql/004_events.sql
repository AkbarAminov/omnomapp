-- Analytics events + algorithm versioning. Safe to re-run; never drops data.
-- Run in the Supabase SQL editor after 003_session_answers.sql.

create table if not exists public.events (
  id bigint generated always as identity primary key,
  event text not null,
  user_id text not null,
  algorithm_version text not null,
  session_id text,
  mode text,
  cuisine text,
  dish_id text,
  question_id text,
  answer text,
  question_index int,
  props jsonb not null default '{}',
  client_ts timestamptz not null,
  created_at timestamptz not null default now()
);

-- Hot dimensions are real columns so the MVP metrics are plain SQL; the rest lives in props.
create index if not exists events_event_idx on public.events (event, created_at);
create index if not exists events_session_idx on public.events (session_id);
create index if not exists events_version_idx on public.events (algorithm_version, event);

alter table public.events enable row level security;
drop policy if exists "players can add events" on public.events;
create policy "players can add events" on public.events for insert with check (true);
grant insert on public.events to anon, authenticated;

-- Answers of a session must be attributable to the rules that produced them.
-- Guarded so this file does not depend on 003 having run first: the editor wraps the
-- script in one transaction, and a missing table would roll back the events table too.
do $$
begin
  if to_regclass('public.session_answers') is not null then
    alter table public.session_answers add column if not exists algorithm_version text;
  end if;
end $$;
