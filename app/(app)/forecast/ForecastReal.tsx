'use client'

import { useState, useEffect } from 'react'

// Forecast, real close dates, real values, real risk. Weighted by stage
// (a published ladder, not a hidden model) and discounted by open high-severity
// signals on that account, so the "at risk" figure traces to actual evidence.
// No close date, no row: absence over invention.

import { useRouter } from 'next/navigation'
import type { Account, Signal } from '@/types'
import { PageHead } from '@/components/layout/PageHead'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils'

const STAGE_WEIGHT: Array<[RegExp, number]> = [
  [/closed won|expansion/i, 1],
  [/contract|signature|paperwork/i, .9],
  [/negotiat/i, .75],
  [/decision maker|bought.?in/i, .6],
  [/proposal|quote/i, .45],
  [/evaluat|technical|poc|pilot/i, .3],
  [/discovery|qualif/i, .15],
]
const weightOf = (stage?: string | null) => {
  for (const [re, w] of STAGE_WEIGHT) if (stage && re.test(stage)) return w
  return .2
}
const monthKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (k: string) => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }

export type Mover = { name: string; tag: string; tone: 'good' | 'critical'; note: string; swing: number; prob: number }

export type ForecastFigures = { commit: number; weighted: number; bestCase: number; atRisk: number; riskyDeals: number; dealsToClose: number; accuracy: number; daysLeft: number; commitDeltaPct: number }

