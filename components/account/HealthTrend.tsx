'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { healthTone } from '@/lib/utils'

// Health over the last 30 days. Days the server actually recorded are drawn solid; days rebuilt from
// the email pattern during the first read are ESTIMATES and drawn dashed, with a note, because a
// chart that cannot tell you which is which is worse than no chart.
type Day = { day: string; health: number; estimated: boolean | null }

export function HealthTrend({ accountId, current }: { accountId: string | null; current?: number | null }) {
  const [days, setDays] = useState<Day[] | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    if (!accountId) { setDays([]); return }
    let dead = false
    ;(async () => {
      const supabase = createClient()
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const { data } = await supabase.from('account_health_history')
        .select('day, health, estimated').eq('account_id', accountId).gte('day', since).order('day')
      if (!dead) setDays((data ?? []) as Day[])
    })()
    return () => { dead = true }
  }, [accountId])

  if (!days || days.length < 2) return null          // one point is not a trend

  // The chart scales to the data it has, not to 0-100: a score that moves between 40 and 62 was a flat
  // thread across an empty box before, which told you nothing. Thresholds are drawn only when they fall
  // inside the visible range, so the lines always mean something.
  const vals = days.map(d => d.health)
  const lo = Math.max(0, Math.min(...vals) - 8)
  const hi = Math.min(100, Math.max(...vals) + 8)
  const W = 560, H = 132, pad = 6
  const xs = (i: number) => pad + (i / (days.length - 1)) * (W - pad * 2)
  const ys = (v: number) => H - pad - ((Math.max(lo, Math.min(hi, v)) - lo) / Math.max(1, hi - lo)) * (H - pad * 2)
  const path = (subset: Day[]) => subset.map((d, i) => `${i ? 'L' : 'M'}${xs(days.indexOf(d))},${ys(d.health)}`).join(' ')
  const real = days.filter(d => !d.estimated)
  const est = days.filter(d => d.estimated)
  const first = days[0], last = days[days.length - 1]
  const change = last.health - first.health
  const shown = hover != null ? days[hover] : null
  const tone = healthTone(last.health)
  const area = real.length > 1 ? `${path(real)} L${xs(days.length - 1)},${H - pad} L${xs(days.indexOf(real[0]))},${H - pad} Z` : ''
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

  return (
    <section style={{ marginTop: 'var(--gap-l, 40px)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
        <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 21, letterSpacing: '-.03em', margin: 0, color: 'var(--ink)' }}>Health</h2>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          {days.length} days
        </span>
      </div>

      {/* the figure leads, as it does everywhere else in this product */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, padding: '20px 0 4px' }}>
        <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 46, letterSpacing: '-.05em', lineHeight: 1, color: shown ? healthTone(shown.health) : tone, fontVariantNumeric: 'tabular-nums' }}>
          {shown ? shown.health : (current ?? last.health)}
        </span>
        <span style={{ paddingBottom: 6, fontSize: 13.5, color: 'var(--ink-muted)' }}>
          {shown
            ? <>on {fmt(shown.day)}{shown.estimated ? ', estimated' : ''}</>
            : <>today, {change === 0 ? 'flat' : <span style={{ color: change < 0 ? 'var(--critical, #c43d2b)' : 'var(--good, #2f8f5b)', fontWeight: 600 }}>{change > 0 ? '+' : ''}{change} in {days.length} days</span>}</>}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={`Health over ${days.length} days`}
        style={{ display: 'block', cursor: 'crosshair' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const i = Math.round(((e.clientX - r.left) / r.width) * (days.length - 1))
          setHover(Math.max(0, Math.min(days.length - 1, i)))
        }}>
        <defs>
          <linearGradient id="htFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.16" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 65].filter(v => v > lo && v < hi).map(v => (
          <line key={v} x1={pad} x2={W - pad} y1={ys(v)} y2={ys(v)} stroke="var(--hairline, #EFEAE1)" strokeWidth="1" strokeDasharray="2 5" />
        ))}
        {area && <path d={area} fill="url(#htFill)" />}
        {est.length > 1 && <path d={path(est)} fill="none" stroke="var(--ink-faint, #A09C97)" strokeWidth="1.5" strokeDasharray="3 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        {real.length > 1 && <path className="pk-draw" d={path(real)} fill="none" stroke={tone} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        {shown && <>
          <line x1={xs(hover!)} x2={xs(hover!)} y1={pad} y2={H - pad} stroke="var(--border, #E5DFD4)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <circle cx={xs(hover!)} cy={ys(shown.health)} r="3.5" fill={healthTone(shown.health)} stroke="var(--paper, #FBF8F3)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </>}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
        <span>{fmt(first.day)}</span>
        {est.length > 0 && real.length > 0 && <span>recorded from {fmt(real[0].day)}</span>}
        <span>{fmt(last.day)}</span>
      </div>

      {est.length > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 10, lineHeight: 1.55, maxWidth: '62ch' }}>
          The dashed stretch is estimated from your email history rather than recorded day by day.
        </div>
      )}
    </section>
  )
}
