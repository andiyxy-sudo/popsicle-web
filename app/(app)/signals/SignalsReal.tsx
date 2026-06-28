'use client'

interface DBSignal {
  id: string; account_name?: string; signal_type?: string; severity?: string
  ai_analysis?: { summary?: string } | null; risk_amount?: number; impact_pct?: number
  source_integration?: string; created_at?: string
}

const TYPE_LABELS: Record<string, string> = {
  silent_stall: 'Silent Stall', competitor_mention: 'Competitor Mention', legal_loopin: 'Legal Loop-in',
  price_flinch: 'Price Flinch', champion_change: 'Champion Change', timeline_slip: 'Timeline Slip', reengaged: 'Re-engaged',
}

export function SignalsReal({ signals }: { signals: DBSignal[] }) {
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
          <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.65, maxWidth: 300 }}>Connect Gmail, Slack, or Zoom on the Integrations page and Popsicle will surface revenue signals here automatically.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="dsk-screen on">
      <div className="page-hdr">
        <h1>Live Signals</h1>
        <p>{signals.length} active signal{signals.length === 1 ? '' : 's'}</p>
      </div>
      <div>
        {signals.map(s => {
          const sev = s.severity === 'high' ? 'High Risk' : s.severity === 'positive' ? 'Positive' : 'Watch'
          const isHigh = sev === 'High Risk', isPos = sev === 'Positive'
          const rc = isHigh ? '220,38,38' : isPos ? '22,163,74' : '217,119,6'
          const borderColor = isHigh ? 'var(--danger)' : isPos ? 'var(--ok)' : 'var(--amber)'
          const riskCls = isHigh ? 'rhi' : isPos ? 'rlo' : 'rmd'
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border-soft)', borderLeft: `4px solid ${borderColor}`, borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 4px rgba(13,10,7,.06)', marginBottom: 7 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--t1)' }}>{TYPE_LABELS[s.signal_type || ''] || 'Signal'}{s.account_name ? ` - ${s.account_name}` : ''}</span>
                  <span className={`rp ${riskCls}`} style={{ fontSize: 8 }}>{isHigh ? 'HIGH' : isPos ? 'POSITIVE' : 'WATCH'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>{s.ai_analysis?.summary || 'Signal detected from connected channels.'}</div>
              </div>
              {s.source_integration && <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--t2)', flexShrink: 0 }}>{s.source_integration}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
