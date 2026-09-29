-- Live quiz answers for calibration (npm run calibrate). Safe to re-run.
-- One row per answered question; written once at the end of a session.
create table if not exists public.session_answers (
  id bigint generated always as identity primary key,
  session_id text not null,
  mode text not null check (mode in ('meal', 'snack', 'dessert')),
  cuisine text not null,
  question_id text not null,
  answer text not null check (answer in ('yes', 'no', 'any')),
  guessed_dish_id text,
  target_dish_id text,
  algorithm_version text,
  created_at timestamptz not null default now()
);
create index if not exists session_answers_target_idx on public.session_answers (target_dish_id, question_id);
create index if not exists session_answers_session_idx on public.session_answers (session_id);

-- Players may only add rows; reading is for the service key (calibration script).
alter table public.session_answers enable row level security;
drop policy if exists "players can add answers" on public.session_answers;
create policy "players can add answers" on public.session_answers for insert with check (true);
grant insert on public.session_answers to anon, authenticated;
