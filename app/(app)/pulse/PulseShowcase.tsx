'use client'

// Demo showcase Pulse — pixel-faithful to popsicle-desktop-v15b prototype.
// Shown only for demo@popsicle-labs.app.

const accountsRows = [
  { id: 'acme', cls: 'row-hi', health: 31, hbg: 'var(--danger-bg)', hc: 'var(--danger)', name: 'Acme Corp', contact: 'Sarah Chen · CFO', arr: '$480K', risk: 'HIGH', rcls: 'rhi', stage: 'Negotiation', sig: 'Exec dark 8 days', sigc: 'var(--danger)', tags: [['Exec Dark','red'],['Competitor','amber']], delta: '-14%', dc: 'var(--danger)', last: '2d ago', action: 'Draft Email', actionPrimary: true },
  { id: 'meridian', cls: 'row-hi', health: 28, hbg: 'var(--danger-bg)', hc: 'var(--danger)', name: 'Meridian Labs', contact: 'Alex Park · CEO', arr: '$850K', risk: 'HIGH', rcls: 'rhi', stage: 'Renewal', sig: 'Timeline slipping Q2', sigc: 'var(--danger)', tags: [['Silent Stall','red'],['Churn Risk','red']], delta: '-11%', dc: 'var(--danger)', last: '5d ago', action: 'Schedule Call', actionPrimary: true },
  { id: 'axion', cls: 'row-md', health: 52, hbg: 'var(--amber-bg)', hc: 'var(--amber)', name: 'Axion Partners', contact: 'Marcus Webb · VP Eng', arr: '$95K', risk: 'MEDIUM', rcls: 'rmd', stage: 'Legal Review', sig: 'Contract stall day 3', sigc: 'var(--amber)', tags: [['Legal Hold','amber']], delta: '-4%', dc: 'var(--amber)', last: '1d ago', action: 'Send Redline', actionPrimary: true },
  { id: 'techflow', cls: 'row-md', health: 55, hbg: 'var(--amber-bg)', hc: 'var(--amber)', name: 'TechFlow Inc', contact: 'Lena Ford · COO', arr: '$210K', risk: 'MEDIUM', rcls: 'rmd', stage: 'Discovery', sig: 'Budget stall detected', sigc: 'var(--amber)', tags: [['Budget Stall','amber'],['Multi-thread','blue']], delta: '-6%', dc: 'var(--amber)', last: '3d ago', action: 'Pricing Deck', actionPrimary: true },
  { id: 'nexus', cls: 'row-ok', health: 88, hbg: 'var(--ok-bg)', hc: 'var(--ok)', name: 'Nexus AI', contact: 'Priya Sharma · CTO', arr: '$320K', risk: 'LOW', rcls: 'rlo', stage: 'Closing', sig: 'PO expected this week', sigc: 'var(--ok)', tags: [['Buyer Active','green'],['Legal Clear','green']], delta: '+12%', dc: 'var(--ok)', last: 'Today', action: 'Follow Up', actionPrimary: false },
]

const gmailIcon = (
  <svg width="22" height="17" viewBox="0 0 24 18"><rect width="24" height="18" rx="2" fill="#fff"/><rect x=".5" y=".5" width="23" height="17" rx="1.5" fill="none" stroke="#ddd" strokeWidth=".5"/><path d="M2 2l10 7.5L22 2" stroke="#EA4335" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 2v14h20V2" stroke="#EA4335" strokeWidth="1.2" fill="none" strokeLinejoin="round" opacity=".25"/></svg>
)

