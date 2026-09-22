import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { orgIdsServer } from '@/lib/org'

// GET /api/onboarding → where a new workspace stands: its sources (connected, still reading, or needing
// reconnection), whether any signals or accounts exist yet, the person's job title, Slack channel choices
// and team size. Drives the first-run panel on Pulse. The demo account is never "new".
export async function GET() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((claims.claims.email as string | undefined) === 'demo@popsicle-labs.app') return NextResponse.json({ demo: true })
  const me = claims.claims.sub as string
  const ids = await orgIdsServer(supabase, me)
  const [integ, sigs, accts, tracked] = await Promise.all([
    supabase.from('integrations').select('provider, connected_at, last_synced_at, deep_backfilled_at, needs_reconnect').in('user_id', ids).eq('is_active', true),
    supabase.from('signals').select('id', { count: 'exact', head: true }).in('user_id', ids),
    supabase.from('accounts').select('id', { count: 'exact', head: true }).in('user_id', ids),
    supabase.from('slack_tracked_channels').select('channel_id', { count: 'exact', head: true }).in('user_id', ids).eq('is_tracked', true),
  ])
  const seen = new Set<string>()
  const sources = ((integ.data ?? []) as Array<{ provider: string; connected_at: string | null; last_synced_at: string | null; deep_backfilled_at: string | null; needs_reconnect: boolean | null }>)
    .filter(r => (seen.has(r.provider) ? false : (seen.add(r.provider), true)))
    .map(r => ({ provider: r.provider, connectedAt: r.connected_at, reading: !r.deep_backfilled_at && !r.needs_reconnect, needsReconnect: !!r.needs_reconnect }))
  const meta = (claims.claims.user_metadata ?? {}) as { role?: string }
  return NextResponse.json({
    sources, signals: sigs.count ?? 0, accounts: accts.count ?? 0, slackChannels: tracked.count ?? 0,
    role: meta.role?.trim() || null, teamSize: ids.length,
  })
}
