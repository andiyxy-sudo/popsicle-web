'use client'

import { useState } from 'react'
import { buildA360 } from '@/lib/demo-accounts'

// Portfolio rows - pixel-faithful to popsicle-desktop-v15b prototype (all 9 accounts).
type PortRow = {
  id: string; health: number; hbg: string; hc: string; round?: boolean
  name: string; contact: string; arr: string; risk: string; rcls: string; rstyle?: React.CSSProperties
  stage: string; rep: string; topSig: string; topSigC: string
  tags: [string, string][]; last: string; delta: string; dc: string
  filters: string[] // which filter buckets this row belongs to
}

const PORT_ROWS: PortRow[] = [
  { id: 'acme', health: 31, hbg: 'var(--danger-bg)', hc: 'var(--danger)', name: 'Acme Corp', contact: 'Sarah Chen · CFO', arr: '$480K', risk: 'HIGH', rcls: 'rhi', stage: 'Negotiation', rep: 'Andy G', topSig: 'Exec dark 8d', topSigC: 'var(--danger)', tags: [['Exec Dark', 'red'], ['Competitor', 'amber']], last: '2d', delta: '-14%', dc: 'var(--danger)', filters: ['high', 'stalled'] },
  { id: 'meridian', health: 28, hbg: 'var(--danger-bg)', hc: 'var(--danger)', name: 'Meridian Labs', contact: 'Alex Park · CEO', arr: '$850K', risk: 'HIGH', rcls: 'rhi', stage: 'Renewal', rep: 'Andy G', topSig: 'Q2 slip risk', topSigC: 'var(--danger)', tags: [['Silent Stall', 'red'], ['Churn', 'red']], last: '5d', delta: '-11%', dc: 'var(--danger)', filters: ['high', 'stalled'] },
  { id: 'axion', health: 52, hbg: 'var(--amber-bg)', hc: 'var(--amber)', name: 'Axion Partners', contact: 'Marcus Webb · VP', arr: '$95K', risk: 'MED', rcls: 'rmd', stage: 'Legal', rep: 'Andy G', topSig: 'Contract day 3', topSigC: 'var(--amber)', tags: [['Legal Hold', 'amber']], last: '1d', delta: '-4%', dc: 'var(--amber)', filters: ['stalled'] },
  { id: 'techvault', health: 48, hbg: 'rgba(232,133,10,.08)', hc: 'var(--amber)', name: 'TechVault Inc', contact: 'Jamie Torres · VP Eng', arr: '$210K', risk: 'MED', rcls: 'rmd', stage: 'Discovery', rep: 'Mike Ross', topSig: 'Price flinch', topSigC: 'var(--amber)', tags: [['Price Flinch', 'amber'], ['Multi-thread', 'blue']], last: '3d', delta: '-3%', dc: 'var(--amber)', filters: ['stalled'] },
  { id: 'techflow', health: 55, hbg: 'var(--amber-bg)', hc: 'var(--amber)', name: 'TechFlow Inc', contact: 'Lena Ford · COO', arr: '$210K', risk: 'MED', rcls: 'rmd', stage: 'Discovery', rep: 'Andy G', topSig: 'Budget stall', topSigC: 'var(--amber)', tags: [['Budget Stall', 'amber']], last: '3d', delta: '-6%', dc: 'var(--amber)', filters: ['stalled'] },
  { id: 'nexus', health: 88, hbg: 'var(--ok-bg)', hc: 'var(--ok)', name: 'Nexus AI', contact: 'Priya Sharma · CTO', arr: '$320K', risk: 'LOW', rcls: 'rlo', rstyle: { opacity: .75 }, stage: 'Closing', rep: 'Andy G', topSig: 'PO this week', topSigC: 'var(--ok)', tags: [['Buyer Active', 'green'], ['Legal Clear', 'green']], last: 'Today', delta: '+12%', dc: 'var(--ok)', filters: ['closing'] },
  { id: 'cobalt', health: 82, hbg: 'rgba(42,157,92,.08)', hc: 'var(--ok)', name: 'Cobalt Systems', contact: 'Dana Kim · CRO', arr: '$150K', risk: 'LOW', rcls: 'rlo', rstyle: { opacity: .75 }, stage: 'Closed Won', rep: 'Jamie T', topSig: 'Closed-won', topSigC: 'var(--ok)', tags: [['Closed', 'green']], last: 'Today', delta: '+18%', dc: 'var(--ok)', filters: ['closing'] },
  { id: 'vertex', health: 65, hbg: 'rgba(59,111,222,.08)', hc: 'var(--blue)', name: 'Vertex Systems', contact: 'Dana Kim · CRO', arr: '$140K', risk: 'MONITOR', rcls: '', rstyle: { background: 'rgba(59,111,222,.08)', color: 'var(--blue)', border: '1px solid rgba(59,111,222,.15)' }, stage: 'Proposal', rep: 'Mike Ross', topSig: 'Under review', topSigC: 'var(--blue)', tags: [['Proposal Sent', 'blue']], last: '2d', delta: '-5%', dc: 'var(--blue)', filters: [] },
  { id: 'brightwave', health: 76, hbg: 'rgba(34,197,94,.12)', hc: 'var(--ok)', round: true, name: 'Brightwave', contact: 'Chris Lee · RevOps', arr: '$180K', risk: 'LOW', rcls: 'rlo', rstyle: { opacity: .75 }, stage: 'Pilot', rep: 'Andy G', topSig: 'Re-engaged', topSigC: 'var(--ok)', tags: [['Re-engaged', 'green']], last: 'Today', delta: '+8%', dc: 'var(--ok)', filters: ['closing'] },
]

