-- Run after 20260921_orgs.sql. Adds member email lookup and safe removal.

-- Emails for the people in your own org (auth.users is not readable directly).
create or replace view public.user_emails as
  select u.id, u.email, coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) as name
  from auth.users u
  where u.id in (select public.org_member_ids());
grant select on public.user_emails to authenticated;

-- Remove a teammate: they leave this org and get one of their own back.
create or replace function public.remove_org_member(target uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_role text; v_new uuid;
begin
  select org_id, role into v_org, v_role from org_members where user_id = auth.uid();
  if v_org is null or v_role <> 'admin' then raise exception 'admin only'; end if;
  if target = auth.uid() then raise exception 'cannot remove yourself'; end if;
  if exists (select 1 from orgs where id = v_org and owner_id = target) then raise exception 'cannot remove the owner'; end if;
  delete from org_members where org_id = v_org and user_id = target;
  insert into orgs (name, owner_id)
    values (coalesce((select raw_user_meta_data->>'name' from auth.users where id = target), 'My') || '''s team', target)
    returning id into v_new;
  insert into org_members (org_id, user_id, role) values (v_new, target, 'admin');
  return true;
end $$;
grant execute on function public.remove_org_member(uuid) to authenticated;
