'use client'

// Team intelligence, built to the mobile Team screen: narrative headline,
// four takeaways, three coverage figures, the saves leaderboard, per-rep
// breakdowns (response trend + activity heatmap + accounts), the unactioned
// queue, and the execution summary.
//
// One design, two data sources: demo mode passes a fixed TeamModel
// (DEMO_TEAM), live mode builds the same shape from accounts + signals.

import { Fragment, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Account, Signal } from '@/types'
import { formatCurrency } from '@/lib/utils'
import type { TeamModel, TeamRep, TeamQueueItem } from '@/lib/demo-dataset'
import { EmptyState } from '@/components/ui/EmptyState'
import { AskThis } from '@/components/agent/AskThis'
import { X } from '@/components/explain/Explain'

const ACTION_FILTERS = ['All', 'Critical only', 'My accounts'] as const

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

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase()
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
const word = (n: number) => (n >= 0 && n <= 10 ? WORDS[n] : String(n))
// a multiple such as "2.5x slower" means the rep is behind the team: show it in red
const markUp = (t: string) => t.split(/(\d+(?:\.\d+)?x(?=\s+slower)|\blacks?\b)/i)
  .map((part, k) => (/^(\d+(?:\.\d+)?x|lacks?)$/i.test(part) ? <span key={k} style={{ color: RED }}>{part}</span> : part))
const fmtH = (h: number) => `${h.toFixed(1)}h`

