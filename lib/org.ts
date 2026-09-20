// Organisation scope. Every read that used to be `.eq('user_id', me)` now uses
// `.in('user_id', await orgIds…(me))`: the ids of everyone in my org (always
// includes me). Falls back to [me] if the orgs migration has not been applied.
import type { SupabaseClient } from '@supabase/supabase-js'

async function fetchIds(client: SupabaseClient, me: string): Promise<string[]> {
  try {
    const { data, error } = await client.rpc('org_member_ids')
    if (error || !Array.isArray(data) || data.length === 0) return [me]
    const ids = (data as Array<string | { org_member_ids: string }>).map(x => typeof x === 'string' ? x : x.org_member_ids).filter(Boolean)
    return ids.includes(me) ? ids : [me, ...ids]
  } catch { return [me] }
}

// server: fresh per request
export async function orgIdsServer(client: SupabaseClient, me: string): Promise<string[]> { return fetchIds(client, me) }

// browser: cached per user for the session
const cache = new Map<string, Promise<string[]>>()
export function orgIdsBrowser(client: SupabaseClient, me: string): Promise<string[]> {
  let p = cache.get(me)
  if (!p) { p = fetchIds(client, me); cache.set(me, p) }
  return p
}
