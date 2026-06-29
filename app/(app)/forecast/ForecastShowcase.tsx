'use client'

import { useState } from 'react'
import { buildA360 } from '@/lib/demo-accounts'

// Forecast period data - ported from prototype _fcData.
const FC_DATA: Record<string, { labels: string[]; best: number[]; likely: number[]; down: number[] }> = {
  '1W': { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'TODAY'], best: [152, 148, 144, 140, 135, 129, 122], likely: [158, 155, 151, 148, 145, 143, 141], down: [162, 160, 158, 156, 155, 154, 153] },
  '1M': { labels: ['Oct W1', 'Oct W2', 'Oct W3', 'Oct W4', 'Nov W1', 'TODAY'], best: [155, 150, 143, 135, 127, 122], likely: [160, 157, 153, 150, 146, 141], down: [163, 161, 159, 157, 155, 153] },
  '3M': { labels: ['Oct', 'Oct 15', 'Nov', 'Nov 15', 'Dec', 'TODAY'], best: [158, 152, 145, 136, 128, 122], likely: [162, 158, 154, 150, 146, 141], down: [164, 162, 160, 158, 156, 153] },
  'YTD': { labels: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], best: [152, 148, 143, 135, 128, 122], likely: [158, 155, 151, 148, 145, 141], down: [162, 160, 158, 156, 155, 153] },
}

const X_START = 55, X_END = 640, Y_MAX = 164

function buildPaths(period: string) {
  const d = FC_DATA[period] || FC_DATA['YTD']
  const pts = d.best.length
  const xs: number[] = []
  for (let i = 0; i < pts; i++) xs.push(Math.round(X_START + (X_END - X_START) * i / (pts - 1)))
  const makePath = (ys: number[]) => {
    let p = `M${xs[0]} ${ys[0]}`
    for (let i = 1; i < pts; i++) {
      const cpx = Math.round((xs[i - 1] + xs[i]) / 2)
      p += ` C${cpx} ${ys[i - 1]} ${cpx} ${ys[i]} ${xs[i]} ${ys[i]}`
    }
    return p
  }
  const makeArea = (ys: number[]) => `${makePath(ys)} L${xs[pts - 1]} ${Y_MAX} L${xs[0]} ${Y_MAX}Z`
  return {
    bestLine: makePath(d.best), bestArea: makeArea(d.best),
    likelyLine: makePath(d.likely), likelyArea: makeArea(d.likely),
    downLine: makePath(d.down), downArea: makeArea(d.down),
    labels: d.labels, xs, endY: d.best[pts - 1],
  }
}

const DEALS = [
  { id: 'nexus', name: 'Nexus AI', arr: '$320K', cat: 'Commit', catC: 'var(--ok)', catBg: '42,157,92', prob: '92%', probC: 'var(--ok)', close: 'This week', stage: 'Closing', risk: 'LOW', rcls: 'rlo', dim: true, cls: 'row-ok' },
  { id: 'cobalt', name: 'Cobalt Systems', arr: '$150K', cat: 'Commit', catC: 'var(--ok)', catBg: '42,157,92', prob: '100%', probC: 'var(--ok)', close: 'Closed', stage: 'Won ✓', risk: 'LOW', rcls: 'rlo', dim: true, cls: 'row-ok' },
  { id: 'brightwave', name: 'Brightwave', arr: '$180K', cat: 'Likely', catC: 'var(--ok)', catBg: '42,157,92', prob: '76%', probC: 'var(--ok)', close: 'Next week', stage: 'Pilot', risk: 'LOW', rcls: 'rlo', dim: true, cls: 'row-ok' },
  { id: 'techflow', name: 'TechFlow Inc', arr: '$210K', cat: 'Likely', catC: 'var(--amber)', catBg: '232,133,10', prob: '55%', probC: 'var(--amber)', close: 'Dec 15', stage: 'Discovery', risk: 'MED', rcls: 'rmd', cls: 'row-md' },
  { id: 'techvault', name: 'TechVault Inc', arr: '$210K', cat: 'Likely', catC: 'var(--amber)', catBg: '232,133,10', prob: '52%', probC: 'var(--amber)', close: 'Dec 20', stage: 'Discovery', risk: 'MED', rcls: 'rmd', cls: 'row-md' },
  { id: 'axion', name: 'Axion Partners', arr: '$95K', cat: 'Likely', catC: 'var(--amber)', catBg: '232,133,10', prob: '48%', probC: 'var(--amber)', close: 'Legal', stage: 'Legal Review', risk: 'MED', rcls: 'rmd', cls: 'row-md' },
  { id: 'vertex', name: 'Vertex Systems', arr: '$140K', cat: 'Likely', catC: 'var(--blue)', catBg: '59,111,222', prob: '45%', probC: 'var(--blue)', close: 'Under review', stage: 'Proposal', risk: 'MONITOR', rcls: '', cls: 'row-md' },
  { id: 'acme', name: 'Acme Corp', arr: '$480K', cat: 'At Risk', catC: 'var(--danger)', catBg: '224,62,62', prob: '28%', probC: 'var(--danger)', close: 'Stalled', stage: 'Negotiation', risk: 'HIGH', rcls: 'rhi', cls: 'row-hi' },
  { id: 'meridian', name: 'Meridian Labs', arr: '$850K', cat: 'At Risk', catC: 'var(--danger)', catBg: '224,62,62', prob: '22%', probC: 'var(--danger)', close: 'Q2 slip', stage: 'Renewal', risk: 'HIGH', rcls: 'rhi', cls: 'row-hi' },
]

