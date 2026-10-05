-- Concern Engine enforced at the database, for every producer (detect-signal, slack-detect,
-- analyze-transcript, stall-nudges, and anything added later). Mirrors lib/settings.ts exactly:
-- same switches, same defaults, same 0 / 70 / 90 sensitivity floors, critical (high) always passes.
-- A Concern the person's settings rule out is filed as deleted with reason 'concern_engine':
-- hidden everywhere, not billed, but still countable.
create or replace function public.concern_engine_gate() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  ce jsonb; k text; on_ boolean; floor_ numeric; conf numeric;
  defaults constant jsonb := '{"ce_exec":true,"ce_price":true,"ce_comp":true,"ce_time":true,"ce_legal":true,"ce_champ":true,"ce_usage":true,"ce_sent":false,"ce_expand":true}';
begin
  if new.severity = 'high' then return new; end if;               -- critical always passes
  select coalesce(raw_user_meta_data->'concern_engine', '{}'::jsonb) into ce from auth.users where id = new.user_id;
  ce := coalesce(ce, '{}'::jsonb);

  k := case
    when new.signal_type in ('silent_stall','meeting_declined') then 'ce_exec'
    when new.signal_type = 'price_flinch' then 'ce_price'
    when new.signal_type = 'competitor_mention' then 'ce_comp'
    when new.signal_type in ('timeline_slip','meeting_cancelled','deal_stage_backward') then 'ce_time'
    when new.signal_type = 'legal_loopin' then 'ce_legal'
    when new.signal_type = 'champion_change' then 'ce_champ'
    when new.signal_type = 'call_sentiment_drop' then 'ce_sent'
    when new.signal_type in ('call_buying_signal','reengaged') then 'ce_expand'
  end;                                                              -- types no switch covers stay on
  if k is not null then
    on_ := case when jsonb_typeof(ce->k) = 'boolean' then (ce->>k)::boolean else (defaults->>k)::boolean end;
    if not on_ then
      new.status := 'deleted'; new.deleted_at := now(); new.deleted_reason := 'concern_engine'; return new;
    end if;
  end if;

  floor_ := case ce->>'sens' when 'Early warning' then 0 when 'High confidence only' then 90 else 70 end;
  if jsonb_typeof(new.ai_analysis->'confidence') = 'number' then  -- no confidence recorded: let it through
    conf := (new.ai_analysis->>'confidence')::numeric;
    if conf <= 1 then conf := conf * 100; end if;                   -- tolerate 0-1 fractions
    if conf < floor_ then
      new.status := 'deleted'; new.deleted_at := now(); new.deleted_reason := 'concern_engine'; return new;
    end if;
  end if;
  return new;
end $fn$;

drop trigger if exists signals_concern_engine on public.signals;
create trigger signals_concern_engine before insert on public.signals
  for each row execute function public.concern_engine_gate();

-- Billing: a Concern the engine suppressed was never raised, so it is not counted.
create or replace function public.entitlements() returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid := auth.uid(); org uuid; o record; p record; paid boolean; used_sources int; used_accounts int; fired int;
begin
  if uid is null then return null; end if;
  org := public.org_of_user(uid);
  if org is null then return null; end if;
  perform public.grant_first_three(org);
  select * into o from public.orgs where id = org;
  select * into p from public.org_period(org);
  paid := public.plan_is_paid(o.plan);
  select count(distinct provider) into used_sources from public.integrations
    where is_active and not public.is_calendar_source(provider)
      and user_id in (select user_id from public.org_members where org_id = org);
  select count(*) into used_accounts from public.accounts
    where user_id in (select user_id from public.org_members where org_id = org);
  select count(*) into fired from public.signals
    where user_id in (select user_id from public.org_members where org_id = org)
      and created_at >= p.period_start and created_at < p.period_end
      and coalesce(deleted_reason, '') <> 'concern_engine';
  return jsonb_build_object(
    'plan', o.plan, 'paid', paid,
    'unlocks_per_month', case when paid then null else o.unlocks_per_month end,
    'unlocks_left', case when paid then null else public.unlocks_left(org) end,
    'period_start', p.period_start, 'resets_on', p.period_end,
    'max_sources', case when paid then null else o.max_sources end, 'sources_used', used_sources,
    'max_accounts', case when paid then null else o.max_accounts end, 'accounts_used', used_accounts,
    'band', public.plan_band(o.plan), 'concerns_this_period', fired,
    'over_band', coalesce(fired > public.plan_band(o.plan), false)
  );
end $function$;
