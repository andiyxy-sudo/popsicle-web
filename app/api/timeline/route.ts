import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadMetricsData } from '@/lib/metricsData'
import { timeline } from '@/lib/replay'

// GET /api/timeline?days=56 → one replayed snapshot per day, with that day's events
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { accts, sigs, now } = await loadMetricsData(supabase, claims.claims as Record<string, unknown>)
  const days = Math.min(120, Math.max(7, Number(req.nextUrl.searchParams.get('days')) || 56))
  return NextResponse.json({ now, points: timeline(accts, sigs, now, days) })
}
