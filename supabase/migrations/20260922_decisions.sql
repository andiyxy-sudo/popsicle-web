-- Decisions: institutional memory. Every decision is stored with the evidence that existed at
-- the moment it was made (the figures, and the signals with their words), so "why did we
-- discount Acme?" has an answer months later, even after people and accounts change hands.
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_name text,
  decision text not null,
  owner text,
  due_at timestamptz,
  status text not null default 'open',          -- open | done | reversed
  source text not null default 'review',        -- review | account | ask
  review_id text,                               -- groups the decisions made in one review session
  evidence jsonb not null default '{}'::jsonb,  -- snapshot: figures + signals (title, quote, source, time)
  commitment_id uuid,                           -- the tracked follow-up, when one was created
  created_at timestamptz not null default now()
);
create index if not exists decisions_account_idx on public.decisions (account_name, created_at desc);
alter table public.decisions enable row level security;
drop policy if exists decisions_org_read on public.decisions;
create policy decisions_org_read on public.decisions for select using (user_id in (select public.org_member_ids()));
drop policy if exists decisions_own_write on public.decisions;
create policy decisions_own_write on public.decisions for insert with check (user_id = auth.uid());
drop policy if exists decisions_own_update on public.decisions;
create policy decisions_own_update on public.decisions for update using (user_id in (select public.org_member_ids()));
notify pgrst, 'reload schema';
