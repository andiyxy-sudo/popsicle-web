-- APPLIED to project jvxfcvkxaqwcnkrxexso on 2026-09-23 (migration "sends_log"). Kept as the record.
create table if not exists public.sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_name text, to_email text not null, subject text, signal_id uuid,
  message_id text, threaded boolean default false,
  mode text not null default 'manual', approved_by text,
  created_at timestamptz not null default now()
);
alter table public.sends enable row level security;
create index if not exists sends_user_idx on public.sends (user_id, created_at desc);
create index if not exists sends_account_idx on public.sends (account_name, created_at desc);
drop policy if exists "sends: own read" on public.sends;
create policy "sends: own read" on public.sends for select using (auth.uid() = user_id);
drop policy if exists "sends: own insert" on public.sends;
create policy "sends: own insert" on public.sends for insert with check (auth.uid() = user_id);
