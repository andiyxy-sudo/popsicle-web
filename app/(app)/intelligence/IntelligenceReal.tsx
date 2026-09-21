'use client'

// Revenue Intelligence, built to the mobile Intelligence screen: narrative
// headline, four callouts, the risk-movement spine (new risk added, stabilized,
// drivers, 8-week chart), where the risk sits, what's working, then forecast
// vs actual, signal sources and upcoming renewals.
//
// One design, two data sources: demo passes DEMO_INTELLIGENCE, live builds
// the same IntelModel from the user's own rows.

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead } from '@/components/layout/PageHead'
import type { IntelModel } from '@/lib/demo-dataset'
import { EmptyState } from '@/components/ui/EmptyState'
import { AskThis } from '@/components/agent/AskThis'
import { X } from '@/components/explain/Explain'
import * as MX from '@/lib/metrics'
import * as IX from '@/lib/intel'

interface Sig { created_at?: string; account_name?: string | null; title?: string | null; severity?: string; signal_type?: string; source_integration?: string; risk_amount?: number; is_dismissed?: boolean; status?: string | null; handled_action?: string | null }
interface Msg { received_at?: string; direction?: string; integration?: string }
interface Baseline { account_name?: string; emails_per_week?: number; total_messages?: number; last_message_at?: string; our_median_reply_hours?: number; their_median_reply_hours?: number; total_reply_pairs?: number; confidence?: string }
interface Acct { name: string; value?: number | null; close_date?: string | null; risk_level?: string | null }

