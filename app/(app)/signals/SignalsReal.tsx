'use client'

interface DBSignal {
  id: string
  account_name?: string
  signal_type?: string
  severity?: string
  title?: string
  description?: string
  ai_analysis?: { summary?: string; recommendation?: string } | null
  risk_amount?: number
  impact_pct?: string | number
  source_integration?: string
  created_at?: string
}

const TYPE_LABELS: Record<string, string> = {
  silent_stall: 'Silent Stall', competitor_mention: 'Competitor Mention', legal_loopin: 'Legal Loop-in',
  price_flinch: 'Price Flinch', champion_change: 'Champion Change', timeline_slip: 'Timeline Slip',
  reengaged: 'Re-engaged',
}

function fmtMoney(v?: number) {
  if (!v) return null
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${Math.round(v / 1000)}K`
  return `$${v}`
}

function timeAgo(iso?: string) {
  if (!iso) return ''
  const d = (Date.now() - new Date(iso).getTime()) / 86400000
  if (d < 1) return 'today'
  if (d < 2) return 'yesterday'
  return `${Math.floor(d)}d ago`
}

export function SignalsReal({ signals }: { signals: DBSignal[] }) {
  const high = signals.filter(s => s.severity === 'high')
  const watch = signals.filter(s => s.severity === 'watch')
  const positive = signals.filter(s => s.severity === 'positive')
  const totalRisk = high.concat(watch).reduce((sum, s) => sum + (s.risk_amount || 0), 0)

  function open360(s: DBSignal) {
    if (!s.account_name) return
    window.dispatchEvent(new CustomEvent('open-a360', { detail: {
      name: s.account_name, contact: '', stage: 'Active', arr: fmtMoney(s.risk_amount) || '--',
      health: 0, signals: 1, daysDark: 0, risk: (s.severity || 'watch').toUpperCase(),
      rep: 'You', lastTouch: s.title || 'Signal detected',
    } }))
  }

  if (signals.length === 0) {
    return (
      <div className="dsk-screen on">
        <div className="page-hdr">
          <h1>Live Signals</h1>
          <p>Signals from your connected channels will appear here.</p>
        </div>
        <div className="dcard" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 24px', textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t2)', margin: '12px 0 6px' }}>No signals yet</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.65, maxWidth: 320 }}>Connect Gmail, Slack, or Zoom on the Integrations page and Popsicle will surface revenue signals here automatically as your conversations come in.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="dsk-screen on">
      <div className="page-hdr">
        <h1>Live Signals</h1>
        <p>{signals.length} active signal{signals.length === 1 ? '' : 's'}{totalRisk > 0 ? <> · <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmtMoney(totalRisk)} at risk</span></> : null}</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
        <div className="dcard" style={{ padding: '14px 18px', borderLeft: '3px solid var(--danger)' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--danger)' }}>{high.length}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>High Risk</div>
        </div>
        <div className="dcard" style={{ padding: '14px 18px', borderLeft: '3px solid var(--amber)' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--amber)' }}>{watch.length}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>Watch</div>
        </div>
        <div className="dcard" style={{ padding: '14px 18px', borderLeft: '3px solid var(--ok)' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--ok)' }}>{positive.length}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>Positive</div>
        </div>
      </div>

      {/* Signal list - ordered high, watch, positive */}
      <div>
        {[...high, ...watch, ...positive].map(s => {
          const isHigh = s.severity === 'high', isPos = s.severity === 'positive'
          const borderColor = isHigh ? 'var(--danger)' : isPos ? 'var(--ok)' : 'var(--amber)'
          const riskCls = isHigh ? 'rhi' : isPos ? 'rlo' : 'rmd'
          const label = TYPE_LABELS[s.signal_type || ''] || 'Signal'
          const headline = s.title || (label + (s.account_name ? ` - ${s.account_name}` : ''))
          const body = s.description || s.ai_analysis?.summary || ''
          const money = fmtMoney(s.risk_amount)
          const impact = s.impact_pct ? (typeof s.impact_pct === 'number' ? `${s.impact_pct}%` : s.impact_pct) : null
          return (
            <div key={s.id} onClick={() => open360(s)} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border-soft)', borderLeft: `4px solid ${borderColor}`, borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 4px rgba(13,10,7,.06)', marginBottom: 7, cursor: s.account_name ? 'pointer' : 'default' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--t1)' }}>{headline}</span>
                  <span className={`rp ${riskCls}`} style={{ fontSize: 8 }}>{isHigh ? 'HIGH' : isPos ? 'POSITIVE' : 'WATCH'}</span>
                  {label !== 'Signal' && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>}
                </div>
                {body && <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>{body}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5 }}>
                  {s.account_name && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--t2)' }}>{s.account_name}</span>}
                  {money && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--danger)', fontFamily: "'DM Mono',monospace" }}>{money}{impact ? ` · ${impact}` : ''}</span>}
                  {s.created_at && <span style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'DM Mono',monospace" }}>{timeAgo(s.created_at)}</span>}
                </div>
              </div>
              {s.source_integration && <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--t2)', flexShrink: 0, textTransform: 'capitalize' }}>{s.source_integration}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