export function ForecastShowcase() {
  const [period, setPeriod] = useState('1W')
  const p = buildPaths(period)

  function openA360(id: string) {
    const payload = buildA360(id)
    if (payload) window.dispatchEvent(new CustomEvent('open-a360', { detail: payload }))
  }

  return (
    <div className="dsk-screen on">
      <div className="page-hdr">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><h1>Forecast</h1><p>Q4 2026 pipeline forecast with scenario modelling</p></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)' }}></div>
            <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>Updated 2 min ago</span>
          </div>
        </div>
      </div>

      {/* Hero KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 18, marginBottom: 24 }}>
        <div className="dcard" style={{ padding: '14px 18px', background: 'linear-gradient(135deg,rgba(255,107,53,.05),rgba(255,209,102,.02))', borderColor: 'rgba(255,107,53,.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--o)', letterSpacing: 1, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 4 }}>Best Case · Q4 2026</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-2px', color: 'var(--t1)' }}>$2.4M</div><span className="dcard-delta delta-up">▲ +8%</span></div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Dec 31, 2026 · 9 deals weighted</div>
            </div>
            <svg width="140" height="42" viewBox="0 0 180 42" style={{ flexShrink: 0, marginLeft: 16 }}><path d="M0 36 C20 34 45 30 70 24 C95 18 120 11 145 7 L180 3 L180 42 L0 42Z" fill="rgba(255,107,53,.08)"/><path d="M0 36 C20 34 45 30 70 24 C95 18 120 11 145 7 L180 3" fill="none" stroke="var(--o)" strokeWidth="1.8" opacity=".5"/><circle cx="180" cy="3" r="3" fill="var(--o)" opacity=".7"/></svg>
          </div>
        </div>
        <div className="dcard" style={{ textAlign: 'center', padding: '14px 16px' }}><div className="dcard-title">Commit</div><div className="dcard-val" style={{ color: 'var(--ok)', fontSize: 24 }}>$1.2M</div><div className="dcard-sub"><span className="dcard-delta delta-up">▲ +12%</span></div></div>
        <div className="dcard" style={{ textAlign: 'center', padding: '14px 16px' }}><div className="dcard-title">Deals to Close</div><div className="dcard-val" style={{ color: 'var(--ok)', fontSize: 24 }}>4</div><div className="dcard-sub" style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>in next 30 days</div></div>
        <div className="dcard" style={{ textAlign: 'center', padding: '14px 16px' }}><div className="dcard-title">At Risk</div><div className="dcard-val" style={{ color: 'var(--danger)', fontSize: 24 }}>$2.1M</div><div className="dcard-sub" style={{ color: 'var(--danger)' }}>▲ $400K exposure</div></div>
      </div>

      {/* Chart + side panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 24 }}>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Pipeline Trend</span>
            <div className="fc-tabs" style={{ margin: 0 }}>
              {['1W', '1M', '3M', 'YTD'].map(t => (
                <div key={t} className={`fc-tab${period === t ? ' on' : ''}`} onClick={() => setPeriod(t)}>{t}</div>
              ))}
            </div>
          </div>
          <div style={{ padding: '16px 20px 12px' }}>
            <div className="fc-chart" style={{ background: 'var(--inset)', borderRadius: 10, padding: 16, boxShadow: 'inset 0 1px 3px rgba(15,12,9,.06)' }}>
              <svg width="100%" height="188" viewBox="0 0 700 188" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="fc-grad-orange" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF6B35" stopOpacity=".18"/><stop offset="100%" stopColor="#FF6B35" stopOpacity="0"/></linearGradient>
                  <linearGradient id="fc-grad-ok" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16A34A" stopOpacity=".1"/><stop offset="100%" stopColor="#16A34A" stopOpacity="0"/></linearGradient>
                </defs>
                {[20, 62, 104, 146].map(y => <line key={y} x1="48" y1={y} x2="690" y2={y} stroke="var(--border)" strokeWidth=".5" strokeDasharray="4 4"/>)}
                {[['$2.4M', 24], ['$1.8M', 66], ['$1.2M', 108], ['$0.6M', 150]].map(([t, y], i) => <text key={i} x="40" y={y as number} fill="var(--t4)" fontSize="10" textAnchor="end" fontFamily="DM Mono,monospace">{t}</text>)}
                {/* areas + lines */}
                <path d={p.bestArea} fill="url(#fc-grad-orange)" style={{ transition: 'd .5s ease' }}/>
                <path d={p.downLine} fill="none" stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="5 4" opacity=".5" style={{ transition: 'd .5s ease' }}/>
                <path d={p.likelyLine} fill="none" stroke="var(--ok)" strokeWidth="1.5" strokeDasharray="5 4" opacity=".7" style={{ transition: 'd .5s ease' }}/>
                <path d={p.bestLine} fill="none" stroke="var(--o)" strokeWidth="2.5" strokeLinecap="round" style={{ transition: 'd .5s ease' }}/>
                {/* live endpoint dot */}
                <circle cx={p.xs[p.xs.length - 1]} cy={p.endY} r="5" fill="var(--o)" style={{ transition: 'cx .5s ease, cy .5s ease' }}/>
                <circle cx={p.xs[p.xs.length - 1]} cy={p.endY} r="5" fill="var(--o)" opacity=".3" style={{ transition: 'cx .5s ease, cy .5s ease' }}><animate attributeName="r" from="5" to="14" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" from=".3" to="0" dur="2s" repeatCount="indefinite"/></circle>
                {/* x-axis labels */}
                {p.labels.map((lbl, i) => <text key={i} x={p.xs[i]} y="186" fill="var(--t4)" fontSize="10" textAnchor="middle" fontFamily="DM Mono,monospace">{lbl}</text>)}
              </svg>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 18, height: 2.5, background: 'var(--o)', borderRadius: 2 }}></div><span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>Best Case</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 18, height: 2, background: 'var(--ok)', borderRadius: 2, opacity: .7 }}></div><span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>Commit</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 18, height: 2, background: 'var(--danger)', borderRadius: 2, opacity: .6 }}></div><span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>At Risk</span></div>
            </div>
            {/* AI Forecast Insights */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <div style={{ flex: 1, padding: '10px 12px', background: 'rgba(255,107,53,.05)', border: '1px solid rgba(255,107,53,.12)', borderRadius: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--o)', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 3 }}>Best Case Driver</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Nexus AI closing this week</div>
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>$420K · 84% probability</div>
              </div>
              <div style={{ flex: 1, padding: '10px 12px', background: 'rgba(220,38,38,.04)', border: '1px solid rgba(220,38,38,.1)', borderRadius: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--danger)', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 3 }}>Biggest Risk</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Meridian renewal slipping</div>
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>$850K · 5 days dark</div>
              </div>
              <div style={{ flex: 1, padding: '10px 12px', background: 'rgba(22,163,74,.04)', border: '1px solid rgba(22,163,74,.1)', borderRadius: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--ok)', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 3 }}>AI Confidence</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Likely within ±6% error</div>
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>14 active signals tracked</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="dcard" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
            <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)' }}><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Forecast vs Actual</span></div>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div><div style={{ fontSize: 9, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>FORECAST</div><div style={{ fontSize: 18, fontWeight: 900, color: 'var(--t1)' }}>$1.24M</div></div>
                <div><div style={{ fontSize: 9, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>ACTUAL</div><div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ok)' }}>$1.18M</div></div>
                <div><div style={{ fontSize: 9, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>GAP</div><div style={{ fontSize: 18, fontWeight: 900, color: 'var(--amber)' }}>-$60K</div></div>
              </div>
              <div className="pbar" style={{ height: 6 }}><div className="pbar-fill" style={{ width: '95%', background: 'var(--ok)' }}></div></div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>95% achieved · 8 days left</div>
            </div>
          </div>
          <div className="dcard" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
            <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>AI Accuracy</span><span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ok)' }}>94%</span></div>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['92%', 'Close', 'var(--ok)'], ['88%', 'Risk', 'var(--ok)'], ['78%', 'Timeline', 'var(--amber)']].map(([v, l, c], i) => (
                  <div key={i} style={{ flex: 1, padding: '8px 6px', background: 'var(--inset)', borderRadius: 8, textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 900, color: c }}>{v}</div><div style={{ fontSize: 8, color: 'var(--t3)' }}>{l}</div></div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 6 }}>847 signals · improving +3%/qtr</div>
            </div>
          </div>
        </div>
      </div>

      {/* Deal Pipeline Table */}
      <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Deal Pipeline · 9 Deals</span><span style={{ fontSize: 10, color: 'var(--t3)' }}>Sorted by close probability</span></div>
        <table className="dtable">
          <thead><tr><th>Account</th><th>ARR</th><th>Category</th><th>Probability</th><th>Close Date</th><th>Stage</th><th>Risk</th></tr></thead>
          <tbody>
            {DEALS.map(d => (
              <tr key={d.id} className={d.cls} onClick={() => openA360(d.id)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 700 }}>{d.name}</td>
                <td style={{ fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>{d.arr}</td>
                <td><span style={{ fontSize: 10, fontWeight: 700, color: d.catC, background: `rgba(${d.catBg},.08)`, padding: '2px 8px', borderRadius: 20, border: `1px solid rgba(${d.catBg},.12)` }}>{d.cat}</span></td>
                <td style={{ fontWeight: 800, color: d.probC }}>{d.prob}</td>
                <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--t3)' }}>{d.close}</td>
                <td>{d.stage}</td>
                <td><span className={`rp ${d.rcls}`} style={d.rcls === '' ? { background: 'rgba(59,111,222,.08)', color: 'var(--blue)', border: '1px solid rgba(59,111,222,.15)' } : d.dim ? { opacity: .75 } : undefined}>{d.risk}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
