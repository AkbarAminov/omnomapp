-- Opt-in table for the bot's daily reminder (retention experiment #1, 2026-10-17). Deliberately
-- separate from public.users: that table is keyed by tg_hash (HMAC, never the raw Telegram id —
-- see auth-telegram/index.ts), while sending a Telegram message needs the real chat_id. Keeping
-- the raw id confined to this one opt-in table, written only by the bot (which already handles
-- the raw id transiently for every message), means the Mini App's own pipeline never touches it.
--
-- NOT applied automatically — review, then run by hand like every other file here.
create table if not exists public.reminder_subscribers (
  chat_id bigint primary key,
  opted_in boolean not null default true,
  created_at timestamptz not null default now(),
  last_reminded_at timestamptz
);

alter table public.reminder_subscribers enable row level security;
-- No policy for anon/authenticated at all — RLS denies by default. Only telegram-bot
-- (toggles opted_in) and send-reminders (reads + sets last_reminded_at) touch this table,
-- both via the service-role client, which bypasses RLS entirely.
revoke all on public.reminder_subscribers from anon, authenticated;
