import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadMetricsData } from '@/lib/metricsData'
import { changesBetween } from '@/lib/replay'

// GET /api/changes?since=<ms> → what changed between then and now, from the replayed data
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { accts, sigs, now } = await loadMetricsData(supabase, claims.claims as Record<string, unknown>)
  const since = Number(req.nextUrl.searchParams.get('since')) || now - 7 * 864e5
  return NextResponse.json(changesBetween(accts, sigs, Math.min(since, now - 60_000), now))
}
