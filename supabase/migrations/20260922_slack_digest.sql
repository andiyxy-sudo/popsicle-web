-- Daily Slack briefing: where and when each team gets its "top 5 risks", and whether each linked
-- deal channel gets its own daily update (only on days something changed on that deal).
create table if not exists public.slack_digests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  channel_id text,
  channel_name text,
  send_hour int not null default 9 check (send_hour between 0 and 23),
  timezone text not null default 'UTC',
  deal_updates boolean not null default false,
  last_sent_on date,
  last_deal_updates_on date,
  updated_at timestamptz not null default now()
);
alter table public.slack_digests enable row level security;
drop policy if exists slack_digests_own on public.slack_digests;
create policy slack_digests_own on public.slack_digests for all using (user_id = auth.uid()) with check (user_id = auth.uid());
notify pgrst, 'reload schema';

-- The schedule. Needs the pg_cron and pg_net extensions (Database → Extensions → enable both).
-- Replace YOUR_CRON_SECRET with the same value you set as CRON_SECRET in Vercel, then run:
--
-- select cron.schedule('popsicle-slack-digest', '0 * * * *', $$
--   select net.http_get(
--     url := 'https://portal.popsicle-labs.app/api/cron/slack-digest',
--     headers := jsonb_build_object('x-cron-key', 'YOUR_CRON_SECRET')
--   );
-- $$);
