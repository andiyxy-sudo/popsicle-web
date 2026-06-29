'use client'

interface Account {
  id: string; name: string; value?: number; stage?: string; risk_level?: string
  probability?: number; close_date?: string
}

function fmtVal(v?: number) {
  if (!v) return '--'
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${Math.round(v / 1000)}K`
  return `$${v}`
}

export function ForecastReal({ accounts }: { accounts: Account[] }) {
  const totalPipeline = accounts.reduce((s, a) => s + (a.value || 0), 0)
  const weighted = accounts.reduce((s, a) => s + (a.value || 0) * ((a.probability || 0) / 100), 0)

  if (accounts.length === 0) {
    return (
      <div className="dsk-screen on">
        <div className="page-hdr"><h1>Forecast</h1><p>Pipeline forecast will appear once you have active deals.</p></div>
        <div className="dcard" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 6 }}>No deals to forecast yet.</div>
          <div style={{ fontSize: 13, color: 'var(--t4)' }}>Add accounts with stages and probabilities to see your forecast.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="dsk-screen on">
      <div className="page-hdr"><h1>Forecast</h1><p>{accounts.length} active deal{accounts.length === 1 ? '' : 's'} in pipeline</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 24 }}>
        <div className="dcard" style={{ textAlign: 'center', padding: '18px 16px' }}><div className="dcard-title">Total Pipeline</div><div className="dcard-val" style={{ fontSize: 28 }}>{fmtVal(totalPipeline)}</div></div>
        <div className="dcard" style={{ textAlign: 'center', padding: '18px 16px' }}><div className="dcard-title">Weighted</div><div className="dcard-val" style={{ color: 'var(--ok)', fontSize: 28 }}>{fmtVal(Math.round(weighted))}</div></div>
        <div className="dcard" style={{ textAlign: 'center', padding: '18px 16px' }}><div className="dcard-title">Deals</div><div className="dcard-val" style={{ fontSize: 28 }}>{accounts.length}</div></div>
      </div>
      <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)' }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Deal Pipeline</span></div>
        <table className="dtable">
          <thead><tr><th>Account</th><th>ARR</th><th>Probability</th><th>Close Date</th><th>Stage</th></tr></thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id}>
                <td style={{ fontWeight: 700 }}>{a.name}</td>
                <td style={{ fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>{fmtVal(a.value)}</td>
                <td style={{ fontWeight: 800, color: (a.probability || 0) > 60 ? 'var(--ok)' : (a.probability || 0) > 35 ? 'var(--amber)' : 'var(--danger)' }}>{a.probability ?? 0}%</td>
                <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--t3)' }}>{a.close_date || '-'}</td>
                <td>{a.stage || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
