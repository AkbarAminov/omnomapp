-- Profile table for Telegram users. NOT applied automatically — review, then run by hand
-- the same way as the other scripts/sql files (psql via DATABASE_URL, or the SQL editor).
--
-- id is NOT its own gen_random_uuid(): this project's Supabase Auth uses asymmetric
-- (ES256) JWT signing keys, so an Edge Function cannot self-sign a token whose `sub`
-- matches an arbitrary id. Instead the Edge Function creates a real auth.users row
-- (via the admin API) per Telegram user and sets public.users.id to that same id —
-- the standard Supabase "profiles" pattern. That is what makes `id = auth.uid()` true.
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  tg_hash text unique not null,
  language text,
  source text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

alter table public.users enable row level security;

-- Read-only for the owner. No insert/update/delete policy for anon/authenticated at all —
-- RLS denies by default what no policy allows, so the row can only be written by the
-- Edge Function's service_role client, which bypasses RLS entirely.
drop policy if exists "users read own row" on public.users;
create policy "users read own row" on public.users for select using (id = auth.uid());
grant select on public.users to authenticated;
