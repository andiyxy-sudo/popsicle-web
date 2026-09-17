'use client'

import { useState, useEffect } from 'react'

import { PageHead } from '@/components/layout/PageHead'
// Revenue Intelligence over REAL data, styled to match the showcase design
// language (gradient hero, SEC section headers, flush cards). Every number is
// computed from the user's own rows; sections render only when they have data.

interface Sig { created_at?: string; account_name?: string | null; title?: string | null; severity?: string; signal_type?: string; source_integration?: string; risk_amount?: number; is_dismissed?: boolean; status?: string | null }
interface Msg { received_at?: string; direction?: string; integration?: string }
interface Baseline { account_name?: string; emails_per_week?: number; total_messages?: number; last_message_at?: string; our_median_reply_hours?: number; their_median_reply_hours?: number; total_reply_pairs?: number; confidence?: string }

const TYPE_LABELS: Record<string, string> = {
  silent_stall: 'Silent Stall', competitor_mention: 'Competitor Mention', legal_loopin: 'Legal Loop-in',
  price_flinch: 'Price Flinch', champion_change: 'Champion Change', timeline_slip: 'Timeline Slip', deal_stage_backward: 'Deal Moved Backward',
  reengaged: 'Re-engaged',
  call_objection: 'Call Objection', call_sentiment_drop: 'Call Sentiment Drop',
  call_buying_signal: 'Buying Signal', call_commitment: 'Call Commitment', call_summary: 'Call Summary',
  meeting_cancelled: 'Meeting Cancelled', meeting_declined: 'Meeting Declined',
}

const WEEKS = 8
const DAY = 86400000

const SEC = (t: string, right?: React.ReactNode) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 16, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--ink)' }}>{t}</h2>
    {right}
  </div>
)

function weekStart(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7
  return d.getTime() - day * DAY
}

function fmtMoney(v: number) {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${Math.round(v / 1000)}K`
  return `$${v}`
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '--'
  const d = (Date.now() - new Date(iso).getTime()) / DAY
  if (d < 1) return 'today'
  if (d < 2) return 'yesterday'
  if (d < 30) return `${Math.floor(d)}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

function fmtHours(h?: number | null): string {
  if (h == null) return '--'
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 48) return `${Math.round(h)}h`
  return `${(h / 24).toFixed(1)}d`
}

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0)

