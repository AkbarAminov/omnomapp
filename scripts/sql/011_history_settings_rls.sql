-- Closes the RLS hole on history/user_settings. Unlike every other table in this project
-- these two were never given a schema file — they predate the migration workflow — and
-- still carry an open `for all using(true) with check(true))` policy, confirmed live via
-- curl: the public anon key (shipped in the client bundle) can read, update and delete
-- every user's history, raw Telegram ids included.
--
-- NOT applied automatically — review, then run by hand like every other file here. Deploy
-- order matters: push the app build (historyStorage.ts/settingsStorage.ts now write/read
-- using auth.uid() instead of the raw Telegram id) and the updated auth-telegram edge
-- function (backfills old rows to the real UUID on every login) FIRST, and only run this
-- file once that's live and real users have had a chance to reopen the app — otherwise any
-- client still running the old bundle starts failing RLS on every history/settings write.
--
-- user_id on both tables predates auth.uid() and was keyed by the raw Telegram id. The
-- edge function's backfill may already have promoted some rows to the real uuid by the
-- time this runs. Casting both sides to text makes the comparison correct either way,
-- without needing to know (or change) the column's actual declared type.

-- Drop every existing policy on both tables by name, read from pg_policies, instead of
-- hardcoding a guess at what the open policy above is actually called.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'history'
  loop
    execute format('drop policy %I on public.history', p.policyname);
  end loop;
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'user_settings'
  loop
    execute format('drop policy %I on public.user_settings', p.policyname);
  end loop;
end $$;

alter table public.history enable row level security;
alter table public.user_settings enable row level security;

create policy "users manage own history" on public.history
  for all
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);

create policy "users manage own settings" on public.user_settings
  for all
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);

-- Supabase's public-schema default privileges silently grant anon table-level access on
-- new objects (same issue 010_admin_views_lockdown.sql found for views) — that is almost
-- certainly how anon got read/write here in the first place, so revoke explicitly rather
-- than relying on RLS alone to be the only thing standing in the way.
revoke all on public.history from anon;
revoke all on public.user_settings from anon;
grant select, insert, update, delete on public.history to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