const TYPE_LABELS: Record<string, string> = {
  silent_stall: 'Silent stall', competitor_mention: 'Competitor activity', legal_loopin: 'Legal loop-in',
  price_flinch: 'Price flinch', champion_change: 'Champion change', timeline_slip: 'Timeline slip', deal_stage_backward: 'Deal moved backward',
  reengaged: 'Re-engaged', commitment_overdue: 'Commitment overdue',
  call_objection: 'Call objection', call_sentiment_drop: 'Call sentiment drop',
  call_buying_signal: 'Buying signal', call_commitment: 'Call commitment', call_summary: 'Call summary',
  meeting_cancelled: 'Meeting cancelled', meeting_declined: 'Meeting declined',
}
const SOURCE_LABELS: Record<string, string> = { gmail: 'Gmail / Outlook', outlook: 'Gmail / Outlook', slack: 'Slack', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', zoom: 'Calls & CRM', fireflies: 'Calls & CRM', meet: 'Calls & CRM', hubspot: 'Calls & CRM', gcal: 'Calendar' }

const DAY = 86400000
const MONO = { fontFamily: "'DM Mono',monospace", letterSpacing: '1.5px', textTransform: 'uppercase' as const }
const MONO_NUM = { fontFamily: "'DM Mono',monospace", fontVariantNumeric: 'tabular-nums' as const }
const OUTFIT = "'Outfit',sans-serif"
const RED = 'var(--critical, #c43d2b)'
const AMBER = 'var(--warn, #d38b1d)'
const GREEN = 'var(--good, #2f8f5b)'
const INK = 'var(--ink, #0E0D0B)'
const MUTED = 'var(--ink-muted, #5C5855)'
const FAINT = 'var(--ink-faint, #A09C97)'
const HAIR = 'var(--hairline, #EFEAE1)'
const RULE = 'var(--rule-strong, #0E0D0B)'
const ACCENT = 'var(--accent, #E85A25)'

function fmtMoney(v: number) {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(2).replace(/0$/, '')}M`
  if (v >= 1000) return `$${Math.round(v / 1000)}K`
  return `$${v}`
}
const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0)

// ---------------------------------------------------------------- live model
function buildLiveModel(signals: Sig[], accounts: Acct[], range: number): IntelModel {
  const now = Date.now()
  const live = signals.filter(s => !s.is_dismissed && s.status !== 'deleted')
  const amt = (s: Sig) => Number(s.risk_amount) || 0
  const inRange = live.filter(s => !s.created_at || now - new Date(s.created_at).getTime() <= range * DAY)
  const weeks: IntelModel['weeks'] = []
  for (let i = 7; i >= 0; i--) {
    const start = now - (i + 1) * 7 * DAY, end = now - i * 7 * DAY
    const w = inRange.filter(s => { const t = s.created_at ? new Date(s.created_at).getTime() : 0; return t >= start && t < end })
    weeks.push({
      label: `W${8 - i}`,
      added: w.filter(s => s.severity !== 'positive').reduce((a, s) => a + amt(s), 0),
      stabilized: w.filter(s => s.severity === 'positive' || s.status === 'handled').reduce((a, s) => a + amt(s), 0),
    })
  }
  const wFirst = weeks[0], wLast = weeks[weeks.length - 1]
  const riskDeltaPct = wFirst.added > 0 ? Math.round(((wLast.added - wFirst.added) / wFirst.added) * 100) : 0
  const stabilized = weeks.reduce((a, w) => a + w.stabilized, 0)
  const added = weeks.reduce((a, w) => a + w.added, 0)
  const handled = live.filter(s => s.status === 'handled')
  const holdingPct = live.length ? Math.round((handled.length / live.length) * 100) : 0

  const byType = new Map<string, number>()
  for (const s of inRange) { const k = s.signal_type || 'other'; byType.set(k, (byType.get(k) ?? 0) + amt(s) * (s.severity === 'positive' ? -1 : 1)) }
  const drivers = Array.from(byType.entries()).filter(([, v]) => v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4).map(([k, v]) => ({ k: TYPE_LABELS[k] || k, v }))
  const exposure = new Map<string, number>()
  for (const s of live) if ((!s.status || s.status === 'open') && s.severity !== 'positive') { const k = s.signal_type || 'other'; exposure.set(k, (exposure.get(k) ?? 0) + amt(s)) }
  const expTotal = Array.from(exposure.values()).reduce((a, b) => a + b, 0)
  const palette = ['#c43d2b', '#d38b1d', '#FF6B35', '#5C5855']
  const riskSits = Array.from(exposure.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v], i) => ({ k: TYPE_LABELS[k] || k, pct: pct(v, expTotal), exposure: v, color: palette[i] }))

  // Rules layer for live accounts (until enough closed quarters exist to measure):
  //  - success = share of handled signals of that action whose account is no longer high risk
  //  - churn Δ = a benchmark reduction per action type, scaled by the observed success rate
  const BENCH: Record<string, number> = { 'exec call': -31, 'executive call': -31, 'escalation': -22, 'exec escalation': -22, 'follow-up': -18, 'draft follow-up': -18, 'sent follow-up': -18, 'invoice chase': -8, 'handled': -12 }
  const accountRisk = new Map(accounts.map(a => [a.name, a.risk_level ?? 'low']))
  const byAction = new Map<string, { used: number; ok: number }>()
  for (const s of handled) {
    const k = s.handled_action || 'Follow-up'; const r = byAction.get(k) ?? { used: 0, ok: 0 }
    r.used++; if (accountRisk.get(s.account_name ?? '') !== 'high') r.ok++; byAction.set(k, r)
  }
  const actions = Array.from(byAction.entries()).map(([k, r]) => {
    const success = pct(r.ok, r.used)
    const bench = BENCH[k.toLowerCase()] ?? -12
    return { k, used: r.used, success, churn: Math.round(bench * (success / 78)) }   // 78% is the benchmark success rate
  }).sort((a, b) => b.used - a.used).slice(0, 4)
  // segments from deal size (HubSpot deal property `segment` wins when present)
  const segOf = (a: Acct & { segment?: string | null }) => a.segment || (Number(a.value) >= 500_000 ? 'Enterprise' : Number(a.value) >= 150_000 ? 'Mid-Market' : 'SMB')
  const segExposure = new Map<string, number>()
  for (const s of live) if ((!s.status || s.status === 'open') && s.severity !== 'positive') { const acc = accounts.find(a => a.name === s.account_name); if (acc) { const k = segOf(acc); segExposure.set(k, (segExposure.get(k) ?? 0) + amt(s)) } }
  const SEG_COLOR: Record<string, string> = { Enterprise: '#c43d2b', 'Mid-Market': '#d38b1d', SMB: '#7C5CFC' }
  const bySegment = Array.from(segExposure.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v, color: SEG_COLOR[k] ?? '#5C5855' }))
  const byHealth = [
    { k: 'Critical', n: accounts.filter(a => a.risk_level === 'high').length, color: '#c43d2b' },
    { k: 'Monitor', n: accounts.filter(a => a.risk_level === 'medium').length, color: '#d38b1d' },
    { k: 'Healthy', n: accounts.filter(a => a.risk_level === 'low').length, color: '#2f8f5b' },
  ]
  const peakWeek = weeks.reduce((best, w, i) => (w.added > weeks[best].added ? i : best), 0)
  const lastTwo = weeks.slice(-2)
  const wk = lastTwo.length === 2 && lastTwo[0].added > 0 ? Math.round(((lastTwo[1].added - lastTwo[0].added) / lastTwo[0].added) * 100) : 0
  const exposureTrend = added > 0 ? { total: wLast.added, vsPrior: wLast.added - (weeks[weeks.length - 2]?.added ?? wLast.added), peak: `${fmtMoney(weeks[peakWeek].added)} (${weeks[peakWeek].label})`, trajectory: wk > 0 ? `Worsening +${wk}%/wk` : wk < 0 ? `Improving ${wk}%/wk` : 'Flat', weeks: weeks.map(w => w.label), shape: weeks.map(w => (w.added / Math.max(1, ...weeks.map(x => x.added)))) } : undefined

  const bySrc = new Map<string, number>()
  for (const s of live) { const k = SOURCE_LABELS[s.source_integration || ''] || (s.source_integration || 'Other'); bySrc.set(k, (bySrc.get(k) ?? 0) + 1) }
  const sources = Array.from(bySrc.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ k, n }))

  const renewals = accounts
    .filter(a => a.close_date)
    .map(a => ({ account: a.name, days: Math.round((new Date(a.close_date!).getTime() - now) / DAY), value: Number(a.value) || 0, status: (a.risk_level === 'high' ? 'at risk' : a.risk_level === 'medium' ? 'monitor' : 'on track') as 'at risk' | 'monitor' | 'on track' }))
    .filter(r => r.days >= 0 && r.days <= 90).sort((a, b) => a.days - b.days).slice(0, 4)

  const deteriorated = Array.from(new Set(live.filter(s => (!s.status || s.status === 'open') && s.severity === 'high').map(s => s.account_name).filter(Boolean))) as string[]
  const reengaged = live.find(s => s.signal_type === 'reengaged')
  const won = live.find(s => s.signal_type === 'call_commitment' && s.severity === 'positive')
  const bullets = [
    deteriorated.length ? { tone: '#c43d2b', lead: `${deteriorated.length} account${deteriorated.length === 1 ? '' : 's'} deteriorated`, rest: `: ${deteriorated.slice(0, 3).join(', ')}.` } : null,
    reengaged ? { tone: '#2f8f5b', lead: `${reengaged.account_name} re-engaged`, rest: '.' } : null,
    won ? { tone: '#2f8f5b', lead: `${won.account_name} committed`, rest: won.title ? `: ${won.title}.` : '.' } : null,
    deteriorated.length ? { tone: '#0E0D0B', lead: 'Focus today:', rest: ` ${deteriorated.slice(0, 2).join(', ')}.` } : null,
  ].filter(Boolean) as IntelModel['bullets']

  const topDriver = riskSits[0]?.k.toLowerCase()
  return {
    riskDeltaPct, driver: topDriver || '', holdingPct, protectedTotal: handled.reduce((a, s) => a + amt(s), 0),
    bullets, weekNo: 8, newRisk: wLast.added, firstWeekRisk: wFirst.added,
    stabilized, netChangePct: added > 0 ? Math.round(((added - stabilized) / added) * 100) : 0,
    drivers, weeks, riskSits, actions,
    successRate: holdingPct, successTarget: 80, recovered: new Set(handled.map(s => s.account_name)).size, caughtEarly: live.length,
    fasterDays: 0, insight: actions[0] ? `${actions[0].k} carries the volume at ${actions[0].success}% effectiveness.` : '',
    forecast: undefined, sources, renewals,
    bySegment: bySegment.length ? bySegment : undefined, byHealth: accounts.length ? byHealth : undefined, exposureTrend,
  }
}

function scaleDemo(base: IntelModel, range: 30 | 60 | 90): IntelModel {
  if (range === 30) return base
  const k = range === 60 ? 1.9 : 2.8            // volume multiplier
  const extraWeeks = range === 60 ? 4 : 8      // weeks prepended to the chart
  const mult = (v: number) => Math.round(v * k / 1000) * 1000
  // earlier weeks sit lower, so the series climbs harder over the longer window
  const first = base.weeks[0]
  const prepended = Array.from({ length: extraWeeks }, (_, i) => {
    const f = (i + 1) / (extraWeeks + 1)
    return { label: '', added: Math.round(first.added * (0.62 + 0.38 * f) / 1000) * 1000, stabilized: Math.round(first.stabilized * (0.7 + 0.3 * f) / 1000) * 1000 }
  })
  const weeks = [...prepended, ...base.weeks].map((w, i) => ({ ...w, label: `W${i + 1}` }))
  const firstWeekRisk = weeks[0].added
  const riskDeltaPct = Math.round(((base.newRisk - firstWeekRisk) / firstWeekRisk) * 100)
  return {
    ...base,
    riskDeltaPct, firstWeekRisk, weekNo: weeks.length, weeks,
    stabilized: mult(base.stabilized), netChangePct: range === 60 ? 11 : 13,
    drivers: base.drivers.map(d => ({ ...d, v: Math.round(d.v * (range === 60 ? 1.6 : 2.2) / 1000) * 1000 })),
    riskSits: base.riskSits.map(r => ({ ...r, exposure: mult(r.exposure) })),
    actions: base.actions.map(a => ({ ...a, used: Math.round(a.used * k) })),
    caughtEarly: Math.round(base.caughtEarly * k), recovered: range === 60 ? 11 : 15,
    sources: base.sources.map(x => ({ ...x, n: Math.round(x.n * k) })),
    hero: base.hero ? { ...base.hero, caughtEarly: Math.round(base.hero.caughtEarly * k), recovered: range === 60 ? 11 : 15 } : undefined,
    performance: base.performance ? { ...base.performance, riskChangePct: range === 60 ? 11 : 13, stabilized: mult(base.performance.stabilized) } : undefined,
    bullets: base.bullets.map(b => ({ ...b, rest: b.rest.replace('this quarter', `in the last ${range} days`) })),
    insight: base.insight,
  }
}

// ---------------------------------------------------------------- pieces
function H2({ title, right, top = 'var(--gap-l)' as unknown as number }: { title: string; right?: React.ReactNode; top?: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingBottom: 16, borderBottom: `1px solid ${RULE}`, marginTop: top as unknown as number }}>
      <h2 style={{ margin: 0, fontFamily: OUTFIT, fontSize: 21, fontWeight: 700, letterSpacing: '-.03em', color: INK }}>{title}</h2>
      {right}
    </div>
  )
}
function Pills<T extends string>({ items, value, onChange }: { items: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--inset, #F4F0E8)', borderRadius: 'var(--toggle-radius, 0px)', padding: 3 }}>
      {items.map(m => (
        <button key={m} onClick={() => onChange(m)}
          style={{ font: 'inherit', fontSize: 12.5, fontWeight: value === m ? 600 : 500, padding: '6px 14px', borderRadius: 'var(--toggle-radius, 0px)', border: 0, cursor: 'pointer',
            background: value === m ? INK : 'transparent', color: value === m ? '#fff' : MUTED }}>{m}</button>
      ))}
    </div>
  )
}
const Row = ({ children, pad = '14px 0', ask }: { children: React.ReactNode; pad?: string; ask?: { q: string; account?: string } }) => (
  <div className={ask ? 'askable' : undefined} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: pad, borderBottom: `1px solid ${HAIR}`, fontSize: 14, color: INK }}>{children}{ask && <AskThis q={ask.q} account={ask.account} />}</div>
)

// ---------------------------------------------------------------- screen
export function IntelligenceReal({ signals, messages, baselines, accounts = [], demo }: { signals: Sig[]; messages: Msg[]; baselines: Baseline[]; accounts?: Acct[]; demo?: IntelModel }) {
  const [mounted, setMounted] = useState(false)
  const [range, setRange] = useState<30 | 60 | 90>(30)
  const [series, setSeries] = useState<'At risk' | 'Stabilized' | 'Both'>('At risk')
  const [sits, setSits] = useState<'By driver' | 'By segment' | 'By health'>('By driver')
  const [hoverW, setHoverW] = useState<number | null>(null)   // risk chart hover index
  // measured detection accuracy from the team's own thumbs up/down (live only)
  const [acc, setAcc] = useState<{ rated: number; pct: number } | null>(null)
  useEffect(() => {
    if (demo) { setAcc({ rated: 128, pct: 91 }); return }
    void (async () => {
      try {
        const { data } = await createClient().rpc('signal_accuracy')
        const row = Array.isArray(data) ? data[0] as { rated?: number; pct?: number } : null
        if (row && Number(row.rated) > 0) setAcc({ rated: Number(row.rated), pct: Number(row.pct) })
      } catch { /* migration not applied yet */ }
    })()
  }, [demo])
  useEffect(() => { setMounted(true) }, [])
  void messages; void baselines; void mounted

  if (!demo && signals.length === 0) {
    return (
      <div className="dsk-screen on">
        <PageHead eyebrow="Intelligence" crumb="no history yet" title={<>Not enough history yet. <span style={{ color: MUTED }}>This screen fills in as Popsicle syncs.</span></>} />
        <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, maxWidth: 440 }}>
          Connect an integration and let Popsicle sync for a few days. This screen fills in with your risk movement, what's working, and upcoming renewals.
        </div>
      </div>
    )
  }

  // Demo: the 30-day model is the source of truth; 60 and 90 days widen the window
  // (more weeks on the chart, more signals and actions, larger stabilized totals,
  // a bigger climb since the first week). Live: the window feeds the query filter.
  const m0 = demo ? scaleDemo(demo, range) : buildLiveModel(signals, accounts, range)
  // v11.119: the headline figures, computed for the selected window by lib/intel (demo and live alike),
  // so each one matches what its explanation shows
  const m = (() => {
    const A = accounts as unknown as MX.Acct[], S = signals as unknown as MX.Sig[]
    const now = demo ? Math.floor(Date.now() / 3600e3) * 3600e3 : Date.now()
    const rc = IX.riskChange(A, S, now, range), h = IX.holding(A, S, now, range), sp = IX.speed(A, S, now, range), w = IX.windowed(A, S, now, range)
    const q = MX.protectedRevenue(A, S)
    return {
      ...m0, riskDeltaPct: rc.value, driver: rc.driver ?? m0.driver, holdingPct: h.value, fasterDays: sp.value > 0 ? sp.value : 0,
      protectedTotal: q.value, caughtEarly: w.caught.value, recovered: q.parts.length,
      hero: m0.hero ? { ...m0.hero, protectedTotal: q.value, caughtEarly: w.caught.value, recovered: q.parts.length, fasterDays: sp.value > 0 ? sp.value : 0 } : m0.hero,
    }
  })()
  const srcTotal = m.sources.reduce((a, s) => a + s.n, 0)
  const srcMax = Math.max(1, ...m.sources.map(s => s.n))
  const renewTotal = m.renewals.reduce((a, r) => a + r.value, 0)
  const hasChurn = m.actions.some(a => a.churn !== 0)
  const renewMeta = { 'at risk': { c: RED, t: 'At risk' }, monitor: { c: AMBER, t: 'Monitor' }, 'on track': { c: GREEN, t: 'On track' } } as const

  return (
    <div className="dsk-screen on">
      {/* header with range control */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, minHeight: 36, flexWrap: 'wrap' }}>
        <div style={{ ...MONO, fontSize: 11, letterSpacing: '1.4px', color: FAINT }}>Revenue intelligence <span style={{ margin: '0 8px' }}>/</span> last {range} days</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Pills items={['30 days', '60 days', '90 days'] as const} value={`${range} days` as '30 days' | '60 days' | '90 days'} onChange={v => setRange(parseInt(v, 10) as 30 | 60 | 90)} />
          <button onClick={() => window.print()} style={{ font: 'inherit', fontSize: 13, fontWeight: 500, background: 'none', border: 0, color: MUTED, cursor: 'pointer' }}>Export PDF</button>
        </div>
      </div>

      {/* narrative */}
      <h1 style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 'clamp(30px,3.4vw,44px)', letterSpacing: '-.035em', lineHeight: 1.14, margin: '18px 0 0', maxWidth: 960, color: INK }}>
        {m.riskDeltaPct !== 0
          ? <>Revenue at risk is {m.riskDeltaPct > 0 ? 'up' : 'down'} <span style={{ color: m.riskDeltaPct > 0 ? RED : GREEN }}><X m="risk_change" days={range}>{Math.abs(m.riskDeltaPct)}%</X></span> in the last {range} days{m.driver ? <>, driven by {m.driver}</> : null}.{' '}</>
          : <>Revenue at risk is flat over the last {range} days.{' '}</>}
        <span style={{ color: MUTED }}>Interventions are holding at <X m="holding" days={range}>{m.holdingPct}%</X>, and Popsicle has protected <span style={{ color: ACCENT }}>{fmtMoney(m.protectedTotal)}</span> this quarter.</span>
      </h1>

      {m.bullets.length > 0 && (
        <div className="g4" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, m.bullets.length)}, minmax(0,1fr))`, gap: 28, marginTop: 'var(--gap-m)' }}>
          {m.bullets.map((b, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '10px 1fr', gap: 12, fontSize: 13.5, lineHeight: 1.55, color: MUTED }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.tone, marginTop: 7 }} />
              <div><strong style={{ fontWeight: 600, color: INK }}>{b.lead}</strong>{b.rest}</div>
            </div>
          ))}
        </div>
      )}

      {m.storyChips && m.storyChips.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22 }}>
          {m.storyChips.map(c => {
            const tone = /deteriorat|net risk/i.test(c) ? (/net risk/i.test(c) ? AMBER : RED) : GREEN
            return <span key={c} style={{ fontSize: 12, fontWeight: 600, color: tone, background: 'var(--inset, #F4F0E8)', borderRadius: 'var(--toggle-radius, 0px)', padding: '5px 11px' }}>{c}</span>
          })}
          {m.performance && <span style={{ fontSize: 12, color: MUTED, alignSelf: 'center', marginLeft: 6, ...MONO_NUM }}>last 30 days · risk change +{m.performance.riskChangePct}% · success {m.performance.successRatePct}% · stabilized {fmtMoney(m.performance.stabilized)}</span>}
        </div>
      )}

      <div style={{ height: 0, borderTop: `1px solid ${RULE}`, margin: 'var(--gap-m) 0 30px' }} />

      {/* ---- risk movement spine ---- */}
      <div style={{ ...MONO, fontSize: 10, color: FAINT }}>New risk added · week {m.weekNo}</div>
      <div style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 'clamp(52px,6.4vw,84px)', letterSpacing: '-.05em', lineHeight: 1, marginTop: 12, color: RED }}>{fmtMoney(m.newRisk)}</div>
      {m.firstWeekRisk > 0 && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 14, fontSize: 13.5 }}>
          <span style={{ color: m.riskDeltaPct > 0 ? RED : GREEN, fontWeight: 600 }}>{m.riskDeltaPct > 0 ? '▲' : '▼'} {m.riskDeltaPct > 0 ? '+' : ''}{m.riskDeltaPct}%</span>
          <span style={{ color: MUTED }}>vs W1 · {fmtMoney(m.firstWeekRisk)}</span>
        </div>
      )}

      <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,.85fr) minmax(320px,1.4fr)', gap: 48, marginTop: 'var(--gap-m)', alignItems: 'end' }}>
        <div style={{ display: 'flex', gap: 56 }}>
          <div>
            <div style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 30, letterSpacing: '-.04em', color: GREEN, lineHeight: 1 }}>{fmtMoney(m.stabilized)}</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 8 }}>stabilized this period</div>
          </div>
          <div>
            <div style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 30, letterSpacing: '-.04em', color: m.netChangePct > 0 ? RED : GREEN, lineHeight: 1 }}>{m.netChangePct > 0 ? '+' : ''}{m.netChangePct}%</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 8 }}>net risk change</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 18 }}>
            <span style={{ fontSize: 12.5, color: MUTED, display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: RED }} />At risk</span>
            <span style={{ fontSize: 12.5, color: MUTED, display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} />Stabilized</span>
          </div>
          <Pills items={['At risk', 'Stabilized', 'Both'] as const} value={series} onChange={setSeries} />
        </div>
      </div>

      <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,.85fr) minmax(320px,1.4fr)', gap: 48, marginTop: 'var(--gap-m)', alignItems: 'start' }}>
        <div>
          <div style={{ ...MONO, fontSize: 10, color: FAINT, marginBottom: 6 }}>Key movement drivers</div>
          {m.drivers.length === 0 && <EmptyState line="No movement to explain yet." hint="Drivers appear once signals carry a dollar amount at risk." compact />}
          {m.drivers.map(d => (
            <Row key={d.k} ask={{ q: `What is driving "${d.k}" in my risk this period, and what should I do about it?` }}>
              <span>{d.k}</span>
              <span style={{ ...MONO_NUM, fontSize: 13, color: d.v < 0 ? GREEN : RED }}>{d.v < 0 ? '+' : ''}{fmtMoney(Math.abs(d.v))}</span>
            </Row>
          ))}
          {m.exposureTrend && (
            <div style={{ marginTop: 16 }}>
              <Row pad="10px 0"><span style={{ color: MUTED }}>Peak exposure</span><span style={{ ...MONO_NUM, fontSize: 13, color: RED }}>{m.exposureTrend.peak.replace(/[()]/g, '').replace(' ', ' · ')}</span></Row>
              <Row pad="10px 0"><span style={{ color: MUTED }}>Trajectory</span><span style={{ ...MONO_NUM, fontSize: 13, color: AMBER }}>{m.exposureTrend.trajectory}</span></Row>
            </div>
          )}
        </div>
        <div>
          {(() => {
            const W = 760, H = 230, PAD = 12
            const vals = m.weeks.map(w => (series === 'Stabilized' ? w.stabilized : w.added))
            const alt = m.weeks.map(w => w.stabilized)
            const maxV = Math.max(1, ...vals, ...(series === 'Both' ? alt : []))
            const xs = m.weeks.map((_, i) => (i / Math.max(1, m.weeks.length - 1)) * W)
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
            const color = series === 'Stabilized' ? '#2f8f5b' : '#c43d2b'
            return (
              <div style={{ position: 'relative' }}>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={230} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
                  onMouseMove={e => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const f = (e.clientX - r.left) / r.width; setHoverW(Math.max(0, Math.min(m.weeks.length - 1, Math.round(f * (m.weeks.length - 1))))) }}
                  onMouseLeave={() => setHoverW(null)}>
                  <defs>
                    <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity=".16" />
                      <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[PAD, H * 0.33, H * 0.66].map(y => (
                    <line key={y} x1="0" x2={W} y1={y} y2={y} stroke={HAIR} strokeWidth="1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
                  ))}
                  <path d={`${main} L${W},${H} L0,${H} Z`} fill="url(#riskFill)" />
                  <path d={main} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                  {series === 'Both' && <path d={second} fill="none" stroke="#2f8f5b" strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />}
                  <circle cx={xs[xs.length - 1]} cy={yOf(vals[vals.length - 1])} r="5" fill={color} stroke="var(--paper, #FBF8F3)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  {hoverW != null && (
                    <g>
                      <line x1={xs[hoverW]} x2={xs[hoverW]} y1={0} y2={H} stroke="var(--ink, #0E0D0B)" strokeWidth="1" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" opacity=".5" />
                      <circle cx={xs[hoverW]} cy={yOf(vals[hoverW])} r="4" fill={color} stroke="var(--paper, #FBF8F3)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </g>
                  )}
                </svg>
                {hoverW != null && (
                  <div style={{ position: 'absolute', left: `${(hoverW / Math.max(1, m.weeks.length - 1)) * 100}%`, top: 0, transform: `translateX(${hoverW > m.weeks.length / 2 ? '-100%' : '0'})`, pointerEvents: 'none',
                    background: 'var(--paper, #FBF8F3)', border: `1px solid ${HAIR}`, padding: '8px 12px', ...MONO_NUM, fontSize: 11, color: MUTED, whiteSpace: 'nowrap', boxShadow: '0 8px 24px -12px rgba(14,13,11,.25)' }}>
                    <div style={{ color: INK, marginBottom: 4 }}>{m.weeks[hoverW].label}</div>
                    <div>at risk <span style={{ color: RED }}>{fmtMoney(m.weeks[hoverW].added)}</span> · stabilized <span style={{ color: GREEN }}>{fmtMoney(m.weeks[hoverW].stabilized)}</span></div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  {m.weeks.map((w, i) => <span key={i} style={{ ...MONO_NUM, fontSize: 10, color: i === m.weeks.length - 1 ? ACCENT : FAINT }}>{w.label}</span>)}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ---- where the risk sits ---- */}
      {m.riskSits.length > 0 && (
        <>
          <H2 title="Where the risk sits" right={(m.bySegment || m.byHealth)
            ? <Pills items={(['By driver', ...(m.bySegment ? ['By segment'] : []), ...(m.byHealth ? ['By health'] : [])] as Array<'By driver' | 'By segment' | 'By health'>)} value={sits} onChange={setSits} />
            : <span style={{ ...MONO, fontSize: 11, color: FAINT, textTransform: 'none', letterSpacing: '.3px' }}>open exposure by driver</span>} />
          {sits === 'By segment' && m.bySegment && (() => {
            const tot = m.bySegment.reduce((a, x) => a + x.v, 0) || 1
            return (
              <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) minmax(260px,.9fr)', gap: 48, marginTop: 30 }}>
                <div>
                  {m.bySegment.map(x => (
                    <Row key={x.k} pad="14px 0">
                      <span style={{ color: INK }}>{x.k}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ width: 160, height: 3, background: HAIR, position: 'relative' }}><span style={{ position: 'absolute', inset: 0, width: `${Math.round((x.v / tot) * 100)}%`, background: x.color }} /></span>
                        <span style={{ ...MONO_NUM, fontSize: 13, color: x.color, width: 56, textAlign: 'right' }}>{fmtMoney(x.v)}</span>
                      </span>
                    </Row>
                  ))}
                </div>
                {m.exposureTrend && (
                  <div>
                    <div style={{ ...MONO, fontSize: 10, color: FAINT, marginBottom: 6 }}>Exposure trend · {fmtMoney(m.exposureTrend.total)} total · +{fmtMoney(m.exposureTrend.vsPrior)} vs prior period</div>
                    <Row><span style={{ color: MUTED }}>Peak exposure</span><span style={{ ...MONO_NUM, fontSize: 13, color: RED }}>{m.exposureTrend.peak}</span></Row>
                    <Row><span style={{ color: MUTED }}>Current trajectory</span><span style={{ ...MONO_NUM, fontSize: 13, color: AMBER }}>{m.exposureTrend.trajectory}</span></Row>
                  </div>
                )}
              </div>
            )
          })()}
          {sits === 'By health' && m.byHealth && (() => {
            const tot = m.byHealth.reduce((a, x) => a + x.n, 0) || 1
            return (
              <div style={{ maxWidth: 560, marginTop: 30 }}>
                <div style={{ ...MONO, fontSize: 10, color: FAINT, marginBottom: 6 }}>Churn probability distribution · {tot} accounts</div>
                {m.byHealth.map(x => (
                  <Row key={x.k} pad="14px 0">
                    <span style={{ color: x.color, fontWeight: 600 }}>{x.k}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 220, height: 3, background: HAIR, position: 'relative' }}><span style={{ position: 'absolute', inset: 0, width: `${Math.round((x.n / tot) * 100)}%`, background: x.color }} /></span>
                      <span style={{ ...MONO_NUM, fontSize: 13, color: x.color, width: 20, textAlign: 'right' }}>{x.n}</span>
                    </span>
                  </Row>
                ))}
              </div>
            )
          })()}
          <div style={{ display: sits === 'By driver' || !(sits === 'By segment' ? m.bySegment : m.byHealth) ? 'grid' : 'none', gridTemplateColumns: `repeat(${Math.min(4, m.riskSits.length)}, minmax(0,1fr))`, gap: 64, marginTop: 30 }}>
            {m.riskSits.map(r => (
              <div key={r.k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 15, color: INK }}>{r.k}</span>
                  <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 24, letterSpacing: '-.03em', color: r.color }}>{r.pct}%</span>
                </div>
                <div style={{ height: 3, background: HAIR, marginTop: 10, position: 'relative' }}>
                  <span style={{ position: 'absolute', inset: 0, width: `${r.pct}%`, background: r.color }} />
                </div>
                <div style={{ fontSize: 12.5, color: FAINT, marginTop: 14, paddingBottom: 18, borderBottom: `1px solid ${HAIR}` }}>{fmtMoney(r.exposure)} exposure</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---- what's working ---- */}
      <H2 title="What's working" right={<span style={{ ...MONO, fontSize: 11, color: FAINT, textTransform: 'none', letterSpacing: '.3px' }}>action → outcome · this quarter</span>} />
      <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,.95fr) minmax(300px,1fr)', gap: 96, marginTop: 8, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: hasChurn ? 'minmax(0,1fr) 60px 80px 80px' : 'minmax(0,1fr) 60px 80px', gap: 12, ...MONO, fontSize: 10, color: FAINT, padding: '16px 0 12px' }}>
            <span>Action</span><span style={{ textAlign: 'right' }}>Used</span><span style={{ textAlign: 'right' }}>Success</span>{hasChurn && <span style={{ textAlign: 'right' }}>Churn Δ{demo ? '' : ' est.'}</span>}
          </div>
          {m.actions.length === 0 && <EmptyState line="Nothing handled yet." hint="Mark a signal handled and its action shows up here with its outcome." compact />}
          {m.actions.map(a => (
            <div key={a.k} style={{ display: 'grid', gridTemplateColumns: hasChurn ? 'minmax(0,1fr) 60px 80px 80px' : 'minmax(0,1fr) 60px 80px', gap: 12, padding: '18px 0', borderTop: `1px solid ${HAIR}`, fontSize: 14.5, alignItems: 'center' }}>
              <span style={{ color: INK }}>{a.k}</span>
              <span style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: MUTED }}>{a.used}</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: a.success >= 60 ? GREEN : AMBER }}>{a.success}%</span>
              {hasChurn && <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: a.churn <= -15 ? GREEN : a.churn < 0 ? AMBER : INK }}>{a.churn ? `${a.churn}%` : '--'}</span>}
            </div>
          ))}
        </div>
        <div style={{ paddingTop: 16 }}>
          <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 20 }}>
            <div>
              <div style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 38, letterSpacing: '-.04em', color: ACCENT, lineHeight: 1 }}><X m="protected">{fmtMoney(m.protectedTotal)}</X></div>
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 8 }}>protected this quarter</div>
            </div>
            <div>
              <div style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 38, letterSpacing: '-.04em', color: INK, lineHeight: 1 }}>{m.successRate}%</div>
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 8 }}>success rate · target {m.successTarget}%</div>
            </div>
            <div>
              <div style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 38, letterSpacing: '-.04em', color: GREEN, lineHeight: 1 }}><X m="protected">{m.recovered}</X></div>
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 8 }}>deals recovered · <X m="caught" days={range}>{m.caughtEarly}</X> caught early</div>
            </div>
          </div>
          {m.fasterDays > 0 && (
            <div style={{ marginTop: 'var(--gap-m)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 38, letterSpacing: '-.04em', color: INK, lineHeight: 1 }}><X m="speed" days={range}>{m.fasterDays}</X></span>
                <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 18, color: FAINT }}>d</span>
              </div>
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 8 }}>faster response vs last quarter</div>
            </div>
          )}
          {acc && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginTop: 18, paddingTop: 16, borderTop: `1px solid ${HAIR}` }}>
              <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 26, letterSpacing: '-.03em', color: acc.pct >= 85 ? GREEN : acc.pct >= 70 ? AMBER : RED }}>{acc.pct}%</span>
              <span style={{ fontSize: 13.5, color: MUTED }}>of signals rated useful by the team{acc.rated ? ` · ${acc.rated} rated` : ''}</span>
            </div>
          )}
          {m.insight && <div style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, marginTop: 30 }}>{m.insight}</div>}
        </div>
      </div>

      {(m.forecast || m.sources.length > 0 || m.renewals.length > 0) && <div style={{ height: 0, borderTop: `1px solid ${RULE}`, margin: 'var(--gap-l) 0 30px' }} />}

      {/* ---- forecast / sources / renewals (only the columns that have data) ---- */}
      {(() => { const cols = [!!m.forecast, m.sources.length > 0, m.renewals.length > 0].filter(Boolean).length || 1; return (
      <div className="g3" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 72 }}>
        {m.forecast && (
        <div>
          <div style={{ ...MONO, fontSize: 10, color: FAINT, marginBottom: 6 }}>Forecast vs actual · MTD</div>
          {m.forecast ? (() => {
            const v = m.forecast.actual - m.forecast.forecast
            return (
              <>
                <Row><span style={{ color: MUTED }}>Forecast</span><span style={{ ...MONO_NUM, fontSize: 13 }}>{fmtMoney(m.forecast.forecast)}</span></Row>
                <Row><span style={{ color: MUTED }}>Actual</span><span style={{ ...MONO_NUM, fontSize: 13, color: GREEN }}>{fmtMoney(m.forecast.actual)}</span></Row>
                <Row><span style={{ color: MUTED }}>Variance</span><span style={{ ...MONO_NUM, fontSize: 13, color: v < 0 ? AMBER : GREEN }}>{v < 0 ? '-' : '+'}{fmtMoney(Math.abs(v))}</span></Row>
              </>
            )
          })() : null}
        </div>
        )}

        {m.sources.length > 0 && (
        <div>
          <div style={{ ...MONO, fontSize: 10, color: FAINT, marginBottom: 6 }}>Signal sources · {srcTotal} signals</div>
          {m.sources.map(s => (
            <Row key={s.k} pad="13px 0">
              <span style={{ color: MUTED }}>{s.k}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <span style={{ ...MONO_NUM, fontSize: 12, color: INK }}>{s.n}</span>
                <span style={{ color: FAINT, fontSize: 11 }}>·</span>
                <span style={{ ...MONO_NUM, fontSize: 12, color: INK, width: 34, textAlign: 'right' }}>{pct(s.n, srcTotal)}%</span>
                <span style={{ width: 74, height: 3, background: HAIR, position: 'relative' }}>
                  <span style={{ position: 'absolute', inset: 0, width: `${pct(s.n, srcMax)}%`, background: 'linear-gradient(90deg, #FF8A50, var(--accent, #E85A25))' }} />
                </span>
              </span>
            </Row>
          ))}
        </div>
        )}

        {m.renewals.length > 0 && (
        <div>
          <div style={{ ...MONO, fontSize: 10, color: FAINT, marginBottom: 6 }}>Renewals · next 90 days{renewTotal ? <> · {fmtMoney(renewTotal)}</> : null}</div>
          {m.renewals.map(r => {
            const s = renewMeta[r.status]
            return (
              <Row key={r.account} pad="13px 0" ask={{ q: `Is the ${r.account} renewal safe? What could still go wrong?`, account: r.account }}>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                  <span style={{ color: INK, fontWeight: 500, whiteSpace: 'nowrap' }}>{r.account}</span>
                  <span style={{ ...MONO_NUM, fontSize: 11, color: FAINT, whiteSpace: 'nowrap' }}>{r.days}d · {fmtMoney(r.value)}</span>
                </span>
                <span style={{ ...MONO, fontSize: 10, color: s.c, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.c }} />{s.t}
                </span>
              </Row>
            )
          })}
        </div>
        )}
      </div>
      ) })()}
    </div>
  )
}