export function IntelligenceReal({ signals, messages, baselines }: { signals: Sig[]; messages: Msg[]; baselines: Baseline[] }) {
  const [mounted, setMounted] = useState(false)
  const [range, setRange] = useState(30)
  const [series, setSeries] = useState<'At risk' | 'Stabilized' | 'Both'>('At risk')
  useEffect(() => { setMounted(true) }, [])
  const now = Date.now()

  // ---- stats ----
  const d30 = now - 30 * DAY, d60 = now - 60 * DAY
  const sig30 = signals.filter(s => s.created_at && new Date(s.created_at).getTime() >= d30)
  const sigPrev = signals.filter(s => { const t = s.created_at ? new Date(s.created_at).getTime() : 0; return t >= d60 && t < d30 })
  const msg30 = messages.filter(m => m.received_at && new Date(m.received_at).getTime() >= d30)
  const msgPrev = messages.filter(m => { const t = m.received_at ? new Date(m.received_at).getTime() : 0; return t >= d60 && t < d30 })
  const live = signals.filter(s => !s.is_dismissed)
  const openHigh = live.filter(s => (!s.status || s.status === 'open') && s.severity === 'high')
  const openRisk = live
    .filter(s => (!s.status || s.status === 'open') && (s.severity === 'high' || s.severity === 'watch'))
    .reduce((a, s) => a + (Number(s.risk_amount) || 0), 0)
  const activeAccounts = baselines.filter(b => b.last_message_at && (now - new Date(b.last_message_at).getTime()) <= 14 * DAY).length

  const delta = (cur: number, prev: number): string => {
    if (prev === 0) return cur > 0 ? 'new activity' : ''
    const d = Math.round(((cur - prev) / prev) * 100)
    return d === 0 ? 'flat vs prior 30d' : `${d > 0 ? '+' : ''}${d}% vs prior 30d`
  }

  // ---- weekly volume + hero sparkline ----
  const firstWeek = weekStart(now) - (WEEKS - 1) * 7 * DAY
  const weeks: { label: string; in: number; out: number }[] = []
  for (let i = 0; i < WEEKS; i++) {
    const d = new Date(firstWeek + i * 7 * DAY)
    weeks.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, in: 0, out: 0 })
  }
  for (const m of messages) {
    if (!m.received_at) continue
    const t = new Date(m.received_at).getTime()
    const idx = Math.floor((weekStart(t) - firstWeek) / (7 * DAY))
    if (idx < 0 || idx >= WEEKS) continue
    if (m.direction === 'outbound') weeks[idx].out++
    else weeks[idx].in++
  }
  const maxWeek = Math.max(1, ...weeks.map(w => w.in + w.out))
  const hasVolume = messages.length >= 10
  const sparkPts = weeks.map((w, i) => {
    const x = (i / (WEEKS - 1)) * 400
    const y = 44 - ((w.in + w.out) / maxWeek) * 36
    return `${Math.round(x)} ${Math.round(y)}`
  })
  const sparkLine = `M${sparkPts.join(' L')}`
  const sparkArea = `${sparkLine} L400 48 L0 48Z`

  // ---- signal mix ----
  const sevCounts = {
    high: live.filter(s => s.severity === 'high').length,
    watch: live.filter(s => s.severity === 'watch').length,
    positive: live.filter(s => s.severity === 'positive').length,
  }
  const typeCounts = new Map<string, number>()
  for (const s of live) { const k = s.signal_type || 'other'; typeCounts.set(k, (typeCounts.get(k) || 0) + 1) }
  const topTypes = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const srcCounts = new Map<string, number>()
  for (const s of live) { const k = (s.source_integration || 'other'); srcCounts.set(k, (srcCounts.get(k) || 0) + 1) }
  const sources = Array.from(srcCounts.entries()).sort((a, b) => b[1] - a[1])

  // ---- engagement + reply habits ----
  const engaged = baselines.filter(b => (b.total_messages || 0) > 0).slice(0, 6)
  const maxEng = Math.max(1, ...engaged.map(b => b.total_messages || 0))
  const withPairs = baselines.filter(b => (b.total_reply_pairs || 0) > 0 && (b.our_median_reply_hours != null || b.their_median_reply_hours != null))
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const ourAvg = avg(withPairs.map(b => b.our_median_reply_hours!).filter(x => x != null))
  const theirAvg = avg(withPairs.map(b => b.their_median_reply_hours!).filter(x => x != null))

  const nothing = signals.length === 0 && messages.length < 10

  if (nothing) {
    return (
      <div className="dsk-screen on">
        <PageHead eyebrow="Intelligence" crumb="no history yet" title={<>Not enough history yet. <span style={{ color: 'var(--ink-muted)' }}>This screen fills in as Popsicle syncs.</span></>} />
        <div className="dcard" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 6 }}>Not enough history yet.</div>
          <div style={{ fontSize: 13, color: 'var(--t4)', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
            Connect an integration and let Popsicle sync for a few days. This screen fills in with your communication trends, signal patterns, and account engagement.
          </div>
        </div>
      </div>
    )
  }

  const heroBig = openRisk > 0 ? fmtMoney(openRisk) : String(msg30.length)
  const heroBigLbl = openRisk > 0 ? `at risk across ${live.filter(s => (!s.status || s.status === 'open') && s.severity !== 'positive').length} open signals` : 'messages in the last 30 days'
  const heroDelta = openRisk > 0 ? delta(sig30.length, sigPrev.length) : delta(msg30.length, msgPrev.length)

  // ---- risk movement, the spine of the design's Intelligence page ----
  const handledRate = (() => {
    const closed = signals.filter(sg => sg.status === 'handled').length
    const all = signals.filter(sg => !sg.is_dismissed && sg.status !== 'deleted').length
    return all > 0 ? Math.round((closed / all) * 100) : null
  })()
  const rangeMs = range * 86400000
  const inRange = live.filter(sg => !sg.created_at || Date.now() - new Date(sg.created_at).getTime() <= rangeMs)
  const WEEKS_BACK = 8
  const weekBuckets = (() => {
    const out: Array<{ label: string; added: number; stabilized: number }> = []
    for (let i = WEEKS_BACK - 1; i >= 0; i--) {
      const start = Date.now() - (i + 1) * 7 * 86400000
      const end = Date.now() - i * 7 * 86400000
      const inWeek = inRange.filter(sg => {
        const t = sg.created_at ? new Date(sg.created_at).getTime() : 0
        return t >= start && t < end
      })
      const added = inWeek.filter(sg => sg.severity !== 'positive').reduce((a, sg) => a + (Number(sg.risk_amount) || 0), 0)
      const stabilized = inWeek.filter(sg => sg.severity === 'positive' || sg.status === 'handled').reduce((a, sg) => a + (Number(sg.risk_amount) || 0), 0)
      out.push({ label: `W${WEEKS_BACK - i}`, added, stabilized })
    }
    return out
  })()
  const wLast = weekBuckets[weekBuckets.length - 1]
  const wFirst = weekBuckets[0]
  const riskDelta = wFirst?.added > 0 ? Math.round(((wLast.added - wFirst.added) / wFirst.added) * 100) : null
  const stabilizedTotal = weekBuckets.reduce((a, w) => a + w.stabilized, 0)
  const addedTotal = weekBuckets.reduce((a, w) => a + w.added, 0)
  const netChange = addedTotal > 0 ? Math.round(((addedTotal - stabilizedTotal) / addedTotal) * 100) : 0

  // what is actually moving the number
  const drivers = (() => {
    const by = new Map<string, number>()
    for (const sg of inRange) {
      const k = sg.signal_type || 'other'
      by.set(k, (by.get(k) ?? 0) + (Number(sg.risk_amount) || 0) * (sg.severity === 'positive' ? -1 : 1))
    }
    return Array.from(by.entries())
      .filter(([, v]) => v !== 0)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 5)
  })()

  // headline facts
  const deteriorated = Array.from(new Set(live.filter(sg => sg.severity === 'high').map(sg => sg.account_name).filter(Boolean))) as string[]
  const reengaged = live.find(sg => sg.signal_type === 'reengaged')
  const accountNames = Array.from(new Set(live.map(sg => sg.account_name).filter(Boolean))) as string[]
  const won = live.find(sg => sg.signal_type === 'call_commitment' && sg.severity === 'positive')
  const focus = live.filter(sg => sg.severity === 'high').slice(0, 2).map(sg => sg.account_name).filter(Boolean) as string[]

  const bullets = [
    deteriorated.length ? { tone: 'var(--critical, #c43d2b)', lead: `${deteriorated.length} account${deteriorated.length === 1 ? '' : 's'} deteriorated`, rest: `: ${deteriorated.slice(0, 3).join(', ')}.` } : null,
    reengaged ? { tone: 'var(--good, #2f8f5b)', lead: `${reengaged.account_name} re-engaged`, rest: '.' } : null,
    won ? { tone: 'var(--good, #2f8f5b)', lead: `${won.account_name} committed`, rest: won.title ? `: ${won.title}.` : '.' } : null,
    focus.length ? { tone: 'var(--ink, #0E0D0B)', lead: 'Focus today:', rest: ` ${focus.join(', ')}.` } : null,
  ].filter(Boolean) as Array<{ tone: string; lead: string; rest: string }>

  return (
    <div className="dsk-screen on">
      {/* header with range control */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, minHeight: 36, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          Revenue intelligence <span style={{ margin: '0 8px' }}>/</span> last {range} days
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', background: 'var(--inset, #F0EDE7)', borderRadius: 999, padding: 3 }}>
            {[30, 60, 90].map(d => (
              <button key={d} onClick={() => setRange(d)}
                style={{ font: 'inherit', fontSize: 12.5, fontWeight: range === d ? 600 : 500, padding: '6px 14px', borderRadius: 999, border: 0, cursor: 'pointer',
                  background: range === d ? 'var(--ink, #0E0D0B)' : 'transparent', color: range === d ? '#fff' : 'var(--ink-muted)' }}>{d} days</button>
            ))}
          </div>
          <button onClick={() => window.print()}
            style={{ font: 'inherit', fontSize: 13, fontWeight: 500, background: 'none', border: 0, color: 'var(--ink-muted)', cursor: 'pointer' }}>Export PDF</button>
        </div>
      </div>

      {/* the narrative */}
      <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(28px,3.3vw,40px)', letterSpacing: '-.035em', lineHeight: 1.16, margin: '18px 0 0', color: 'var(--ink)' }}>
        {riskDelta != null && riskDelta !== 0 ? (
          <>New risk is being added <span style={{ color: riskDelta > 0 ? 'var(--critical, #c43d2b)' : 'var(--good, #2f8f5b)' }}>{Math.abs(riskDelta)}% {riskDelta > 0 ? 'faster' : 'slower'}</span> than eight weeks ago{deteriorated.length ? ', driven by executive disengagement' : ''}.{' '}</>
        ) : (
          <>{live.length} signal{live.length === 1 ? '' : 's'} analysed across {accountNames.length} account{accountNames.length === 1 ? '' : 's'}.{' '}</>
        )}
        <span style={{ color: 'var(--ink-muted)' }}>
          {handledRate != null ? <>Interventions are holding at {handledRate}%, and </> : null}
          Popsicle has protected <span style={{ color: 'var(--accent)' }}>{fmtMoney(stabilizedTotal)}</span> this quarter.
        </span>
      </h1>

      {/* callouts */}
      {bullets.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 26, marginTop: 26 }}>
          {bullets.map((b, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '10px 1fr', gap: 10, fontSize: 14, lineHeight: 1.55, color: 'var(--ink-muted)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.tone, marginTop: 7 }} />
              <div><strong style={{ fontWeight: 600, color: 'var(--ink)' }}>{b.lead}</strong>{b.rest}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '34px 0 26px' }} />

      {/* new risk added */}
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
        New risk added · week {WEEKS_BACK}
      </div>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(46px,6vw,74px)', letterSpacing: '-.05em', lineHeight: 1, marginTop: 10, color: 'var(--critical, #c43d2b)' }}>
        {fmtMoney(wLast?.added ?? 0)}
      </div>
      {riskDelta != null && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12, fontSize: 13 }}>
          <span style={{ color: riskDelta > 0 ? 'var(--critical, #c43d2b)' : 'var(--good, #2f8f5b)', fontWeight: 600 }}>
            {riskDelta > 0 ? '▲' : '▼'} {riskDelta > 0 ? '+' : ''}{riskDelta}%
          </span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: 'var(--ink-faint)' }}>vs W1 · {fmtMoney(wFirst?.added ?? 0)}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 26 }}>
        <div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: '-.04em', color: 'var(--good, #2f8f5b)' }}>{fmtMoney(stabilizedTotal)}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 5 }}>stabilized this period</div>
        </div>
        <div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: '-.04em', color: netChange > 0 ? 'var(--critical, #c43d2b)' : 'var(--good, #2f8f5b)' }}>
            {netChange > 0 ? '+' : ''}{netChange}%
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 5 }}>net risk change</div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink-muted)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--critical, #c43d2b)' }} />At risk
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--ink-muted)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good, #2f8f5b)' }} />Stabilized
          </span>
          <div style={{ display: 'flex', background: 'var(--inset, #F0EDE7)', borderRadius: 999, padding: 3 }}>
            {(['At risk', 'Stabilized', 'Both'] as const).map(m => (
              <button key={m} onClick={() => setSeries(m)}
                style={{ font: 'inherit', fontSize: 12.5, fontWeight: series === m ? 600 : 500, padding: '6px 14px', borderRadius: 999, border: 0, cursor: 'pointer',
                  background: series === m ? 'var(--ink, #0E0D0B)' : 'transparent', color: series === m ? '#fff' : 'var(--ink-muted)' }}>{m}</button>
            ))}
          </div>
        </div>
      </div>

      {/* drivers + movement chart */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,.85fr) minmax(320px,1.4fr)', gap: 48, marginTop: 32, alignItems: 'start' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 4 }}>Key movement drivers</div>
          {drivers.length === 0 && <div style={{ padding: '18px 0', fontSize: 14, color: 'var(--ink-faint)' }}>No exposure recorded yet.</div>}
          {drivers.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
              <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>{TYPE_LABELS[k] || k}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: v < 0 ? 'var(--good, #2f8f5b)' : 'var(--critical, #c43d2b)', whiteSpace: 'nowrap' }}>
                {v < 0 ? '+' : ''}{fmtMoney(Math.abs(v))}
              </span>
            </div>
          ))}
        </div>

        <div>
          {(() => {
            const W = 760, H = 230, PAD = 10
            const vals = weekBuckets.map(w => (series === 'Stabilized' ? w.stabilized : w.added))
            const alt = weekBuckets.map(w => w.stabilized)
            const maxV = Math.max(1, ...vals, ...(series === 'Both' ? alt : []))
            const xs = weekBuckets.map((_, i) => (i / Math.max(1, weekBuckets.length - 1)) * W)
            const yOf = (v: number) => H - PAD - (v / maxV) * (H - PAD * 2)
            const curve = (ys: number[]) => {
              let d = `M${xs[0]},${ys[0]}`
              for (let i = 0; i < xs.length - 1; i++) {
                const x0 = xs[Math.max(0, i - 1)], y0 = ys[Math.max(0, i - 1)]
                const x1 = xs[i], y1 = ys[i], x2 = xs[i + 1], y2 = ys[i + 1]
                const x3 = xs[Math.min(xs.length - 1, i + 2)], y3 = ys[Math.min(ys.length - 1, i + 2)]
                d += ` C${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ${x2},${y2}`
              }
              return d
            }
            const main = curve(vals.map(yOf))
            const second = curve(alt.map(yOf))
            const riskColor = series === 'Stabilized' ? 'var(--good, #2f8f5b)' : 'var(--critical, #c43d2b)'
            return (
              <div>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={230} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={series === 'Stabilized' ? '#2f8f5b' : '#c43d2b'} stopOpacity=".14" />
                      <stop offset="100%" stopColor={series === 'Stabilized' ? '#2f8f5b' : '#c43d2b'} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[0.25, 0.5, 0.75].map(f => (
                    <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--hairline, #EFEAE1)" strokeWidth="1" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
                  ))}
                  <path d={`${main} L${W},${H} L0,${H} Z`} fill="url(#riskFill)" />
                  <path d={main} fill="none" stroke={riskColor} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                  {series === 'Both' && (
                    <path d={second} fill="none" stroke="var(--good, #2f8f5b)" strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                  )}
                  <circle cx={xs[xs.length - 1]} cy={yOf(vals[vals.length - 1])} r="5" fill={riskColor} stroke="var(--paper, #FBF8F3)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  {weekBuckets.map((w, i) => (
                    <span key={i} style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, color: i === weekBuckets.length - 1 ? 'var(--accent)' : 'var(--ink-faint)' }}>{w.label}</span>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--hairline, #EFEAE1)', margin: '44px 0 0' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 56, marginTop: 64 }}>
        {/* signal mix */}
        <section style={{ minWidth: 0 }}>
          {SEC('Signal mix')}
          <div style={{ display: 'flex', height: 6, marginTop: 22, marginBottom: 10 }}>
            <div style={{ width: `${pct(sevCounts.high, live.length)}%`, background: 'var(--critical, #c43d2b)' }} />
            <div style={{ width: `${pct(sevCounts.watch, live.length)}%`, background: 'var(--warn, #d38b1d)' }} />
            <div style={{ width: `${pct(sevCounts.positive, live.length)}%`, background: 'var(--good, #2f8f5b)' }} />
          </div>
          <div style={{ display: 'flex', gap: 18, fontSize: 12.5, marginBottom: 20 }}>
            <span style={{ color: 'var(--critical, #c43d2b)' }}>{sevCounts.high} high</span>
            <span style={{ color: 'var(--warn, #d38b1d)' }}>{sevCounts.watch} watch</span>
            <span style={{ color: 'var(--good, #2f8f5b)' }}>{sevCounts.positive} positive</span>
          </div>
          {topTypes.map(([k, n]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
              <span style={{ flex: 1, fontSize: 14, color: 'var(--ink)' }}>{TYPE_LABELS[k] || k}</span>
              <span style={{ width: 120, height: 3, background: 'var(--hairline, #EFEAE1)', position: 'relative' }}>
                <span style={{ position: 'absolute', inset: 0, width: `${pct(n, Math.max(...topTypes.map(t => t[1])))}%`, background: 'var(--accent)' }} />
              </span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--ink)', width: 20, textAlign: 'right' }}>{n}</span>
            </div>
          ))}
        </section>

        {/* where signals come from */}
        <section style={{ minWidth: 0 }}>
          {SEC('Where signals come from')}
          <div style={{ marginTop: 22 }}>
            {sources.length === 0 && <div style={{ fontSize: 14, color: 'var(--ink-faint)', padding: '16px 0' }}>No sources yet.</div>}
            {sources.map(([k, n]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--ink)', textTransform: 'capitalize' }}>{k}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{pct(n, live.length)}%</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--ink)', width: 20, textAlign: 'right' }}>{n}</span>
              </div>
            ))}
          </div>
        </section>

        {/* engagement */}
        <section style={{ minWidth: 0 }}>
          {SEC('Most engaged accounts')}
          <div style={{ marginTop: 22 }}>
            {engaged.length === 0 && <div style={{ fontSize: 14, color: 'var(--ink-faint)', padding: '16px 0' }}>No correspondence history yet.</div>}
            {engaged.map(b => (
              <div key={b.account_name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.account_name}</span>
                <span style={{ width: 90, height: 3, background: 'var(--hairline, #EFEAE1)', position: 'relative' }}>
                  <span style={{ position: 'absolute', inset: 0, width: `${pct(b.total_messages || 0, maxEng)}%`, background: 'var(--ink)' }} />
                </span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--ink)', width: 28, textAlign: 'right' }}>{b.total_messages || 0}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* reply habits */}
      {(ourAvg != null || theirAvg != null) && (
        <section style={{ marginTop: 64 }}>
          {SEC('Reply habits', <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>median hours</span>)}
          <div style={{ display: 'flex', gap: 56, marginTop: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 36, letterSpacing: '-.04em', color: 'var(--accent)' }}>{ourAvg != null ? `${Math.round(ourAvg)}h` : '--'}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 6 }}>we reply in</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 36, letterSpacing: '-.04em', color: 'var(--ink)' }}>{theirAvg != null ? `${Math.round(theirAvg)}h` : '--'}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 6 }}>they reply in</div>
            </div>
            <div style={{ flex: 1, minWidth: 220, fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, alignSelf: 'center' }}>
              Measured across {withPairs.length} account{withPairs.length === 1 ? '' : 's'} with real back-and-forth. Accounts with no reply pairs are excluded rather than counted as zero.
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
