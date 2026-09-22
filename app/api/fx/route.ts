import { NextResponse } from 'next/server'
import { FALLBACK_RATES, type CurrencyCode } from '@/lib/currency'

// GET /api/fx → exchange rates per US dollar for the display currencies, refreshed at most twice a day
// (open.er-api.com, free). If the source can't be reached, the built-in rates are used and marked as such.
let cache: { at: number; body: { rates: Record<CurrencyCode, number>; updated: string; source: 'live' | 'fallback' } } | null = null
export async function GET() {
  if (cache && Date.now() - cache.at < 12 * 3600e3) return NextResponse.json(cache.body)
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
    const j = await r.json() as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string }
    if (j.result !== 'success' || !j.rates) throw new Error('bad response')
    const rates = Object.fromEntries(Object.keys(FALLBACK_RATES).map(k => [k, j.rates![k] ?? FALLBACK_RATES[k as CurrencyCode]])) as Record<CurrencyCode, number>
    cache = { at: Date.now(), body: { rates, updated: j.time_last_update_utc ?? new Date().toUTCString(), source: 'live' } }
  } catch {
    cache = { at: Date.now() - 11 * 3600e3, body: { rates: FALLBACK_RATES, updated: 'built-in rates', source: 'fallback' } }   // retry within the hour
  }
  return NextResponse.json(cache.body)
}