export function PulseShowcase() {
  return (
    <div className="dsk-screen on" id="d-pulse">
      {/* Header */}
      <div className="page-hdr fade-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ marginBottom: 4, fontSize: 15, fontWeight: 600, color: 'var(--t2)' }}>Good morning, Andy.</p>
            <h1 style={{ marginBottom: 0 }}>Revenue Pulse</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', animation: 'pulse 2s ease-in-out infinite' }}></div>
              <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>7 integrations synced · 2 min ago</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div className="conf-ring" style={{ width: 46, height: 46 }}>
                <svg width="46" height="46" viewBox="0 0 46 46" style={{ overflow: 'visible' }}>
                  <circle cx="23" cy="23" r="19" fill="none" stroke="rgba(34,197,94,.12)" strokeWidth="3.5"/>
                  <circle cx="23" cy="23" r="19" fill="none" stroke="#22C55E" strokeWidth="3.5" strokeDasharray="119.4" strokeDashoffset="10.7" strokeLinecap="round" transform="rotate(-90 23 23)"/>
                </svg>
                <div className="conf-ring-val" style={{ fontSize: 11, fontWeight: 900, color: '#22C55E' }}>91%</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ok)' }}>AI Confidence</div>
                <div style={{ fontSize: 9, color: 'var(--t3)' }}>847 signals</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        {/* Hero */}
        <div className="kpi-hero">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div className="kpi-hero-lbl" style={{ marginBottom: 0 }}>Pipeline Health Score</div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', color: '#fff', fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Ask
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <div className="kpi-hero-val">74</div>
            <span style={{ fontSize: 20, color: 'rgba(255,255,255,.4)', fontWeight: 500 }}>/100</span>
            <span className="kpi-hero-badge" style={{ marginLeft: 4 }}>▲ +6 pts this week</span>
          </div>
          <div className="kpi-hero-footer">
            <div className="kpi-hero-stat"><strong>68</strong>Last wk</div>
            <div className="kpi-hero-stat"><strong>62</strong>2 wks</div>
            <div className="kpi-hero-stat"><strong>847</strong>Signals</div>
            <div className="kpi-hero-stat"><strong>91%</strong>AI conf</div>
          </div>
        </div>

        {/* Revenue at Risk */}
        <div className="dcard kpi-support kpi-support-danger fade-in fade-in-2">
          <div className="dcard-title">Revenue at Risk</div>
          <div className="dcard-val" style={{ color: 'var(--danger)' }}>$1.2M</div>
          <div className="dcard-sub"><span className="dcard-delta delta-down">▼ +$85K</span> vs last week</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--danger)' }}>3</strong> High</span>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--amber)' }}>4</strong> Med</span>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--ok)' }}>2</strong> Low</span>
          </div>
        </div>

        {/* Active Signals */}
        <div className="dcard kpi-support kpi-support-blue fade-in fade-in-3">
          <div className="dcard-title">Active Signals</div>
          <div className="dcard-val">47</div>
          <div className="dcard-sub"><span className="dcard-delta delta-up">▲ 12 new</span> today</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--danger)' }}>18</strong> Crit</span>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--amber)' }}>16</strong> Warn</span>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--ok)' }}>13</strong> Pos</span>
          </div>
        </div>

        {/* Revenue Protected */}
        <div className="dcard kpi-support kpi-support-ok fade-in fade-in-4">
          <div className="dcard-title">Revenue Protected</div>
          <div className="dcard-val" style={{ color: 'var(--ok)' }}>$560K</div>
          <div className="dcard-sub"><span className="dcard-delta delta-up">▲ +38%</span> vs Q3</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--ok)' }}>4</strong> Saved</span>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--ok)' }}>12</strong> Actions</span>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--ok)' }}>94%</strong> Hit</span>
          </div>
        </div>
      </div>

      {/* AI Brief + Revenue Loop + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 320px', gap: 20, marginBottom: 24 }}>
        {/* AI Brief */}
        <div className="dcard fade-in fade-in-3" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>AI Brief</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ok)', animation: 'pulse 2s ease-in-out infinite' }}></div>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>just now</span>
              <span style={{ fontSize: 8, fontWeight: 700, background: 'linear-gradient(135deg,var(--o),#FFD166)', color: '#fff', padding: '2px 8px', borderRadius: 20 }}>LIVE</span>
            </div>
          </div>
          <div style={{ padding: '14px 20px' }}>
            <div className="ai-brief-item" style={{ background: 'rgba(224,62,62,.04)', border: '1px solid rgba(224,62,62,.1)', borderRadius: 10 }}><div className="ai-brief-dot" style={{ background: 'var(--danger)' }}></div><div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.55 }}>Acme's CRO hasn't opened your last 3 emails — <strong>switch to video before Friday</strong></div></div>
            <div className="ai-brief-item" style={{ background: 'rgba(42,157,92,.04)', border: '1px solid rgba(42,157,92,.1)', borderRadius: 10 }}><div className="ai-brief-dot" style={{ background: 'var(--ok)' }}></div><div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.55 }}>Win rate <strong>up 12% this quarter</strong> — Nexus &amp; Cobalt driving momentum</div></div>
            <div className="ai-brief-item" style={{ background: 'rgba(232,133,10,.04)', border: '1px solid rgba(232,133,10,.1)', borderRadius: 10 }}><div className="ai-brief-dot" style={{ background: 'var(--amber)' }}></div><div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.55 }}>Axion legal enters <strong>day 4 tomorrow</strong> — auto-escalation triggers at day 5</div></div>
            <div className="ai-brief-item" style={{ background: 'rgba(59,111,222,.04)', border: '1px solid rgba(59,111,222,.1)', borderRadius: 10 }}><div className="ai-brief-dot" style={{ background: 'var(--blue)' }}></div><div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.55 }}>TechVault CFO <strong>opened pricing PDF 4×</strong> — high intent signal, recommend follow-up call today</div></div>
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(59,111,222,.04)', border: '1px solid rgba(59,111,222,.1)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span style={{ color: 'var(--blue)' }}>Ask AI to expand on any insight →</span>
            </div>
          </div>
        </div>

        {/* Revenue Loop */}
        <div className="dcard fade-in fade-in-4" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Revenue Loop</span>
          </div>
          <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div className="loop-step"><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>Signals</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>Gmail · Slack · WhatsApp · Zoom · Gong</div></div><span style={{ fontSize: 18, fontWeight: 900, color: 'var(--danger)' }}>47</span></div>
            <div className="loop-connector"></div>
            <div className="loop-step"><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>Active Cases</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>Ranked by churn probability</div></div><span style={{ fontSize: 18, fontWeight: 900, color: 'var(--amber)' }}>9</span></div>
            <div className="loop-connector"></div>
            <div className="loop-step"><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>Actions Ready</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>AI-prepared playbooks</div></div><span style={{ fontSize: 18, fontWeight: 900, color: 'var(--o)' }}>12</span></div>
            <div className="loop-connector"></div>
            <div className="loop-step" style={{ background: 'rgba(42,157,92,.06)', borderColor: 'rgba(42,157,92,.15)' }}><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>Revenue Protected</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>This quarter</div></div><span style={{ fontSize: 18, fontWeight: 900, color: 'var(--ok)' }}>$560K</span></div>
          </div>
        </div>

        {/* Activity */}
        <div className="dcard fade-in fade-in-5" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Activity</span>
          </div>
          <div style={{ padding: '10px 20px' }}>
            {[
              { who: 'Acme Corp', what: 'CRO opened email but didn\'t reply (3rd time)', time: '12m' },
              { who: 'Nexus AI', what: 'Priya forwarded proposal to legal — "fast-track"', time: '34m' },
              { who: 'Axion', what: 'Contract redline stall entering day 4', time: '1h' },
              { who: 'Cobalt', what: '$150K deal closed-won ✓', time: '2h' },
              { who: 'TechFlow', what: 'CFO mentioned "check with finance" on call', time: '3h' },
            ].map((a, i) => (
              <div key={i} className="activity-item">
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{gmailIcon}</div>
                <div className="activity-body"><strong>{a.who}</strong> — {a.what}</div>
                <div className="activity-time">{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accounts table */}
      <div className="dcard fade-in fade-in-5" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Accounts Needing Attention</span>
          </div>
          <span className="see-all">View all 9 accounts →</span>
        </div>
        <table className="dtable">
          <thead><tr><th style={{ width: 50 }}>Health</th><th>Account</th><th>ARR</th><th>Risk</th><th>Stage</th><th>Top Signal</th><th>Tags</th><th style={{ whiteSpace: 'nowrap' }}>Health %</th><th style={{ whiteSpace: 'nowrap' }}>Last Touch</th><th>Action</th></tr></thead>
          <tbody>
            {accountsRows.map(r => (
              <tr key={r.id} className={r.cls}>
                <td><div className="port-health" style={{ background: r.hbg, color: r.hc }}>{r.health}</div></td>
                <td><div><div style={{ fontWeight: 700 }}>{r.name}</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>{r.contact}</div></div></td>
                <td style={{ fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>{r.arr}</td>
                <td><span className={`rp ${r.rcls}`}>{r.risk}</span></td>
                <td style={{ fontSize: 12, color: 'var(--t2)' }}>{r.stage}</td>
                <td style={{ fontSize: 12, color: r.sigc }}>{r.sig}</td>
                <td><div className="port-tags">{r.tags.map((t, i) => <span key={i} className={`port-tag port-tag-${t[1]}`}>{t[0]}</span>)}</div></td>
                <td>
                  <span style={{ fontSize: 13, fontWeight: 900, color: r.dc, fontFamily: "'DM Mono',monospace", display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                    {r.delta}
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 3, opacity: .5 }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  </span>
                </td>
                <td style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>{r.last}</td>
                <td>
                  <button
                    className={r.actionPrimary ? 'sig-card-btn primary' : 'sig-card-btn'}
                    style={!r.actionPrimary ? { color: 'var(--ok)', borderColor: 'rgba(42,157,92,.2)' } : undefined}
                  >
                    {r.action}
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
