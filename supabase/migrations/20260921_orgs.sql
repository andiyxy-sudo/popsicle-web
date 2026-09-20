-- =====================================================================
-- Organisations: teammates see each other's accounts, signals and sources.
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent).
-- =====================================================================

create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null default 'My team',
  owner_id uuid references auth.users(id) on delete set null
);

create table if not exists org_members (
  org_id uuid references orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member',            -- admin | member | viewer
  created_at timestamptz default now(),
  primary key (org_id, user_id)
);

-- Every existing user gets their own org (owner + admin member).
insert into orgs (name, owner_id)
select coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) || '''s team', u.id
from auth.users u
where not exists (select 1 from org_members m where m.user_id = u.id);

insert into org_members (org_id, user_id, role)
select o.id, o.owner_id, 'admin' from orgs o
where o.owner_id is not null
  and not exists (select 1 from org_members m where m.user_id = o.owner_id);

-- New sign-ups get an org automatically.
create or replace function public.handle_new_user_org()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  insert into orgs (name, owner_id) values (coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)) || '''s team', new.id) returning id into v_org;
  insert into org_members (org_id, user_id, role) values (v_org, new.id, 'admin');
  return new;
end $$;
drop trigger if exists on_auth_user_created_org on auth.users;
create trigger on_auth_user_created_org after insert on auth.users
  for each row execute function public.handle_new_user_org();

-- The user ids that share an org with the caller. Used by RLS and by the app.
create or replace function public.org_member_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select m2.user_id from org_members m1 join org_members m2 on m1.org_id = m2.org_id
  where m1.user_id = auth.uid()
$$;
grant execute on function public.org_member_ids() to authenticated;

-- Accepting an invite: an invited user (user_metadata.invited_by set by the invite route)
-- joins the inviter's org and leaves the solo org that the sign-up trigger created.
create or replace function public.join_inviter_org()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inviter uuid; v_org uuid; v_role text;
begin
  select (raw_user_meta_data->>'invited_by')::uuid, coalesce(raw_user_meta_data->>'role', 'member')
    into v_inviter, v_role from auth.users where id = auth.uid();
  if v_inviter is null then return null; end if;
  select org_id into v_org from org_members where user_id = v_inviter limit 1;
  if v_org is null then return null; end if;
  delete from org_members where user_id = auth.uid() and org_id <> v_org;
  insert into org_members (org_id, user_id, role) values (v_org, auth.uid(), v_role)
    on conflict (org_id, user_id) do update set role = excluded.role;
  update team_invites set status = 'accepted'
    where invited_by = v_inviter and lower(email) = lower((select email from auth.users where id = auth.uid()));
  return v_org;
end $$;
grant execute on function public.join_inviter_org() to authenticated;

-- Row security: read/write anything owned by someone in my org.
do $$
declare t text;
begin
  foreach t in array array['accounts', 'signals', 'integrations', 'messages', 'commitments', 'account_baselines', 'calendar_events', 'transcripts'] loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table %I enable row level security', t);
      execute format('drop policy if exists "org read" on %I', t);
      execute format('drop policy if exists "org write" on %I', t);
      execute format('create policy "org read" on %I for select using (user_id in (select public.org_member_ids()))', t);
      execute format('create policy "org write" on %I for all using (user_id in (select public.org_member_ids())) with check (user_id in (select public.org_member_ids()))', t);
    end if;
  end loop;
end $$;

alter table orgs enable row level security;
alter table org_members enable row level security;
drop policy if exists "my org" on orgs;
create policy "my org" on orgs for select using (id in (select org_id from org_members where user_id = auth.uid()));
drop policy if exists "my members" on org_members;
create policy "my members" on org_members for select using (user_id in (select public.org_member_ids()));
