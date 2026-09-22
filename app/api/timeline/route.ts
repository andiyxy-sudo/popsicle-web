import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadMetricsData } from '@/lib/metricsData'
import { timeline } from '@/lib/replay'

// GET /api/timeline?days=56 → one replayed snapshot per day, with that day's events
const TL_CACHE = new Map<string, { at: number; body: unknown }>()

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { accts, sigs, now } = await loadMetricsData(supabase, claims.claims as Record<string, unknown>)
  const days = Math.min(366, Math.max(7, Number(req.nextUrl.searchParams.get('days')) || 56))   // up to a year (review's Year view)
  const key = `${claims.claims.sub}|${days}|${sigs.length}`
  const hit = TL_CACHE.get(key)
  if (hit && Date.now() - hit.at < 5 * 60_000) return NextResponse.json(hit.body)
  const body = { now, points: timeline(accts, sigs, now, days) }
  TL_CACHE.set(key, { at: Date.now(), body }); if (TL_CACHE.size > 100) TL_CACHE.delete(TL_CACHE.keys().next().value as string)
  return NextResponse.json(body)
}
