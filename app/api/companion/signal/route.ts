import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadMetricsData } from '@/lib/metricsData'

// GET /api/companion/signal?account=Acme Corp → the newest open signal for that account.
// Demo-aware: the demo workspace has no rows in the database, so this reads the same demo set every page uses.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const account = (new URL(req.url).searchParams.get('account') ?? '').trim().toLowerCase()
  if (!account) return NextResponse.json({ error: 'no_account' }, { status: 400 })
  const { sigs, demo } = await loadMetricsData(supabase, claims.claims as Record<string, unknown>)
  const mine = sigs.filter(s => (s.account_name ?? '').toLowerCase().includes(account))
  const open = mine.filter(s => !s.is_dismissed && (!s.status || s.status === 'open'))
  const pick = [...(open.length ? open : mine)].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))[0]
  if (!pick) return NextResponse.json({ error: 'no_signal' }, { status: 404 })
  return NextResponse.json({ id: pick.id, title: pick.title, account: pick.account_name, demo })
}
