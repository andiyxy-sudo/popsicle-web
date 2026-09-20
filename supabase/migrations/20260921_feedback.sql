-- Signal quality feedback (v11.84). Run in Supabase → SQL Editor.
create table if not exists signal_feedback (
  signal_id uuid references signals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  rating smallint not null,                      -- 1 = useful, -1 = wrong call
  note text,
  created_at timestamptz default now(),
  primary key (signal_id, user_id)
);
alter table signal_feedback enable row level security;
drop policy if exists "org feedback" on signal_feedback;
create policy "org feedback" on signal_feedback for all
  using (user_id in (select public.org_member_ids()))
  with check (user_id in (select public.org_member_ids()));

-- Accuracy for the org: share of rated signals marked useful.
create or replace function public.signal_accuracy()
returns table (rated bigint, useful bigint, pct numeric)
language sql stable security definer set search_path = public as $$
  select count(*)::bigint,
         count(*) filter (where rating > 0)::bigint,
         case when count(*) = 0 then null else round(100.0 * count(*) filter (where rating > 0) / count(*), 0) end
  from signal_feedback where user_id in (select public.org_member_ids())
$$;
grant execute on function public.signal_accuracy() to authenticated;
