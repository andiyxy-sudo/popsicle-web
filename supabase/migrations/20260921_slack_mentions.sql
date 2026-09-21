-- @popsicle questions handed from the slack-events edge function to the portal.
-- Only the service role reads or writes it (row security on, no policies).
create table if not exists slack_mentions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  team text,
  channel text not null,
  ts text not null,
  thread_ts text,
  text text,
  slack_user text,
  answered_at timestamptz,
  unique (channel, ts)
);
alter table slack_mentions enable row level security;
