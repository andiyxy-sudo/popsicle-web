-- APPLIED to project jvxfcvkxaqwcnkrxexso on 2026-09-22 (migration "create_decisions"). Kept here as the record;
-- safe to re-run (idempotent).
--
-- Decisions: institutional memory. Each decision is stored with a snapshot of the evidence that existed when it
-- was made, so the reasoning survives after people and accounts change hands.
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_name text,
  decision text not null check (length(trim(decision)) > 0),
  owner text,                                   -- the person responsible (free text, e.g. 'Andy G')
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'done', 'reversed')),
  source text not null default 'review' check (source in ('review', 'account', 'ask')),
  review_id text,                               -- groups the decisions made in one review session
  evidence jsonb not null default '{}'::jsonb,  -- { capturedAt, figures: {...}, signals: [...] }
  commitment_id uuid references public.commitments(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists decisions_account_idx on public.decisions (account_name, created_at desc);
create index if not exists decisions_user_idx on public.decisions (user_id, created_at desc);

alter table public.decisions enable row level security;
drop policy if exists decisions_org_read on public.decisions;
create policy decisions_org_read on public.decisions for select using (user_id in (select public.org_member_ids()));
drop policy if exists decisions_own_write on public.decisions;
create policy decisions_own_write on public.decisions for insert with check (user_id = auth.uid());
drop policy if exists decisions_org_update on public.decisions;
create policy decisions_org_update on public.decisions for update
  using (user_id in (select public.org_member_ids())) with check (user_id in (select public.org_member_ids()));
drop policy if exists decisions_own_delete on public.decisions;
create policy decisions_own_delete on public.decisions for delete using (user_id = auth.uid());

notify pgrst, 'reload schema';