// ---------------------------------------------------------------- live model
function buildLiveModel(accounts: Account[], signals: Signal[], me: string, repNames?: Record<string, string>): TeamModel {
  const live = signals.filter(s => !s.is_dismissed && s.status !== 'deleted')
  const open = live.filter(s => !s.status || s.status === 'open')
  const handled = live.filter(s => s.status === 'handled')
  const amt = (s: Signal) => Number(s.risk_amount) || 0
  const hoursTo = (s: Signal) => {
    const h = (s as unknown as { handled_at?: string }).handled_at
    return s.created_at && h ? (new Date(h).getTime() - new Date(s.created_at).getTime()) / 3600000 : null
  }
  const median = (xs: number[]) => { const a = xs.filter(x => x >= 0).sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : null }

  type R = { name: string; accounts: Account[]; open: Signal[]; handled: Signal[]; value: number; protectedValue: number }
  const byRep = new Map<string, R>()
  // the rep is the Popsicle user who owns the account, not the buyer named in `owner`
  const repOf = (a: Account) => repNames?.[(a as Account & { user_id?: string }).user_id ?? ''] ?? me
  for (const a of accounts) {
    const k = repOf(a)
    const r = byRep.get(k) ?? { name: k, accounts: [], open: [], handled: [], value: 0, protectedValue: 0 }
    r.accounts.push(a); r.value += Number(a.value) || 0; byRep.set(k, r)
  }
  const ownerFor = (n?: string | null) => { const a = accounts.find(x => x.name === n); return a ? repOf(a) : me }
  for (const s of live) {
    const r = byRep.get(ownerFor(s.account_name)); if (!r) continue
    if (s.status === 'handled') { r.handled.push(s); r.protectedValue += amt(s) } else if (!s.status || s.status === 'open') r.open.push(s)
  }
  const colors = ['#FF6B35', '#2f6f9f', '#7C5CFC', '#2f8f5b', '#d38b1d']
  const teamT2A = median(handled.map(hoursTo).filter((x): x is number => x != null))
  const reps: TeamRep[] = Array.from(byRep.values()).sort((a, b) => b.protectedValue - a.protectedValue || b.value - a.value).map((r, i) => {
    const total = r.open.length + r.handled.length
    const rate = total ? Math.round((r.handled.length / total) * 100) : 0
    const t = median(r.handled.map(hoursTo).filter((x): x is number => x != null)) ?? 0
    const lastTouch = Math.max(0, ...r.accounts.map(a => a.last_contact_date ? new Date(a.last_contact_date).getTime() : 0))
    const staleDays = lastTouch ? Math.floor((Date.now() - lastTouch) / 86400000) : 0
    return {
      name: r.name, title: i === 0 && r.name === me ? 'Owner' : 'Rep', color: colors[i % colors.length],
      accounts: r.accounts.map(a => a.name), arr: r.value,
      signals: total, saved: r.handled.length, protectedValue: r.protectedValue, avgResp: t, saveRate: rate,
      churnDelta: 0, performance: rate,
      trend: teamT2A != null && t <= teamT2A ? 'improving' : t > (teamT2A ?? 0) + 1 ? 'needs coaching' : 'steady',
      spark: Array(7).fill(t || 1), activity: Array.from({ length: 5 }, () => Array(7).fill(0)),
      ownership: staleDays >= 3 ? 'stale' : 'active', ownershipNote: staleDays >= 3 ? `Stale ${staleDays}d` : undefined,
      followThrough: rate, closure: rate,
    }
  })
  const critical = Array.from(new Set(open.filter(s => s.severity === 'high').map(s => s.account_name).filter(Boolean)))
  const covered = accounts.filter(a => live.some(s => s.account_name === a.name)).length
  const split = [
    { k: 'Critical', color: '#c43d2b', sigs: open.filter(s => s.severity === 'high') },
    { k: 'Watching', color: '#d38b1d', sigs: open.filter(s => s.severity === 'watch') },
    { k: 'Healthy', color: '#2f8f5b', sigs: open.filter(s => s.severity === 'positive') },
  ].map(x => ({ k: x.k, color: x.color, value: x.sigs.reduce((a, s) => a + amt(s), 0), accts: new Set(x.sigs.map(s => s.account_name)).size }))
  const age = (iso?: string | null) => { if (!iso) return ''; const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000); return h < 24 ? `${Math.max(1, h)}h` : `${Math.floor(h / 24)}d` }
  const queue: TeamQueueItem[] = open.sort((a, b) => amt(b) - amt(a)).slice(0, 8).map(s => ({
    account: s.account_name || '', sev: s.severity === 'high' ? 'critical' : s.severity === 'watch' ? 'high' : 'medium',
    summary: s.title, age: age(s.created_at), rep: ownerFor(s.account_name), signalId: s.id,
  }))
  const critOwners = new Set(critical.map(n => ownerFor(n)))
  const followRate = live.length ? Math.round((handled.length / live.length) * 100) : 0
  const bullets = [
    critical.length ? { tone: '#c43d2b', text: `${critical.length} critical account${critical.length === 1 ? '' : 's'}: ${critical.slice(0, 3).join(', ')}.` } : null,
    reps[0] ? { tone: '#2f8f5b', text: `${reps[0].name} leads on saves, ${formatCurrency(reps[0].protectedValue)} protected across ${reps[0].accounts.length} account${reps[0].accounts.length === 1 ? '' : 's'}.` } : null,
    teamT2A != null ? { tone: '#d38b1d', text: `${fmtH(teamT2A)} median response from signal raised to handled.` } : null,
    { tone: '#0E0D0B', text: `Coverage: ${covered} of ${accounts.length} accounts have live signal.` },
  ].filter(Boolean) as TeamModel['bullets']
  return {
    protectedTotal: handled.reduce((a, s) => a + amt(s), 0), protectedDeltaPct: 0,
    waitingCount: open.length, waitingValue: open.reduce((a, s) => a + amt(s), 0), criticalWithOneRep: critical.length > 1 && critOwners.size === 1,
    bullets, arr: accounts.reduce((a, x) => a + (Number(x.value) || 0), 0), accountCount: accounts.length, split,
    timeToAction: teamT2A ?? 0, timeToActionDelta: 0,
    coveragePct: accounts.length ? Math.round((covered / accounts.length) * 100) : 0, covered,
    signalsThisWeek: live.length, actioned: handled.length, autoDeployedPct: 0,
    reps, queue, unresolvedPct: live.length ? Math.round((open.length / live.length) * 100) : 0,
    newCritical: critical.length, stabilized: new Set(handled.map(s => s.account_name)).size, actionsTaken: handled.length,
    signalsPerDay: Math.round((live.length / 7) * 10) / 10, signalsPerDayDelta: 0,
    criticalOwned: `${critical.length}/${critical.length}`, activeFollowUp: `${reps.filter(r => r.ownership === 'active').length}/${reps.length}`,
    followThrough: followRate, loopClosure: followRate,
  }
}

// ---------------------------------------------------------------- pieces
function Avatar({ rep, size = 32 }: { rep: Pick<TeamRep, 'name' | 'color'>; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: rep.color, color: '#fff', display: 'grid', placeItems: 'center', fontSize: Math.round(size * 0.34), fontWeight: 700, flex: 'none', fontFamily: OUTFIT }}>
      {initials(rep.name)}
    </span>
  )
}

function Spark({ pts, color }: { pts: number[]; color: string }) {
  const W = 100, H = 40, p = 4
  const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * (W - p * 2) + p, H - p - ((v - min) / span) * (H - p * 2)])
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
  const [ex, ey] = xy[xy.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={72} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={ex} cy={ey} r="2.2" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const HEAT_ROWS = ['8-10', '10-12', '12-2', '2-4', '4-6']
const HEAT_COLS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
function Heat({ grid }: { grid: number[][] }) {
  const cell = (lvl: number) => lvl <= 0 ? 'var(--inset, #F4F0E8)' : `rgba(255,107,53,${0.18 + lvl * 0.2})`
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(7, 1fr)', gap: 3, alignItems: 'center' }}>
      <span />
      {HEAT_COLS.map(c => <span key={c} style={{ ...MONO, letterSpacing: '.5px', fontSize: 10, color: FAINT, textAlign: 'center', textTransform: 'none' }}>{c}</span>)}
      {grid.map((row, r) => (
        <Fragment key={r}>
          <span style={{ ...MONO, letterSpacing: '.5px', fontSize: 10, color: FAINT, textTransform: 'none' }}>{HEAT_ROWS[r]}</span>
          {row.map((lvl, c) => <span key={c} style={{ height: 22, borderRadius: 2, background: cell(lvl) }} />)}
        </Fragment>
      ))}
    </div>
  )
}

