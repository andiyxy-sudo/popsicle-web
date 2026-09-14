'use client'

import { PageHead } from '@/components/layout/PageHead'
// Revenue Intelligence over REAL data, styled to match the showcase design
// language (gradient hero, SEC section headers, flush cards). Every number is
// computed from the user's own rows; sections render only when they have data.

interface Sig { created_at?: string; severity?: string; signal_type?: string; source_integration?: string; risk_amount?: number; is_dismissed?: boolean; status?: string | null }
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

  return (
    <div className="dsk-screen on">
      <PageHead
        eyebrow="Intelligence"
        crumb={`${live.length} signals · last 30 days`}
        title={openRisk > 0
          ? <><span style={{ color: 'var(--critical, #c43d2b)' }}>{fmtMoney(openRisk)}</span> is exposed across {openHigh.length} critical signal{openHigh.length === 1 ? '' : 's'}.{' '}<span style={{ color: 'var(--ink-muted)' }}>Here is what the last weeks of conversation add up to.</span></>
          : <>{msg30.length} conversations in the last 30 days.{' '}<span style={{ color: 'var(--ink-muted)' }}>Nothing is flagged critical right now.</span></>}
      />

      {/* naked stats over the rule */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        {[
          { n: openRisk > 0 ? fmtMoney(openRisk) : String(msg30.length), lbl: openRisk > 0 ? `at risk · ${openHigh.length} critical` : 'messages · 30 days', color: openRisk > 0 ? 'var(--critical, #c43d2b)' : 'var(--ink)', d: heroDelta },
          { n: String(sig30.length), lbl: 'signals raised · 30 days', color: 'var(--ink)', d: delta(sig30.length, sigPrev.length) },
          { n: String(activeAccounts), lbl: 'accounts active · 14 days', color: 'var(--ink)', d: null },
          { n: ourAvg != null ? `${Math.round(ourAvg)}h` : '--', lbl: 'our median reply', color: 'var(--accent)', d: null },
        ].map((st, i, arr) => (
          <div key={i} style={{ paddingRight: 24, paddingLeft: i === 0 ? 0 : 24, borderRight: i < arr.length - 1 ? '1px solid var(--hairline, #EFEAE1)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.045em', fontSize: 40, lineHeight: 1, color: st.color, fontVariantNumeric: 'tabular-nums' }}>{st.n}</span>
              {st.d && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{st.d}</span>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 8 }}>{st.lbl}</div>
          </div>
        ))}
      </div>

      {/* conversation volume - flowing line + area (prototype style) */}
      {hasVolume && (
        <section style={{ marginTop: 64 }}>
          {SEC('Conversation volume', <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{WEEKS} weeks · inbound + outbound</span>)}
          {(() => {
            const W = 900, H = 190, PAD = 6
            const maxV = Math.max(1, ...weeks.map(w => w.in + w.out))
            const xs = weeks.map((_, i) => (i / Math.max(1, WEEKS - 1)) * W)
            const ysTotal = weeks.map(w => H - PAD - ((w.in + w.out) / maxV) * (H - PAD * 2))
            const ysIn = weeks.map(w => H - PAD - (w.in / maxV) * (H - PAD * 2))
            // Catmull-Rom -> cubic bezier for the flowing curve the prototype uses
            const curve = (ys: number[]) => {
              let d = `M${xs[0]},${ys[0]}`
              for (let i = 0; i < xs.length - 1; i++) {
                const x0 = xs[Math.max(0, i - 1)], y0 = ys[Math.max(0, i - 1)]
                const x1 = xs[i], y1 = ys[i]
                const x2 = xs[i + 1], y2 = ys[i + 1]
                const x3 = xs[Math.min(xs.length - 1, i + 2)], y3 = ys[Math.min(ys.length - 1, i + 2)]
                d += ` C${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ${x2},${y2}`
              }
              return d
            }
            const lineTotal = curve(ysTotal)
            const lineIn = curve(ysIn)
            const area = `${lineTotal} L${W},${H} L0,${H} Z`
            return (
              <div style={{ marginTop: 26 }}>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={190} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent, #E85A25)" stopOpacity=".16" />
                      <stop offset="100%" stopColor="var(--accent, #E85A25)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[0.25, 0.5, 0.75].map(f => (
                    <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--hairline, #EFEAE1)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  ))}
                  <path d={area} fill="url(#volFill)" />
                  <path d={lineTotal} fill="none" stroke="var(--accent, #E85A25)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={lineIn} fill="none" stroke="var(--ink, #0E0D0B)" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" opacity=".45" strokeLinecap="round" />
                  {xs.map((x, i) => (
                    <circle key={i} cx={x} cy={ysTotal[i]} r={i === xs.length - 1 ? 5 : 3}
                      fill={i === xs.length - 1 ? 'var(--accent, #E85A25)' : 'var(--paper, #FBF8F3)'}
                      stroke="var(--accent, #E85A25)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  ))}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  {weeks.map((w, i) => (
                    <span key={i} style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, color: i === weeks.length - 1 ? 'var(--accent)' : 'var(--ink-faint)' }}>{w.label}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 22, marginTop: 16, fontSize: 12.5, color: 'var(--ink-muted)' }}>
                  <span><span style={{ display: 'inline-block', width: 16, height: 2, background: 'var(--accent)', verticalAlign: 'middle', marginRight: 8 }} />total messages</span>
                  <span><span style={{ display: 'inline-block', width: 16, height: 2, background: 'var(--ink)', opacity: .45, verticalAlign: 'middle', marginRight: 8 }} />inbound only</span>
                  <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>peak {maxV}/week</span>
                </div>
              </div>
            )
          })()}
        </section>
      )}

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