const FILTERS: [string, string][] = [['all', 'All'], ['high', 'High Risk'], ['closing', 'Closing'], ['stalled', 'Stalled']]

export function PortfolioShowcase() {
  const [filter, setFilter] = useState('all')

  function openA360(id: string) {
    const payload = buildA360(id)
    if (payload) window.dispatchEvent(new CustomEvent('open-a360', { detail: payload }))
  }
  function askTrend(r: PortRow) {
    window.dispatchEvent(new CustomEvent('open-ai', { detail: { prompt: `Why is ${r.name} trending ${r.delta} in health score this week?` } }))
  }

  const rows = filter === 'all' ? PORT_ROWS : PORT_ROWS.filter(r => r.filters.includes(filter))

  return (
    <div className="dsk-screen on">
      <div className="page-hdr">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>Portfolio</h1>
            <p>9 active accounts · $2.4M pipeline · 47 signals active</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => window.dispatchEvent(new CustomEvent('open-ai', { detail: { prompt: 'Help me add a new account to my portfolio' } }))} style={{ padding: '7px 16px', borderRadius: 10, background: 'var(--o)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 8px rgba(255,107,53,.28)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Account
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              {FILTERS.map(([key, label]) => (
                <div key={key} className={`sig-filter${filter === key ? ' on' : ''}`} onClick={() => setFilter(key)}>{label}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="dcard" style={{ padding: 0, overflow: 'hidden', maxHeight: 'none' }}>
        <table className="dtable">
          <thead>
            <tr>
              <th style={{ width: 50 }}>Health</th>
              <th>Account</th><th>ARR</th><th>Risk</th><th>Stage</th><th>Rep</th><th>Top Signal</th><th>Tags</th><th>Last Touch</th><th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className={r.health < 40 ? 'row-hi' : r.health < 65 ? 'row-md' : 'row-ok'} onClick={() => openA360(r.id)} style={{ cursor: 'pointer' }}>
                <td>
                  <div className="port-health" style={r.round
                    ? { background: r.hbg, color: r.hc, border: '1.5px solid rgba(34,197,94,.25)', width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }
                    : { background: r.hbg, color: r.hc }}>{r.health}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{r.contact}</div>
                </td>
                <td style={{ fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>{r.arr}</td>
                <td><span className={`rp ${r.rcls}`} style={r.rstyle}>{r.risk}</span></td>
                <td style={{ fontSize: 13 }}>{r.stage}</td>
                <td style={{ fontSize: 13 }}>{r.rep}</td>
                <td style={{ color: r.topSigC, fontSize: 12 }}>{r.topSig}</td>
                <td><div className="port-tags">{r.tags.map((t, i) => <span key={i} className={`port-tag port-tag-${t[1]}`}>{t[0]}</span>)}</div></td>
                <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--t3)' }}>{r.last}</td>
                <td>
                  <button onClick={(e) => { e.stopPropagation(); askTrend(r) }} style={{ fontSize: 13, fontWeight: 900, color: r.dc, fontFamily: "'DM Mono',monospace", background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }} title="Ask AI why">
                    {r.delta}
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 3, opacity: .5 }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