function H2({ title, right, top = 'var(--gap-l)' as unknown as number }: { title: string; right?: React.ReactNode; top?: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, paddingBottom: 14, borderBottom: `1px solid ${RULE}`, marginTop: top as unknown as number }}>
      <h2 style={{ margin: 0, fontFamily: OUTFIT, fontSize: 21, fontWeight: 700, letterSpacing: '-.03em', color: INK }}>{title}</h2>
      {right}
    </div>
  )
}

const Row = ({ children, pad = '11px 0' }: { children: React.ReactNode; pad?: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: pad, borderBottom: `1px solid ${HAIR}`, fontSize: 14, color: INK }}>{children}</div>
)

// ---------------------------------------------------------------- screen
export function TeamReal({ accounts, signals, me, demo, repNames }: { accounts: Account[]; signals: Signal[]; me: string; integrations?: string[]; demo?: TeamModel; repNames?: Record<string, string> }) {
  const [mounted, setMounted] = useState(false)
  const [queueRep, setQueueRep] = useState<string>('All')
  const [feedFilter, setFeedFilter] = useState<typeof ACTION_FILTERS[number]>('All')
  useEffect(() => { setMounted(true) }, [])
  const router = useRouter()

  const m = demo ?? buildLiveModel(accounts, signals, me, repNames)
  const repBy = (n: string) => m.reps.find(r => r.name === n) ?? { name: n, color: 'var(--d-faint, #A09C97)' }
  const respColor = (h: number) => {
    const best = Math.min(...m.reps.map(r => r.avgResp))
    return h <= best ? GREEN : h > m.timeToAction + 0.5 ? AMBER : INK
  }
  const trendMeta = { improving: { c: GREEN, t: '↓ improving' }, steady: { c: AMBER, t: '→ steady' }, 'needs coaching': { c: RED, t: '↑ needs coaching' } } as const
  const sevMeta = { critical: { c: RED, t: 'critical' }, high: { c: AMBER, t: 'high' }, medium: { c: FAINT, t: 'medium' } } as const
  const queue = m.queue.filter(q => queueRep === 'All' || q.rep === queueRep)
  const splitTotal = m.split.reduce((a, x) => a + x.value, 0) || 1
  const crit = m.split.find(x => x.k === 'Critical')?.accts ?? 0

  const openQueueItem = (q: TeamQueueItem) => router.push(q.signalId ? `/signals?signal=${q.signalId}` : `/accounts/${encodeURIComponent(q.account)}`)

  return (
    <div className="dsk-screen on">
      {/* header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, minHeight: 36, flexWrap: 'wrap' }}>
        <div style={{ ...MONO, fontSize: 11, color: FAINT }}>Team intelligence <span style={{ margin: '0 8px' }}>/</span> {m.reps.length} reps</div>
        <div style={{ ...MONO, fontSize: 11, color: FAINT, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {m.actioned} / {m.signalsThisWeek} actioned <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} />
        </div>
      </div>

      {/* narrative */}
      <h1 style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 'clamp(30px,3.4vw,44px)', letterSpacing: '-.035em', lineHeight: 1.14, margin: '18px 0 0', maxWidth: 960, color: INK }}>
        The team protected <span style={{ color: ACCENT }}>{formatCurrency(m.protectedTotal)}</span> this quarter{m.protectedDeltaPct ? <>, up <span style={{ color: GREEN }}>{m.protectedDeltaPct}%</span> on Q3</> : null}.{' '}
        <span style={{ color: MUTED }}>
          {m.headline
            ? <>{m.exposure ? <><span style={{ color: RED }}>{formatCurrency(m.exposure.total)}</span> is exposed across {m.accountCount} accounts. </> : null}{markUp(m.headline)}</>
            : m.waitingCount > 0
            ? <>{word(m.waitingCount)} signal{m.waitingCount === 1 ? '' : 's'} worth <span style={{ color: RED }}>{formatCurrency(m.waitingValue)}</span> {m.waitingCount === 1 ? 'is' : 'are'} still waiting for a response{m.criticalWithOneRep && crit === 2 ? ', and both critical accounts sit with one rep' : m.criticalWithOneRep ? `, and all ${crit} critical accounts sit with one rep` : ''}.</>
            : <>Nothing is waiting for a response.</>}
        </span>
      </h1>

      {/* takeaways */}
      {m.bullets.length > 0 && (
        <div className="g4" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, m.bullets.length)}, minmax(0,1fr))`, gap: 28, marginTop: 'var(--gap-m)' }}>
          {m.bullets.map((b, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '10px 1fr', gap: 12, fontSize: 13.5, lineHeight: 1.55, color: MUTED }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.tone, marginTop: 7 }} />
              <div>{b.text}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 0, borderTop: `1px solid ${RULE}`, margin: 'var(--gap-m) 0 30px' }} />

      {/* three figures */}
      <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 88 }}>
        {/* Exposure summary (mobile) or ARR */}
        {m.exposure ? (
          <div>
            <div style={{ ...MONO, fontSize: 10, color: FAINT, display: 'flex', justifyContent: 'space-between' }}><span>Revenue exposure</span><span style={{ color: GREEN, display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} />Live</span></div>
            <div style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 'clamp(38px,4.2vw,58px)', letterSpacing: '-.05em', lineHeight: 1, marginTop: 14, color: RED }}><X m="team_exposure">{formatCurrency(m.exposure.total)}</X></div>
            <div style={{ fontSize: 13.5, color: MUTED, marginTop: 10 }}>total exposure across {m.accountCount} accounts</div>
            <div style={{ marginTop: 25 }}>
              <Row><span>Stabilized this week</span><span style={{ ...MONO_NUM, fontSize: 12, color: GREEN }}>{formatCurrency(m.exposure.stabilizedThisWeek)}</span></Row>
              <Row><span>Pipeline ARR</span><span style={{ ...MONO_NUM, fontSize: 12 }}>{formatCurrency(m.arr)}</span></Row>
              <Row><span>AI confidence</span><span style={{ ...MONO_NUM, fontSize: 12, color: ACCENT }}>{m.exposure.aiConfidence}% <span style={{ color: FAINT }}>· updated {m.exposure.updated}</span></span></Row>
            </div>
          </div>
        ) : (
        <div>
          <div style={{ ...MONO, fontSize: 10, color: FAINT }}>ARR under management</div>
          <div style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 'clamp(38px,4.2vw,58px)', letterSpacing: '-.05em', lineHeight: 1, marginTop: 14, color: RED }}>{formatCurrency(m.arr)}</div>
          <div style={{ fontSize: 13.5, color: MUTED, marginTop: 10 }}>across {m.accountCount} accounts</div>
          <div style={{ display: 'flex', gap: 3, height: 3, marginTop: 22 }}>
            {m.split.map(x => <span key={x.k} style={{ flex: x.value / splitTotal, background: x.color }} />)}
          </div>
          <div>
            {m.split.map(x => (
              <Row key={x.k}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: x.color }} />{x.k}</span>
                <span style={{ ...MONO_NUM, fontSize: 12, color: x.color }}>{x.value > 0 ? formatCurrency(x.value) : '--'} · {x.accts} accts</span>
              </Row>
            ))}
          </div>
        </div>
        )}

        {/* Time to action */}
        <div>
          <div style={{ ...MONO, fontSize: 10, color: FAINT }}>Time to action</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginTop: 14 }}>
            <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 'clamp(38px,4.2vw,58px)', letterSpacing: '-.05em', lineHeight: 1, color: INK }}>{m.timeToAction ? m.timeToAction.toFixed(1) : '--'}</span>
            <span style={{ fontFamily: OUTFIT, fontSize: 22, color: MUTED }}>h</span>
          </div>
          <div style={{ fontSize: 13.5, color: MUTED, marginTop: 10 }}>
            {m.timeToActionDelta
              ? <><span style={{ color: m.timeToActionDelta < 0 ? GREEN : RED, fontWeight: 600 }}>{m.timeToActionDelta < 0 ? '▼' : '▲'} {fmtH(Math.abs(m.timeToActionDelta))}</span> vs last month</>
              : 'median time from signal to first action'}
          </div>
          <div style={{ marginTop: 25 }}>
            {m.reps.map(r => (
              <Row key={r.name}>
                <span>{r.name}</span>
                <span style={{ ...MONO_NUM, fontSize: 12, color: respColor(r.avgResp) }}>{r.avgResp ? fmtH(r.avgResp) : '--'}</span>
              </Row>
            ))}
          </div>
        </div>

        {/* Coverage */}
        <div>
          <div style={{ ...MONO, fontSize: 10, color: FAINT }}>Signal coverage</div>
          <div style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 'clamp(38px,4.2vw,58px)', letterSpacing: '-.05em', lineHeight: 1, marginTop: 14, color: GREEN }}>{m.coveragePct}%</div>
          <div style={{ fontSize: 13.5, color: MUTED, marginTop: 10 }}>{m.covered} of {m.accountCount} accounts covered</div>
          <div style={{ marginTop: 25 }}>
            <Row><span>Signals this week</span><span style={{ ...MONO_NUM, fontSize: 12 }}>{m.signalsThisWeek}</span></Row>
            <Row><span>Actioned</span><span style={{ ...MONO_NUM, fontSize: 12, color: GREEN }}>{m.actioned} / {m.signalsThisWeek}</span></Row>
            <Row><span>Auto-deployed without edit</span><span style={{ ...MONO_NUM, fontSize: 12 }}>{m.autoDeployedPct ? `${m.autoDeployedPct}%` : '--'}</span></Row>
          </div>
        </div>
      </div>

      {/* leaderboard */}
      <H2 title="Popsicle Saves leaderboard" right={
        <span style={{ ...MONO, fontSize: 10, color: FAINT, textTransform: 'none', letterSpacing: '.3px' }}>
          Q4 2026 · team total {formatCurrency(m.protectedTotal)}{m.protectedDeltaPct ? <> · <span style={{ color: GREEN }}>▲</span> +{m.protectedDeltaPct}% vs Q3</> : null}
        </span>
      } />
      {(() => {
        const cols = '28px minmax(180px,1.7fr) .6fr .6fr .8fr .7fr .7fr .7fr 1.2fr'
        const num = { ...MONO_NUM, fontSize: 13 }
        const badgeColor = { accent: ACCENT, blue: 'var(--blue, #2f6f9f)', warn: AMBER } as const
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 14, padding: '16px 0 10px', ...MONO, fontSize: 10, color: FAINT }}>
              <span>#</span><span>Rep</span><span>Signals</span><span>Recovered</span><span>Protected</span><span>Avg response</span><span>Follow-thru</span><span>Churn Δ</span><span>Performance</span>
            </div>
            {m.reps.map((r, i) => (
              <div key={r.name} className="tbl-row" style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 14, alignItems: 'center', padding: '20px 0', borderTop: `1px solid ${HAIR}`, fontSize: 14 }}>
                <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 18, color: i === 0 ? ACCENT : INK }}>{i + 1}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <Avatar rep={r} size={36} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: INK }}>{r.name}</span>
                      {r.badge && <span style={{ ...MONO, fontSize: 10, fontWeight: 600, color: badgeColor[r.badgeTone ?? 'accent'] }}>{r.badge}</span>}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: FAINT, marginTop: 2 }}>{r.title} · {r.accounts.length} accounts</span>
                  </span>
                </span>
                <span style={num}>{r.signals}</span>
                <span style={{ ...num, color: GREEN }}>{r.saved}</span>
                <span style={{ ...num, color: GREEN }}>{r.protectedValue > 0 ? formatCurrency(r.protectedValue) : '--'}</span>
                <span style={num}>{r.avgResp ? fmtH(r.avgResp) : '--'}</span>
                <span style={{ ...num, color: r.saveRate >= 70 ? GREEN : AMBER }}>{r.saveRate}%</span>
                <span style={{ ...num, color: r.churnDelta < 0 ? GREEN : r.churnDelta > 0 ? RED : INK }}>{r.churnDelta ? `${r.churnDelta}%` : '--'}</span>
                <span style={{ height: 3, background: HAIR, position: 'relative' }}>
                  <span style={{ position: 'absolute', inset: 0, width: `${r.performance}%`, background: 'linear-gradient(90deg, var(--accent-light, #FF8A50), var(--accent, #E85A25))' }} />
                </span>
              </div>
            ))}
          </>
        )
      })()}

      {/* individual breakdown */}
      <H2 title="Individual breakdown" right={<span style={{ ...MONO, fontSize: 10, color: FAINT, textTransform: 'none', letterSpacing: '.3px' }}>response time · last 7 days</span>} />
      <div className="g3" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, m.reps.length))}, minmax(0,1fr))`, gap: 48, marginTop: 30 }}>
        {m.reps.map(r => {
          const t = trendMeta[r.trend]
          return (
            <div key={r.name}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar rep={r} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: FAINT, marginTop: 2 }}>{r.title} · {r.accounts.length} accounts</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 24, letterSpacing: '-.04em', color: GREEN, lineHeight: 1 }}>{r.protectedValue > 0 ? formatCurrency(r.protectedValue) : '--'}</div>
                  <div style={{ fontSize: 11.5, color: FAINT, marginTop: 4 }}>protected</div>
                </div>
              </div>

              <div style={{ ...MONO, fontSize: 10, color: FAINT, marginTop: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span>Response time</span>
                <span style={{ color: t.c, textTransform: 'none', letterSpacing: '.2px', fontSize: 11 }}>{t.t}</span>
              </div>
              <div style={{ marginTop: 16 }}><Spark pts={r.spark} color={t.c} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', ...MONO, fontSize: 10, color: FAINT, marginTop: 8, padding: '0 1px' }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
              </div>

              <div style={{ ...MONO, fontSize: 10, color: FAINT, marginTop: 26, marginBottom: 12 }}>Activity · by time of day</div>
              <Heat grid={r.activity} />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22 }}>
                {r.accounts.map(a => (
                  <span key={a} onClick={() => router.push(`/accounts/${encodeURIComponent(a)}`)}
                    style={{ fontSize: 12.5, color: MUTED, background: 'var(--inset, #F4F0E8)', borderRadius: 'var(--toggle-radius, 0px)', padding: '6px 13px', cursor: 'pointer' }}>{a}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* exposure by rep: what each rep is carrying, not how they performed */}
      {m.reps.some(r => r.exposure != null) && (
        <>
          <H2 title="Exposure by rep" right={<span style={{ ...MONO, fontSize: 10, color: FAINT, textTransform: 'none', letterSpacing: '.3px' }}>what each rep is carrying right now</span>} />
          {(() => {
            const cols = 'minmax(180px,1.5fr) .7fr .8fr .8fr .8fr .9fr'
            const num = { ...MONO_NUM, fontSize: 13 }
            const maxExp = Math.max(1, ...m.reps.map(r => r.exposure ?? 0))
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 14, padding: '16px 0 10px', ...MONO, fontSize: 10, color: FAINT }}>
                  <span>Rep</span><span>Accounts</span><span>Pipeline ARR</span><span>Critical</span><span>Coverage</span><span style={{ textAlign: 'right' }}>Exposure</span>
                </div>
                {[...m.reps].sort((a, b) => (b.exposure ?? 0) - (a.exposure ?? 0)).map(r => {
                  const crit = m.queue.filter(q => q.rep === r.name && q.sev === 'critical').length
                  const share = Math.round(((r.exposure ?? 0) / Math.max(1, r.arr)) * 100)
                  return (
                    <div key={r.name} className="tbl-row" onClick={() => setQueueRep(r.name)} style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 14, alignItems: 'center', padding: '16px 0', borderTop: `1px solid ${HAIR}`, fontSize: 14, cursor: 'pointer' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Avatar rep={r} size={30} /><span><span style={{ fontWeight: 600, color: INK }}>{r.name}</span><span style={{ display: 'block', fontSize: 12, color: FAINT, marginTop: 2 }}>{r.accounts.join(' · ')}</span></span></span>
                      <span style={num}>{r.accounts.length}</span>
                      <span style={num}>{formatCurrency(r.arr)}</span>
                      <span style={{ ...num, color: crit ? RED : FAINT }}>{crit || '--'}</span>
                      <span style={{ ...num, color: r.ownership === 'active' ? GREEN : AMBER }}>{r.ownership === 'active' ? 'Active' : (r.ownershipNote ?? 'Stale')}</span>
                      <span style={{ textAlign: 'right' }}>
                        <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 17, letterSpacing: '-.03em', color: share >= 40 ? RED : share >= 25 ? AMBER : INK }}><X m="rep_exposure" account={r.name}>{formatCurrency(r.exposure ?? 0)}</X></span>
                        <span style={{ display: 'block', height: 3, background: HAIR, marginTop: 8, position: 'relative' }}><span style={{ position: 'absolute', inset: 0, width: `${((r.exposure ?? 0) / maxExp) * 100}%`, background: share >= 40 ? RED : share >= 25 ? AMBER : ACCENT }} /></span>
                        <span style={{ display: 'block', ...MONO_NUM, fontSize: 11, color: FAINT, marginTop: 6 }}>{share}% of their ARR</span>
                      </span>
                    </div>
                  )
                })}
              </>
            )
          })()}
        </>
      )}

      {/* revenue actions feed (mobile) */}
      {m.actionsFeed && m.actionsFeed.length > 0 && (() => {
        const feed = m.actionsFeed.filter(a => feedFilter === 'All' ? true : feedFilter === 'My accounts' ? a.rep === me : a.from >= 60)
        return (
          <>
            <H2 title="Revenue actions feed" right={<span style={{ ...MONO, fontSize: 10, color: FAINT, textTransform: 'none', letterSpacing: '.3px' }}>{m.actionsTaken} actions taken · last 7 days</span>} />
            <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: 'var(--inset, #F4F0E8)', borderRadius: 'var(--toggle-radius, 0px)', margin: '18px 0 4px' }}>
              {ACTION_FILTERS.map(k => (
                <button key={k} onClick={() => setFeedFilter(k)}
                  style={{ font: 'inherit', fontSize: 12.5, fontWeight: feedFilter === k ? 600 : 500, padding: '6px 13px', borderRadius: 'var(--toggle-radius, 0px)', border: 0, cursor: 'pointer', background: feedFilter === k ? INK : 'transparent', color: feedFilter === k ? '#fff' : MUTED }}>{k}</button>
              ))}
            </div>
            {feed.length === 0 && <EmptyState line="No actions in this view." hint="Switch the filter, or wait for the next handled signal to appear here." compact />}
            {feed.map((a, i) => {
              const rep = repBy(a.rep)
              return (
                <div key={i} className="tbl-row askable" onClick={() => router.push(`/accounts/${encodeURIComponent(a.account)}`)}
                  style={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr) auto', gap: 16, alignItems: 'start', padding: '16px 0', borderBottom: `1px solid ${HAIR}`, cursor: 'pointer' }}>
                  <AskThis q={`Did ${a.rep}'s action on ${a.account} work? What should happen next?`} account={a.account} />
                  <Avatar rep={rep} size={32} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: INK }}>{a.rep}</span>
                      <span style={{ fontSize: 13, color: FAINT }}>· {a.account}</span>
                    </div>
                    <div style={{ fontSize: 14.5, color: INK, marginTop: 4 }}>{a.action}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, ...MONO_NUM, fontSize: 12 }}>
                      <span style={{ color: FAINT }}>{a.driver}</span>
                      <span style={{ color: GREEN }}>{a.from}% → {a.to}%</span>
                      <span style={{ color: GREEN, fontWeight: 600 }}>+{formatCurrency(a.recovered)}</span>
                    </div>
                  </div>
                  <span style={{ ...MONO_NUM, fontSize: 11, color: FAINT, whiteSpace: 'nowrap' }}>{a.when}</span>
                </div>
              )
            })}
          </>
        )
      })()}

      {/* unactioned queue */}
      <H2 title="Unactioned signal queue"  right={
        <span style={{ ...MONO, fontSize: 11, color: FAINT, textTransform: 'none', letterSpacing: '.3px' }}>
          <span style={{ color: RED }}>{m.queue.length} unactioned</span> · of {m.signalsThisWeek} this week · {m.unresolvedPct}% unresolved
        </span>
      } />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, margin: '18px 0 4px', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: 'var(--inset, #F4F0E8)', borderRadius: 'var(--toggle-radius, 0px)' }}>
          {['All', ...m.reps.map(r => r.name)].map(k => {
            const on = queueRep === k
            const n = k === 'All' ? m.queue.length : m.queue.filter(q => q.rep === k).length
            return (
              <button key={k} onClick={() => setQueueRep(k)}
                style={{ font: 'inherit', fontSize: 12.5, fontWeight: on ? 600 : 500, padding: '6px 13px', borderRadius: 'var(--toggle-radius, 0px)', border: 0, cursor: 'pointer',
                  background: on ? INK : 'transparent', color: on ? '#fff' : MUTED, fontFamily: on ? undefined : "'DM Mono',monospace" }}>
                {k === 'All' ? `All · ${n}` : `${initials(k)} · ${n}`}
              </button>
            )
          })}
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: RED }}>{formatCurrency(m.waitingValue)} ARR waiting</span>
      </div>
      {queue.length === 0 && <EmptyState line={queueRep === 'All' ? 'Nothing is waiting.' : `Nothing is waiting on ${queueRep}.`} hint={queueRep === 'All' ? 'Every signal raised has been actioned. The queue refills as new ones land.' : 'Switch the filter to see the rest of the queue.'} compact />}
      {queue.map((q, i) => {
        const s = sevMeta[q.sev]
        const rep = repBy(q.rep)
        return (
          <div key={i} onClick={() => openQueueItem(q)} className="tbl-row"
            style={{ display: 'grid', gridTemplateColumns: '3px minmax(0,1fr) auto 32px', gap: 16, alignItems: 'center', padding: '16px 0', borderBottom: `1px solid ${HAIR}`, cursor: 'pointer' }}>
            <span style={{ width: 3, height: 34, background: s.c }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: INK }}>{q.account}</span>
                <span style={{ ...MONO, fontSize: 10, color: s.c }}>{s.t}</span>
              </div>
              <div style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>{q.summary}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...MONO_NUM, fontSize: 13, color: q.sev === 'medium' ? MUTED : s.c }}>{mounted ? q.age : ''}</div>
              <div style={{ fontSize: 11, color: FAINT, marginTop: 2 }}>unactioned</div>
            </div>
            <Avatar rep={rep} size={32} />
          </div>
        )
      })}
      <div onClick={() => router.push(`/ask?q=${encodeURIComponent('Which unactioned signals should the team prioritise?')}`)}
        style={{ fontSize: 14, fontWeight: 600, color: ACCENT, marginTop: 22, cursor: 'pointer', display: 'inline-block' }}>Ask Popsicle to prioritise →</div>

      <div style={{ height: 0, borderTop: `1px solid ${RULE}`, margin: 'var(--gap-l) 0 30px' }} />

      {/* execution summary */}
      <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 88 }}>
        <div>
          <div style={{ ...MONO, fontSize: 10, color: FAINT, marginBottom: 6 }}>Revenue movement · this week</div>
          <Row pad="14px 0"><span>New critical accounts</span><span style={{ ...MONO_NUM, fontSize: 12, color: m.newCritical ? RED : INK }}>+{m.newCritical}</span></Row>
          <Row pad="14px 0"><span>Accounts stabilized</span><span style={{ ...MONO_NUM, fontSize: 12, color: GREEN }}>+{m.stabilized}</span></Row>
          <Row pad="14px 0"><span>Actions taken</span><span style={{ ...MONO_NUM, fontSize: 12 }}>{m.actionsTaken}</span></Row>
          <Row pad="14px 0"><span>Signals per day</span><span style={{ ...MONO_NUM, fontSize: 12 }}>{m.signalsPerDay}{m.signalsPerDayDelta ? <span style={{ color: GREEN }}> ▲ {m.signalsPerDayDelta}</span> : null}</span></Row>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <span style={{ ...MONO, fontSize: 10, color: FAINT }}>Coverage & ownership</span>
            <span style={{ ...MONO, fontSize: 10, color: RED, textTransform: 'none', letterSpacing: '.3px' }}>{m.unowned && m.unowned.count > 0 ? `${m.unowned.count} unowned` : `all ${m.accountCount} accounts owned`}</span>
          </div>
          <div style={{ fontSize: 13.5, color: MUTED, margin: '12px 0 6px' }}>Critical coverage <strong style={{ color: INK, fontWeight: 600 }}>{m.criticalOwned} owned</strong> · {m.activeFollowUp} with active follow-up</div>
          {m.unowned && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 10px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: RED, background: 'rgba(196,61,43,.08)', borderRadius: 'var(--toggle-radius, 0px)', padding: '5px 11px' }}>Unowned risk: {formatCurrency(m.unowned.risk)}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: AMBER, background: 'rgba(211,139,29,.1)', borderRadius: 'var(--toggle-radius, 0px)', padding: '5px 11px' }}>Stale: {m.unowned.stale} accounts</span>
            </div>
          )}
          {m.reps.map(r => (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: `1px solid ${HAIR}` }}>
              <Avatar rep={r} size={26} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ fontWeight: 600 }}>{r.name}</span> <span style={{ color: MUTED }}>{r.accounts.length} accounts · {r.exposure != null ? `${formatCurrency(r.exposure)} exposure` : formatCurrency(r.arr)}</span>
              </span>
              <span style={{ ...MONO, fontSize: 10, color: r.ownership === 'active' ? GREEN : AMBER, whiteSpace: 'nowrap' }}>{r.ownership === 'active' ? 'Active' : (r.ownershipNote ?? 'Stale')}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ ...MONO, fontSize: 10, color: FAINT }}>Execution quality</div>
          <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16, marginTop: 14 }}>
            {[
              { v: m.timeToAction ? fmtH(m.timeToAction) : '--', k: 'time to action', c: INK },
              { v: `${m.followThrough}%`, k: 'follow-through', c: m.followThrough >= 70 ? GREEN : AMBER },
              { v: `${m.loopClosure}%`, k: 'loop closure', c: m.loopClosure >= 70 ? GREEN : AMBER },
            ].map(x => (
              <div key={x.k}>
                <div style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 27, letterSpacing: '-.04em', color: x.c, lineHeight: 1 }}>{x.v}</div>
                <div style={{ fontSize: 11.5, color: FAINT, marginTop: 6 }}>{x.k}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 52px 48px 60px', gap: 10, ...MONO, fontSize: 10, color: FAINT, marginTop: 26, paddingBottom: 8 }}>
            <span>Rep</span><span style={{ textAlign: 'right' }}>T2A</span><span style={{ textAlign: 'right' }}>F/T</span><span style={{ textAlign: 'right' }}>Closure</span>
          </div>
          {[...m.reps].sort((a, b) => a.avgResp - b.avgResp).map(r => (
            <div key={r.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 52px 48px 60px', gap: 10, padding: '12px 0', borderTop: `1px solid ${HAIR}`, fontSize: 14 }}>
              <span style={{ color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              <span style={{ ...MONO_NUM, fontSize: 12, color: respColor(r.avgResp), textAlign: 'right' }}>{r.avgResp ? fmtH(r.avgResp) : '--'}</span>
              <span style={{ ...MONO_NUM, fontSize: 12, color: r.followThrough >= 70 ? GREEN : AMBER, textAlign: 'right' }}>{r.followThrough}%</span>
              <span style={{ ...MONO_NUM, fontSize: 12, color: r.closure >= 70 ? GREEN : AMBER, textAlign: 'right' }}>{r.closure}%</span>
            </div>
          ))}
          {m.executionInsight && <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.55, marginTop: 18, padding: '14px 16px', background: 'var(--inset, #F4F0E8)', borderRadius: 12 }}>{m.executionInsight}</div>}
        </div>
      </div>
    </div>
  )
}