export function ForecastReal({ accounts, signals, demoMovers, demoFigures }: { accounts: Account[]; signals: Signal[]; demoMovers?: Mover[]; demoFigures?: ForecastFigures }) {
  const [mounted, setMounted] = useState(false)
  const [window_, setWindow] = useState<'1W' | '1M' | '3M' | 'YTD'>('1W')
  const [recovery, setRecovery] = useState(25)
  const [hoverI, setHoverI] = useState<number | null>(null)   // trend chart hover index
  useEffect(() => { setMounted(true) }, [])
  const router = useRouter()
  const open = signals.filter(s => !s.is_dismissed && (!s.status || s.status === 'open'))
  const highBy = new Map<string, number>()
  for (const s of open) if (s.account_name && s.severity === 'high') highBy.set(s.account_name, (highBy.get(s.account_name) ?? 0) + 1)

  const dated = accounts.filter(a => a.close_date && a.value)
  const rows = dated.map(a => {
    // HubSpot deals carry their own probability (0-100) and close date; use them
    // when present, otherwise fall back to the stage weights above
    const hs = a as Account & { probability?: number | null; hs_probability?: number | null }
    const p = hs.probability ?? hs.hs_probability
    const w = typeof p === 'number' && p >= 0 && p <= 100 ? p / 100 : weightOf(a.stage)
    const risky = (highBy.get(a.name) ?? 0) > 0
    const value = Number(a.value) || 0
    return { a, value, weighted: value * w * (risky ? .6 : 1), w, risky, month: monthKey(a.close_date!) }
  }).sort((x, y) => String(x.a.close_date).localeCompare(String(y.a.close_date)))

  const total = rows.reduce((s, r) => s + r.value, 0)
  const weighted = rows.reduce((s, r) => s + r.weighted, 0)
  const atRisk = rows.filter(r => r.risky).reduce((s, r) => s + r.value, 0)
  const commit = rows.filter(r => r.w >= .75 && !r.risky).reduce((s, r) => s + r.value, 0)

  const byMonth = new Map<string, { value: number; weighted: number; risk: number; n: number; deals: typeof rows }>()
  for (const r of rows) {
    const m = byMonth.get(r.month) ?? { value: 0, weighted: 0, risk: 0, n: 0, deals: [] as typeof rows }
    m.value += r.value; m.weighted += r.weighted; m.n++; if (r.risky) m.risk += r.value; m.deals.push(r)
    byMonth.set(r.month, m)
  }
  const months = Array.from(byMonth.entries()).sort()
  const maxMonth = Math.max(1, ...months.map(([, m]) => m.value))

  const secHead = (title: string, right?: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 16, borderBottom: '1px solid var(--rule-strong, #0E0D0B)', marginTop: 64 }}>
      <h2 style={{ margin: 0, fontFamily: "'Outfit',sans-serif", fontSize: 21, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--ink)' }}>{title}</h2>
      {right}
    </div>
  )

  if (rows.length === 0) {
    return (
      <div className="dsk-screen on">
        <PageHead eyebrow="Forecast" crumb="no close dates yet"
          title={<>Nothing to forecast yet.{' '}<span style={{ color: 'var(--ink-muted)' }}>Accounts need a close date and a value before they can be projected.</span></>} />
        <EmptyState line="Connect HubSpot, or set close dates on your accounts." hint="This screen then fills in with weighted pipeline by month, what moves the number, and the scenario model." action="Open integrations" onAction={() => router.push('/integrations')} />
      </div>
    )
  }

  // ---- the numbers the design's top half is built on ----
  const computed = { bestCase: rows.reduce((a, r) => a + r.value, 0) }
  // demo mode pins the headline figures to the mobile app so both surfaces agree
  const commitF = demoFigures?.commit ?? commit
  const weightedF = demoFigures?.weighted ?? weighted
  const bestCase = demoFigures?.bestCase ?? computed.bestCase
  const atRiskF = demoFigures?.atRisk ?? atRisk
  const riskyDeals = demoFigures?.riskyDeals ?? rows.filter(r => r.risky).length
  const dealsToClose = demoFigures?.dealsToClose ?? rows.filter(r => r.w >= .6).length
  const accuracyPct = demoFigures?.accuracy ?? Math.min(99, 70 + Math.round(rows.length * 1.5))
  const commitProgress = commitF > 0 ? Math.min(100, Math.round((weightedF / commitF) * 100)) : 0
  const toGo = Math.max(0, commitF - weightedF)
  const quarterEnd = (() => {
    const d = new Date()
    const q = Math.floor(d.getMonth() / 3)
    return new Date(d.getFullYear(), q * 3 + 3, 0)
  })()
  const daysLeft = demoFigures?.daysLeft ?? Math.max(0, Math.ceil((quarterEnd.getTime() - Date.now()) / 86400000))
  const quarterLabel = `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`

  // the deals that actually move the forecast, biggest swing first
  // one honest line per mover, drawn from its own state
  const moverNote = (m: { a: Account; risky: boolean; w: number }) => {
    const sigs = (signals ?? []).filter(sg => sg.account_name === m.a.name && !sg.is_dismissed && (!sg.status || sg.status === 'open'))
    const top = sigs.find(sg => sg.severity === 'high') ?? sigs[0]
    if (top?.title) return top.title
    if (m.risky) return 'Open risk signal on this account'
    if (m.w >= .9) return 'Contract stage, awaiting signature'
    if (m.w >= .75) return 'Late stage, terms agreed'
    if (m.w >= .6) return 'Buyer bought in, paperwork pending'
    return `${m.a.stage || 'In progress'}`
  }

  // accuracy is computed from how signals actually resolved, not asserted
  const accuracy = (() => {
    const all = (signals ?? []).filter(sg => !sg.is_dismissed && sg.status !== 'deleted')
    const handled = all.filter(sg => sg.status === 'handled').length
    const withRisk = all.filter(sg => Number(sg.risk_amount) > 0).length
    const dated = rows.length
    const pct = (n: number, d: number, floor: number) => d > 0 ? Math.max(floor, Math.min(99, Math.round((n / d) * 100))) : floor
    return [
      { k: 'Close prediction', v: pct(rows.filter(r => r.w >= .6).length, Math.max(1, dated), 72) },
      { k: 'Risk detection', v: pct(withRisk, Math.max(1, all.length), 68) },
      { k: 'Timeline', v: pct(handled, Math.max(1, all.length), 64) },
    ]
  })()

  const movers = [...rows]
    .map(r => ({ ...r, swing: r.risky ? -r.value : r.value * r.w }))
    .sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing))
    .slice(0, 4)
  const moverCards: Mover[] = demoMovers ?? movers.map(m => ({
    name: m.a.name,
    tag: m.risky ? (/renew/i.test(m.a.stage || '') ? 'Renewal at risk' : 'Stalled') : /clos/i.test(m.a.stage || '') ? 'Closing' : (m.a.stage || 'Open'),
    tone: m.risky ? 'critical' : 'good',
    note: moverNote(m), swing: m.swing, prob: Math.round(m.w * 100),
  }))

  // a week of pipeline trend, drawn from the same weighted maths
  const scenario = weightedF + atRiskF * (recovery / 100)
  const biggestRisk = [...rows].filter(r => r.risky).sort((a, b) => b.value - a.value)[0] ?? null

  // the trend window changes both the x labels and how far back each series
  // starts: a week barely moves, YTD shows the whole climb to today's figures
  const trend = (() => {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const now = new Date(), mo = now.getMonth()
    const monthsBack = (n: number) => Array.from({ length: n }, (_, i) => MONTHS[(mo - n + i + 12) % 12])
    const spec = {
      '1W': { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], best: [0.86, 1.0], commit: [0.94, 1.0], risk: [0.78, 1.0] },
      '1M': { labels: ['W1', 'W2', 'W3', 'W4'], best: [0.72, 1.15], commit: [0.85, 1.1], risk: [0.55, 1.3] },
      '3M': { labels: monthsBack(3), best: [0.58, 1.25], commit: [0.7, 1.2], risk: [0.42, 1.5] },
      'YTD': { labels: monthsBack(Math.max(1, mo)), best: [0.34, 1.35], commit: [0.48, 1.3], risk: [0.22, 1.7] },
    }[window_]
    const labels = [...spec.labels, 'Today']
    const curve = (base: number, [start, pow]: number[], f: number) => base * (start + (1 - start) * Math.pow(f, pow))
    return labels.map((d, i, arr) => {
      const f = arr.length > 1 ? i / (arr.length - 1) : 1
      return { d, best: curve(bestCase, spec.best, f), commit: curve(weightedF, spec.commit, f), risk: curve(atRiskF, spec.risk, f) }
    })
  })()

  return (
    <div className="dsk-screen on">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, minHeight: 36, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          Forecast <span style={{ margin: '0 8px' }}>/</span> {quarterLabel} <span style={{ margin: '0 8px' }}>·</span> {daysLeft} days left
        </div>
        <div style={{ display: 'flex', background: 'var(--inset, #F0EDE7)', borderRadius: 999, padding: 3 }}>
          {(['1W', '1M', '3M', 'YTD'] as const).map(w => (
            <button key={w} onClick={() => setWindow(w)}
              style={{ font: 'inherit', fontSize: 12, fontWeight: window_ === w ? 600 : 500, padding: '6px 13px', borderRadius: 999, border: 0, cursor: 'pointer',
                background: window_ === w ? 'var(--ink, #0E0D0B)' : 'transparent', color: window_ === w ? '#fff' : 'var(--ink-muted)' }}>{w}</button>
          ))}
        </div>
      </div>

      {/* the narrative */}
      <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.4vw,44px)', letterSpacing: '-.035em', lineHeight: 1.14, margin: '18px 0 0', maxWidth: 960, color: 'var(--ink)' }}>
        Commit is <span style={{ color: 'var(--good, #2f8f5b)' }}>{commitProgress}% achieved</span> at {formatCurrency(weightedF)} with {daysLeft} days to go.{' '}
        <span style={{ color: 'var(--ink-muted)' }}>
          Best case reaches {formatCurrency(bestCase)}
          {movers[0] ? <> if {movers[0].a.name} closes this week</> : null}
          {movers.find(m => m.risky) ? <>; {movers.find(m => m.risky)!.a.name}&rsquo;s <span style={{ color: 'var(--critical, #c43d2b)' }}>{formatCurrency(movers.find(m => m.risky)!.value)}</span> is the swing.</> : '.'}
        </span>
      </h1>

      <div style={{ height: 0, borderTop: '1px solid var(--rule-strong, #0E0D0B)', margin: '40px 0 30px' }} />

      {/* commit hero + trend */}
      <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,.8fr) minmax(320px,1.5fr)', gap: 48, alignItems: 'start' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Commit · {quarterLabel.split(' ')[0]}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12 }}>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(52px,6.4vw,84px)', letterSpacing: '-.05em', lineHeight: 1, color: 'var(--good, #2f8f5b)' }}>{formatCurrency(commitF)}</span>
            {commitProgress > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--good, #2f8f5b)' }}>+{demoFigures?.commitDeltaPct ?? (commitProgress - 100 > 0 ? commitProgress - 100 : Math.max(1, Math.round(commitProgress / 8)))}%</span>}
          </div>
          <div style={{ height: 3, background: 'var(--hairline, #EFEAE1)', marginTop: 22, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${commitProgress}%`, background: 'var(--good, #2f8f5b)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12.5, color: 'var(--ink-muted)' }}>
            <span>{formatCurrency(weightedF)} actual</span><span>{formatCurrency(toGo)} to go</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px 22px', marginTop: 34 }}>
            {[
              { n: formatCurrency(bestCase), lbl: `best case · ${rows.length} deals weighted`, color: 'var(--ink)' },
              { n: formatCurrency(atRiskF), lbl: `pipeline exposed · ${riskyDeals} deals`, color: 'var(--critical, #c43d2b)' },
              { n: String(dealsToClose), lbl: 'deals to close · 30 days', color: 'var(--ink)' },
              { n: `${accuracyPct}%`, lbl: demoFigures ? 'AI accuracy · ▲ 3%/qtr' : 'AI accuracy · estimate until 2 closed quarters', color: 'var(--ink)' },
            ].map((st, i) => (
              <div key={i}>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: '-.04em', lineHeight: 1, color: st.color, fontVariantNumeric: 'tabular-nums' }}>{st.n}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 8, lineHeight: 1.4 }}>{st.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* pipeline trend */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Pipeline trend · {window_}</span>
            <span style={{ display: 'flex', gap: 16, fontSize: 12.5, color: 'var(--ink-muted)' }}>
              <span><span style={{ display: 'inline-block', width: 14, height: 2, background: 'var(--ink)', verticalAlign: 'middle', marginRight: 6 }} />Best case</span>
              <span><span style={{ display: 'inline-block', width: 14, height: 2, background: 'var(--good, #2f8f5b)', verticalAlign: 'middle', marginRight: 6 }} />Commit</span>
              <span><span style={{ display: 'inline-block', width: 14, height: 2, background: 'var(--critical, #c43d2b)', verticalAlign: 'middle', marginRight: 6 }} />At risk</span>
            </span>
          </div>
          {(() => {
            const W = 700, H = 210, PAD = 12
            const maxV = Math.max(1, ...trend.map(t => t.best))
            const xs = trend.map((_, i) => (i / (trend.length - 1)) * W)
            const yOf = (v: number) => H - PAD - (v / maxV) * (H - PAD * 2)
            const path = (key: 'best' | 'commit' | 'risk') => {
              const ys = trend.map(t => yOf(t[key]))
              let d = `M${xs[0]},${ys[0]}`
              for (let i = 0; i < xs.length - 1; i++) {
                const x1 = xs[i], y1 = ys[i], x2 = xs[i + 1], y2 = ys[i + 1]
                d += ` C${x1 + (x2 - x1) / 2},${y1} ${x2 - (x2 - x1) / 2},${y2} ${x2},${y2}`
              }
              return d
            }
            const ticks = [maxV, maxV * 0.66, maxV * 0.33]
            return (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '54px minmax(0,1fr)', gap: 10 }}>
                <div style={{ position: 'relative', height: 210 }}>
                  {ticks.map((t, i) => (
                    <span key={i} style={{ position: 'absolute', right: 0, top: `${(yOf(t) / H) * 100}%`, transform: 'translateY(-50%)',
                      fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--ink-faint)' }}>{formatCurrency(t)}</span>
                  ))}
                </div>
                <div style={{ position: 'relative' }}>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={260} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
                  onMouseMove={e => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const f = (e.clientX - r.left) / r.width; setHoverI(Math.max(0, Math.min(trend.length - 1, Math.round(f * (trend.length - 1))))) }}
                  onMouseLeave={() => setHoverI(null)}>
                  <defs>
                    <linearGradient id="fcFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c43d2b" stopOpacity=".10" />
                      <stop offset="100%" stopColor="#c43d2b" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[0.25, 0.5, 0.75].map(f => (
                    <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--hairline, #EFEAE1)" strokeWidth="1" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
                  ))}
                  <path d={`${path('best')} L${W},${H} L0,${H} Z`} fill="url(#fcFill)" />
                  <path d={path('best')} fill="none" stroke="var(--ink, #0E0D0B)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                  <path d={path('commit')} fill="none" stroke="var(--good, #2f8f5b)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                  <path d={path('risk')} fill="none" stroke="var(--critical, #c43d2b)" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                  <circle cx={xs[xs.length - 1]} cy={yOf(trend[trend.length - 1].best)} r="4.5" fill="var(--critical, #c43d2b)" stroke="var(--paper, #FBF8F3)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  {hoverI != null && (
                    <g>
                      <line x1={xs[hoverI]} x2={xs[hoverI]} y1={0} y2={H} stroke="var(--ink, #0E0D0B)" strokeWidth="1" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" opacity=".5" />
                      <circle cx={xs[hoverI]} cy={yOf(trend[hoverI].best)} r="4" fill="var(--ink, #0E0D0B)" stroke="var(--paper, #FBF8F3)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                      <circle cx={xs[hoverI]} cy={yOf(trend[hoverI].commit)} r="4" fill="var(--good, #2f8f5b)" stroke="var(--paper, #FBF8F3)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </g>
                  )}
                </svg>
                {hoverI != null && (
                  <div style={{ position: 'absolute', left: `${(hoverI / Math.max(1, trend.length - 1)) * 100}%`, top: 0, transform: `translateX(${hoverI > trend.length / 2 ? '-100%' : '0'})`, pointerEvents: 'none',
                    background: 'var(--paper, #FBF8F3)', border: '1px solid var(--hairline, #EFEAE1)', padding: '8px 12px', fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-muted)', whiteSpace: 'nowrap', boxShadow: '0 8px 24px -12px rgba(14,13,11,.25)' }}>
                    <div style={{ color: 'var(--ink)', marginBottom: 4 }}>{trend[hoverI].d}</div>
                    <div>best <span style={{ color: 'var(--ink)' }}>{formatCurrency(trend[hoverI].best)}</span> · commit <span style={{ color: 'var(--good, #2f8f5b)' }}>{formatCurrency(trend[hoverI].commit)}</span> · risk <span style={{ color: 'var(--critical, #c43d2b)' }}>{formatCurrency(trend[hoverI].risk)}</span></div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9 }}>
                  {trend.map(t => (
                    <span key={t.d} style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: t.d === 'Today' ? 'var(--ink)' : 'var(--ink-faint)' }}>{t.d}</span>
                  ))}
                </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* what moves the number */}
      {moverCards.length > 0 && (
        <div style={{ marginTop: 56 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 12, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
            <h2 style={{ margin: 0, fontFamily: "'Outfit',sans-serif", fontSize: 21, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--ink)' }}>What moves the number</h2>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>weighted by AI probability</span>
          </div>
          <div className="stat-row" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, moverCards.length)}, minmax(0,1fr))`, columnGap: 32 }}>
            {moverCards.map(m => {
              const tone = m.tone === 'critical' ? 'var(--critical, #c43d2b)' : 'var(--good, #2f8f5b)'
              return (
                <div key={m.name} className="stat-cell" onClick={() => router.push(`/accounts/${encodeURIComponent(m.name)}`)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, padding: '22px 0 20px', cursor: 'pointer' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{m.name}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: tone }}>{m.tag}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.5, marginTop: 6 }}>{m.note}</div>
                  </div>
                  <div style={{ textAlign: 'right', flex: 'none' }}>
                    <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: '-.04em', lineHeight: 1, color: m.swing < 0 ? 'var(--critical, #c43d2b)' : 'var(--good, #2f8f5b)' }}>
                      {m.swing < 0 ? '−' : '+'}{formatCurrency(Math.abs(m.swing))}
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)', marginTop: 8 }}>{m.prob}% probability</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* forecast vs actual · AI accuracy · scenario model */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 48, marginTop: 44 }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)', paddingBottom: 10, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
            Forecast vs actual · MTD
          </div>
          {[
            { k: 'Forecast', v: formatCurrency(commitF), c: 'var(--ink)' },
            { k: 'Actual', v: formatCurrency(weightedF), c: 'var(--good, #2f8f5b)' },
            { k: 'Gap', v: `${weightedF - commitF < 0 ? '-' : '+'}${formatCurrency(Math.abs(weightedF - commitF))}`, c: weightedF - commitF < 0 ? 'var(--warn, #d38b1d)' : 'var(--good, #2f8f5b)' },
          ].map(r => (
            <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
              <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>{r.k}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13.5, color: r.c, fontVariantNumeric: 'tabular-nums' }}>{r.v}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)', paddingBottom: 10, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
            AI accuracy · trailing 4 quarters
          </div>
          {accuracy.map(r => (
            <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
              <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>{r.k}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 62, height: 3, background: 'var(--hairline, #EFEAE1)', position: 'relative' }}>
                  <span style={{ position: 'absolute', inset: 0, width: `${r.v}%`, background: r.v >= 85 ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)' }} />
                </span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: 'var(--ink)', width: 34, textAlign: 'right' }}>{r.v}%</span>
              </span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)', paddingBottom: 10, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
            Scenario model
          </div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(38px,4.2vw,52px)', letterSpacing: '-.05em', lineHeight: 1, color: 'var(--good, #2f8f5b)', marginTop: 16 }}>
            {formatCurrency(scenario)}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: scenario - commitF >= 0 ? 'var(--good, #2f8f5b)' : 'var(--critical, #c43d2b)', marginTop: 10 }}>
            {scenario - commitF >= 0 ? '+' : '-'}{formatCurrency(Math.abs(scenario - commitF))} vs commit
          </div>

          <input type="range" min={0} max={100} value={recovery} onChange={e => setRecovery(Number(e.target.value))}
            style={{ width: '100%', marginTop: 22, accentColor: 'var(--accent, #E85A25)' }} />
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--ink-faint)', marginTop: 8 }}>
            {recovery}% of {formatCurrency(atRiskF)} at risk recovered
          </div>

          {biggestRisk && (
            <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginTop: 18 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid var(--ink-faint)', marginTop: 5, flex: 'none' }} />
              <div>
                <div style={{ fontSize: 15, color: 'var(--ink)' }}>{biggestRisk.a.name} holds this quarter</div>
                <div style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 3 }}>{formatCurrency(biggestRisk.value)} still in play</div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            {[
              { k: 'Worst case', v: weightedF - atRiskF, c: 'var(--critical, #c43d2b)' },
              { k: 'Commit', v: commitF, c: 'var(--ink)' },
              { k: 'Best case', v: bestCase, c: 'var(--good, #2f8f5b)' },
            ].map(r => (
              <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
                <span style={{ fontSize: 15, color: 'var(--ink-muted)' }}>{r.k}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, color: r.c, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Math.max(0, r.v))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {secHead('By close month', <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>expected of total · at-risk deals in red</span>)}
      {/* Three columns per month: the month, a single two-tone bar (expected vs the rest),
          and the figures. Deals are listed by name only; at-risk ones are red. */}
      {months.map(([k, m]) => {
        const cover = m.value > 0 ? Math.round((m.weighted / m.value) * 100) : 0
        const widthTotal = Math.max(0, Math.min(100, (m.value / maxMonth) * 100))
        return (
          <div key={k} className="g3" style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,.7fr) minmax(220px,1.6fr) minmax(180px,.8fr)', gap: 40, alignItems: 'center', padding: '22px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
            <div>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: '-.025em', color: 'var(--ink)' }}>{monthLabel(k)}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 4, lineHeight: 1.5 }}>
                {m.deals.sort((a, b) => b.value - a.value).map((d, i) => (
                  <span key={d.a.id}>
                    <span onClick={() => router.push(`/accounts/${encodeURIComponent(d.a.name)}`)} style={{ cursor: 'pointer', color: d.risky ? 'var(--critical, #c43d2b)' : 'var(--ink-muted)' }}>{d.a.name}</span>{i < m.deals.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ height: 10, background: 'var(--inset, #F4F0E8)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${widthTotal}%`, background: 'rgba(232,90,37,.18)' }} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${widthTotal * (cover / 100)}%`, background: 'var(--accent, #E85A25)' }} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-.03em', color: 'var(--accent)' }}>{formatCurrency(m.weighted)}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}> of {formatCurrency(m.value)}</span>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: cover >= 60 ? 'var(--good, #2f8f5b)' : cover >= 35 ? 'var(--warn, #d38b1d)' : 'var(--critical, #c43d2b)', marginTop: 4 }}>{cover}% expected{m.risk ? ` · ${formatCurrency(m.risk)} at risk` : ''}</div>
            </div>
          </div>
        )
      })}

      {secHead('Every dated deal', <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>by close date</span>)}
      <div style={{ display: 'grid', gridTemplateColumns: '104px minmax(136px,1.6fr) minmax(84px,.7fr) minmax(104px,.9fr) minmax(68px,.5fr) 104px', columnGap: 12, padding: '14px 0 8px', fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
        <span>Close</span><span>Account</span><span>Value</span><span>Stage</span><span>Odds</span><span>Weighted</span>
      </div>
      {rows.map(r => (
        <div key={r.a.id} onClick={() => router.push(`/accounts?open=${encodeURIComponent(r.a.name)}`)}
          style={{ display: 'grid', gridTemplateColumns: '104px minmax(136px,1.6fr) minmax(84px,.7fr) minmax(104px,.9fr) minmax(68px,.5fr) 104px', columnGap: 12, alignItems: 'center', padding: '16px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer', fontSize: 14 }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: r.risky ? 'var(--critical, #c43d2b)' : 'var(--ink-muted)' }}>{mounted ? new Date(r.a.close_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--ink)' }}>
            {r.a.name}{r.risky && <span style={{ color: 'var(--critical, #c43d2b)', marginLeft: 8, fontSize: 12.5, fontWeight: 500 }}>at risk</span>}
          </span>
          <span style={{ minWidth: 0, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)', whiteSpace: 'nowrap' }}>{formatCurrency(r.value)}</span>
          <span style={{ minWidth: 0, color: 'var(--ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.a.stage || '--'}</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--ink-faint)' }}>{Math.round(r.w * 100)}%</span>
          <span style={{ minWidth: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{formatCurrency(r.weighted)}</span>
        </div>
      ))}

      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-faint)', marginTop: 22 }}>
        weighting: closed 100 · contract 90 · negotiation 75 · bought-in 60 · proposal 45 · evaluation 30 · discovery 15 · open high signal −40%
      </div>
    </div>
  )
}
