'use client'

// Revenue Intelligence over REAL data, styled to match the showcase design
// language (gradient hero, SEC section headers, flush cards). Every number is
// computed from the user's own rows; sections render only when they have data.

interface Sig { created_at?: string; severity?: string; signal_type?: string; source_integration?: string; risk_amount?: number; is_dismissed?: boolean; is_snoozed?: boolean }
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
  <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>{t}</span>
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
  const openHigh = live.filter(s => !s.is_snoozed && s.severity === 'high')
  const openRisk = live
    .filter(s => !s.is_snoozed && (s.severity === 'high' || s.severity === 'watch'))
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
        <div className="page-hdr"><h1>Revenue Intelligence</h1><p>Historical and predictive analysis across revenue signals</p></div>
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
  const heroBigLbl = openRisk > 0 ? `at risk across ${live.filter(s => !s.is_snoozed && s.severity !== 'positive').length} open signals` : 'messages in the last 30 days'
  const heroDelta = openRisk > 0 ? delta(sig30.length, sigPrev.length) : delta(msg30.length, msgPrev.length)

  return (
    <div className="dsk-screen on">
      <div className="page-hdr">
        <h1>Revenue Intelligence</h1>
        <p>Computed live from your synced communications and signals</p>
      </div>

      {/* Hero */}
      <div className="dcard" style={{ marginBottom: 20, padding: 0, overflow: 'hidden', background: 'linear-gradient(135deg,#FF5E22 0%,#FF7A30 45%,#F06A1A 80%,#E55F10 100%)', position: 'relative', border: '1px solid rgba(255,107,53,.3)', boxShadow: '0 4px 20px rgba(255,107,53,.32)' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle,rgba(255,255,255,.07) 1px,transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }}></div>
        <div style={{ position: 'absolute', top: -60, right: -40, width: 260, height: 260, background: 'radial-gradient(circle,rgba(255,220,140,.18) 0%,transparent 65%)', pointerEvents: 'none' }}></div>
        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 0 }}>
          <div style={{ padding: '24px 30px 20px', borderRight: '1px solid rgba(255,255,255,.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.95)', fontFamily: "'DM Mono',monospace" }}>Pipeline watched by Popsicle</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: '#fff', letterSpacing: '-2.5px', lineHeight: 1, textShadow: '0 0 28px rgba(255,255,255,.2)' }}>{heroBig}</div>
              {heroDelta && <span style={{ fontSize: 13, fontWeight: 700, color: '#FFE0B8' }}>{heroDelta}</span>}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 4 }}>{heroBigLbl}</div>
            {hasVolume && (
              <div style={{ marginTop: 18 }}>
                <svg width="100%" height="48" viewBox="0 0 400 48" preserveAspectRatio="none">
                  <defs><linearGradient id="ir-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFB088" stopOpacity=".25"/><stop offset="100%" stopColor="#FFB088" stopOpacity="0"/></linearGradient></defs>
                  <path d={sparkArea} fill="url(#ir-grad)"/>
                  <path d={sparkLine} fill="none" stroke="#FFB088" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'rgba(255,255,255,.55)', fontFamily: "'DM Mono',monospace", marginTop: 2 }}>
                  {weeks.map(w => <span key={w.label}>{w.label}</span>)}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>Weekly communication volume, 8 weeks</div>
              </div>
            )}
          </div>
          <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignContent: 'center' }}>
            {[
              [String(sig30.length), 'Signals · 30d'],
              [String(msg30.length), 'Messages · 30d'],
              [String(activeAccounts), 'Active accounts'],
              [String(openHigh.length), 'High risk open'],
            ].map((s, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>{s[0]}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>{s[1]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Volume chart */}
      {hasVolume && (
        <div className="dcard" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          {SEC('Communication Volume', (
            <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'var(--t3)', fontWeight: 600 }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--o)', marginRight: 5 }} />Inbound</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'rgba(255,107,53,.3)', marginRight: 5 }} />Outbound</span>
            </div>
          ))}
          <div style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120 }}>
              {weeks.map((w, i) => {
                const hIn = Math.round((w.in / maxWeek) * 100)
                const hOut = Math.round((w.out / maxWeek) * 100)
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%' }}>
                    <div style={{ flex: 1, width: '100%', maxWidth: 44, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} title={`${w.in + w.out} messages`}>
                      <div style={{ height: `${hOut}%`, background: 'rgba(255,107,53,.3)', borderRadius: '5px 5px 0 0' }} />
                      <div style={{ height: `${hIn}%`, background: 'var(--o)' }} />
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--t4)', fontFamily: "'DM Mono',monospace" }}>{w.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {/* Signal mix */}
        {live.length > 0 && (
          <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
            {SEC('Signal Mix')}
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
                {sevCounts.high > 0 && <div style={{ width: `${pct(sevCounts.high, live.length)}%`, background: 'var(--danger)' }} />}
                {sevCounts.watch > 0 && <div style={{ width: `${pct(sevCounts.watch, live.length)}%`, background: 'var(--amber)' }} />}
                {sevCounts.positive > 0 && <div style={{ width: `${pct(sevCounts.positive, live.length)}%`, background: 'var(--ok)' }} />}
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 10.5, fontWeight: 700, marginBottom: 16 }}>
                <span style={{ color: 'var(--danger)' }}>{sevCounts.high} high</span>
                <span style={{ color: 'var(--amber)' }}>{sevCounts.watch} watch</span>
                <span style={{ color: 'var(--ok)' }}>{sevCounts.positive} positive</span>
              </div>
              {topTypes.map(([type, n]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                  <div style={{ width: 130, fontSize: 11.5, fontWeight: 600, color: 'var(--t2)', flexShrink: 0 }}>{TYPE_LABELS[type] || type}</div>
                  <div style={{ flex: 1, height: 7, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct(n, topTypes[0][1])}%`, height: '100%', background: 'var(--o)', borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 20, textAlign: 'right', fontSize: 11, fontWeight: 800, color: 'var(--t1)', fontFamily: "'DM Mono',monospace" }}>{n}</div>
                </div>
              ))}
              {sources.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  {sources.map(([src, n]) => (
                    <span key={src} style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--t2)', background: 'var(--bg)', border: '1px solid var(--line)', padding: '4px 10px', borderRadius: 20, textTransform: 'capitalize' }}>
                      {src} · {n}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Account engagement */}
        {engaged.length > 0 && (
          <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
            {SEC('Account Engagement')}
            <div style={{ padding: '16px 20px' }}>
              {engaged.map(b => (
                <div key={b.account_name} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{b.account_name}</span>
                    <span style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'DM Mono',monospace" }}>{timeAgo(b.last_message_at)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 7, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct(b.total_messages || 0, maxEng)}%`, height: '100%', background: 'var(--o)', borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 10.5, color: 'var(--t3)', fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>
                      {b.total_messages} msgs{b.emails_per_week ? ` · ${b.emails_per_week}/wk` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reply habits */}
      {withPairs.length > 0 && (ourAvg != null || theirAvg != null) && (
        <div className="dcard" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          {SEC('Reply Habits', <span style={{ fontSize: 10, color: 'var(--t3)' }}>{withPairs.length} account{withPairs.length === 1 ? '' : 's'} with real back-and-forth</span>)}
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ textAlign: 'center', padding: '14px 0', background: 'var(--bg)', borderRadius: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--t1)' }}>{fmtHours(ourAvg)}</div>
              <div style={{ fontSize: 10.5, color: 'var(--t3)', fontWeight: 600 }}>You reply in</div>
            </div>
            <div style={{ textAlign: 'center', padding: '14px 0', background: 'var(--bg)', borderRadius: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--t1)' }}>{fmtHours(theirAvg)}</div>
              <div style={{ fontSize: 10.5, color: 'var(--t3)', fontWeight: 600 }}>They reply in</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
