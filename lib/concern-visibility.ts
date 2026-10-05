// Server-side twin of the concern_feed view, for code that runs WITHOUT a signed-in user (the service role):
// the Slack bot, the Slack digest cron. concern_feed itself returns nothing there, because it scopes rows to
// auth.uid(), and reading `signals` directly would hand a free workspace the text of Concerns it has not
// unlocked. So: read `signals` with the service role, then pass the rows through maskConcerns().
//
// The rule is NOT re-implemented here. It is the database's concern_visible_row(), asked piece by piece so a
// 5,000-row digest costs a handful of queries instead of one call per row:
//   visible = concern_always_visible(type) OR plan_is_paid(org plan) OR a concern_unlocks row for (org, id)
// Locked rows keep account, type, severity and timing; every detail field is nulled exactly as the view does,
// and the title becomes a safe line ("Competitor mention · unlock in Popsicle to read") so any text builder
// that prints a title says the right thing without changes.
import type { SupabaseClient } from '@supabase/supabase-js'
import { CONCERN_LABELS } from '@/lib/concern-labels'

type Row = Record<string, unknown>
const DETAIL = ['title', 'description', 'source_integration', 'source_message_id', 'risk_amount', 'impact_pct', 'raw_content', 'ai_analysis', 'corroboration'] as const

export function lockedTitle(signalType: unknown): string {
  return `${CONCERN_LABELS[String(signalType ?? '')] ?? 'Concern'} · unlock in Popsicle to read`
}

/** Rows must include id, user_id and signal_type. Returns the same rows with `locked` set and detail hidden. */
export async function maskConcerns<T extends Row>(db: SupabaseClient, rows: T[]): Promise<Array<T & { locked: boolean }>> {
  if (!rows.length) return []
  const owners = [...new Set(rows.map(r => String(r.user_id)))]
  const types = [...new Set(rows.map(r => String(r.signal_type ?? '')))]

  // owner → org → paid?
  const { data: mem } = await db.from('org_members').select('user_id, org_id').in('user_id', owners)
  const orgOf = new Map(((mem ?? []) as Row[]).map(m => [String(m.user_id), String(m.org_id)]))
  const orgIds = [...new Set(orgOf.values())]
  const { data: orgs } = orgIds.length ? await db.from('orgs').select('id, plan').in('id', orgIds) : { data: [] }
  const paid = new Map<string, boolean>()
  for (const o of (orgs ?? []) as Row[]) {
    const { data } = await db.rpc('plan_is_paid', { p: o.plan })
    paid.set(String(o.id), data === true)
  }

  // which types are always readable (asked of the database, never hard-coded)
  const always = new Map<string, boolean>()
  await Promise.all(types.map(async t => { const { data } = await db.rpc('concern_always_visible', { t }); always.set(t, data === true) }))

  // which of these Concerns each org has unlocked
  const unlocked = new Set<string>()
  const freeOrgs = orgIds.filter(o => !paid.get(o))
  if (freeOrgs.length) {
    const ids = rows.map(r => String(r.id))
    for (let i = 0; i < ids.length; i += 500) {
      const { data } = await db.from('concern_unlocks').select('org_id, signal_id').in('org_id', freeOrgs).in('signal_id', ids.slice(i, i + 500))
      for (const u of (data ?? []) as Row[]) unlocked.add(`${u.org_id}:${u.signal_id}`)
    }
  }

  return rows.map(r => {
    const org = orgOf.get(String(r.user_id))
    // fail closed: an owner with no org, or a lookup that failed, reads as locked
    const visible = always.get(String(r.signal_type ?? '')) === true
      || (!!org && paid.get(org) === true)
      || (!!org && unlocked.has(`${org}:${r.id}`))
    if (visible) return { ...r, locked: false }
    const out: Row = { ...r, locked: true }
    for (const k of DETAIL) if (k in out) out[k] = null
    if ('title' in r) out.title = lockedTitle(r.signal_type)
    return out as T & { locked: boolean }
  })
}
