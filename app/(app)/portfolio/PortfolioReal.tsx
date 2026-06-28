'use client'

import { buildA360 } from '@/lib/demo-accounts'

interface Account {
  id: string; name: string; domain?: string; health_score: number; value?: number
  stage?: string; owner?: string; risk_level?: string; probability?: number
  close_date?: string; last_contact_date?: string; tags?: string[]
}

function fmtVal(v?: number) {
  if (!v) return '$0'
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${Math.round(v / 1000)}K`
  return `$${v}`
}
function riskClass(r?: string) {
  const x = (r || '').toLowerCase()
  if (x === 'high') return 'rhi'
  if (x === 'medium' || x === 'med') return 'rmd'
  return 'rlo'
}

export function PortfolioReal({ accounts }: { accounts: Account[] }) {
  function openA360(a: Account) {
    window.dispatchEvent(new CustomEvent('open-a360', { detail: {
      id: a.id, name: a.name, contact: a.domain || '', stage: a.stage || 'Active',
      arr: fmtVal(a.value), health: a.health_score ?? 0, signals: 0, daysDark: 0,
      risk: (a.risk_level || 'low').toUpperCase(), rep: a.owner || 'You',
      lastTouch: a.last_contact_date ? `Last contact: ${a.last_contact_date}` : 'No recent contact',
    } }))
  }

  if (accounts.length === 0) {
    return (
      <div className="dsk-screen on">
        <div className="page-hdr fade-in">
          <h1>Portfolio</h1>
          <p>Your accounts will appear here once connected.</p>
        </div>
        <div className="dcard fade-in" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 6 }}>No accounts yet.</div>
          <div style={{ fontSize: 13, color: 'var(--t4)' }}>Connect an integration to start tracking accounts and signals.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="dsk-screen on">
      <div className="page-hdr fade-in">
        <h1>Portfolio</h1>
        <p>{accounts.length} active account{accounts.length === 1 ? '' : 's'}</p>
      </div>
      <div className="dcard fade-in" style={{ padding: 0, overflow: 'hidden', maxHeight: 'none' }}>
        <table className="dtable">
          <thead><tr><th style={{ width: 50 }}>Health</th><th>Account</th><th>ARR</th><th>Risk</th><th>Stage</th><th>Owner</th></tr></thead>
          <tbody>
            {accounts.map(a => {
              const h = a.health_score ?? 0
              const hbg = h < 40 ? 'var(--danger-bg)' : h < 65 ? 'var(--amber-bg)' : 'var(--ok-bg)'
              const hc = h < 40 ? 'var(--danger)' : h < 65 ? 'var(--amber)' : 'var(--ok)'
              return (
                <tr key={a.id} className={h < 40 ? 'row-hi' : h < 65 ? 'row-md' : 'row-ok'} onClick={() => openA360(a)} style={{ cursor: 'pointer' }}>
                  <td><div className="port-health" style={{ background: hbg, color: hc }}>{h}</div></td>
                  <td><div style={{ fontWeight: 700 }}>{a.name}</div>{a.domain && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{a.domain}</div>}</td>
                  <td style={{ fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>{fmtVal(a.value)}</td>
                  <td><span className={`rp ${riskClass(a.risk_level)}`}>{(a.risk_level || 'low').toUpperCase()}</span></td>
                  <td style={{ fontSize: 13 }}>{a.stage || '-'}</td>
                  <td style={{ fontSize: 13 }}>{a.owner || 'You'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
