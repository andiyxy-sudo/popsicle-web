'use client'

import { useState } from 'react'
import { buildA360 } from '@/lib/demo-accounts'
import { A360Modal, ModalBtn, ModalConfig, ActionConfirmBody, ConfirmKind } from '@/components/account/A360Modal'

const SEC = (t: string, right?: React.ReactNode) => (
  <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>{t}</span>
    {right}
  </div>
)

// Icon per action kind: email (draft), phone (call/escalate), document (redline)
function actionIcon(kind: string) {
  if (kind === 'schedule') return <><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></>
  if (kind === 'escalate') return <><path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.09 5.18 2 2 0 015.11 3h3"/><polyline points="16 2 22 2 22 8"/><line x1="23" y1="1" x2="16" y2="8"/></>
  if (kind === 'redline') return <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></>
  return <><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="22 7 12 13 2 7"/></>
}

// Hero period data
const INTEL_PERIODS: Record<number, { val: string; delta: string; sub: string; signals: string; deals: string; resp: string }> = {
  30: { val: '$560K', delta: '▲ +38%', sub: '7 deals', signals: '42', deals: '7', resp: '3.4d' },
  60: { val: '$1.08M', delta: '▲ +44%', sub: '13 deals', signals: '78', deals: '13', resp: '3.6d' },
  90: { val: '$1.62M', delta: '▲ +51%', sub: '19 deals', signals: '121', deals: '19', resp: '3.8d' },
}

const FVA_PERIODS: Record<string, { forecast: string; actual: string; gap: string; pct: string; days: string; width: string }> = {
  '30': { forecast: '$1.24M', actual: '$1.18M', gap: '-$60K', pct: '95% achieved', days: '8 days remaining', width: '95%' },
  '60': { forecast: '$2.38M', actual: '$2.31M', gap: '-$70K', pct: '97% achieved', days: '21 days remaining', width: '97%' },
  '90': { forecast: '$3.42M', actual: '$3.50M', gap: '+$80K', pct: '102% achieved', days: '34 days remaining', width: '100%' },
}

export function IntelligenceShowcase() {
  const [period, setPeriod] = useState(30)
  const [fva, setFva] = useState('30')
  const [modal, setModal] = useState<ModalConfig | null>(null)
  const h = INTEL_PERIODS[period]
  const f = FVA_PERIODS[fva]

  function openA360(id: string) {
    const payload = buildA360(id)
    if (payload) window.dispatchEvent(new CustomEvent('open-a360', { detail: payload }))
  }
  function actionConfirm(kind: ConfirmKind, title: string, desc: string) {
    setModal({ title: kind === 'escalate' ? 'Escalated' : 'Confirmed', body: <ActionConfirmBody kind={kind} title={title} desc={desc} />, footer: <ModalBtn primary onClick={() => setModal(null)}>Done</ModalBtn> })
  }

  return (
    <div className="dsk-screen on">
      <div className="page-hdr">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><h1>Revenue Intelligence</h1><p>Historical and predictive analysis across revenue signals</p></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => actionConfirm('success', 'Report Exported', 'Revenue intelligence report (PDF) generated and downloaded.')} style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--inset)', border: '1px solid var(--border)', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: 'var(--t2)', fontFamily: 'Outfit' }}>Export PDF</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--t3)' }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)' }}></div><span style={{ fontFamily: "'DM Mono',monospace" }}>Live · 30 Days</span></div>
          </div>
        </div>
      </div>

      {/* 1. Revenue Protected Hero */}
      <div className="dcard" style={{ marginBottom: 20, padding: 0, overflow: 'hidden', background: 'linear-gradient(135deg,#FF5E22 0%,#FF7A30 45%,#F06A1A 80%,#E55F10 100%)', position: 'relative', border: '1px solid rgba(255,107,53,.3)', boxShadow: '0 4px 20px rgba(255,107,53,.32)' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle,rgba(255,255,255,.07) 1px,transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }}></div>
        <div style={{ position: 'absolute', top: -60, right: -40, width: 260, height: 260, background: 'radial-gradient(circle,rgba(255,220,140,.18) 0%,transparent 65%)', pointerEvents: 'none' }}></div>
        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 0 }}>
          <div style={{ padding: '24px 30px 20px', borderRight: '1px solid rgba(255,255,255,.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.95)', fontFamily: "'DM Mono',monospace" }}>Revenue Protected by Popsicle</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {[30, 60, 90].map(d => (
                  <div key={d} onClick={() => setPeriod(d)} style={{ padding: period === d ? '4px 12px' : '4px 10px', borderRadius: 20, background: period === d ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.04)', fontSize: period === d ? 10 : 9, fontWeight: 600, color: period === d ? '#fff' : 'rgba(255,255,255,.6)', cursor: 'pointer' }}>{d}d</div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: '#fff', letterSpacing: '-2.5px', lineHeight: 1, textShadow: '0 0 28px rgba(255,255,255,.2)' }}>{h.val}</div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#7DCEA0' }}>{h.delta}</span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 4 }}>saved this quarter across {h.sub} · avg <strong style={{ color: '#fff' }}>{h.resp.replace('d', ' days')}</strong> to intervention</div>
            <div style={{ marginTop: 18 }}>
              <svg width="100%" height="48" viewBox="0 0 400 48" preserveAspectRatio="none">
                <defs><linearGradient id="hero-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFB088" stopOpacity=".2"/><stop offset="100%" stopColor="#FFB088" stopOpacity="0"/></linearGradient></defs>
                <path d="M0 42 C50 40 100 38 150 34 C200 30 250 26 280 22 C310 18 340 14 360 10 L400 6 L400 48 L0 48Z" fill="url(#hero-grad)"/>
                <path d="M0 42 C50 40 100 38 150 34 C200 30 250 26 280 22 C310 18 340 14 360 10 L400 6" fill="none" stroke="#FFB088" strokeWidth="2" strokeLinecap="round" opacity=".6"/>
                <circle cx="400" cy="6" r="3" fill="#FFB088"/><circle cx="400" cy="6" r="6" fill="#FFB088" opacity=".2"/>
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'rgba(255,255,255,.55)', fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'].map(w => <span key={w}>{w}</span>)}<span style={{ color: 'rgba(255,176,136,.5)' }}>Now</span></div>
            </div>
          </div>
          <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignContent: 'center' }}>
            {[[h.signals, 'Signals caught', '78%'], [h.deals, 'Deals recovered', '58%'], [h.resp, 'Avg response', '85%']].map((s, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>{s[0]}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>{s[1]}</div>
                <div style={{ height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}><div style={{ height: '100%', width: s[2], background: 'rgba(125,206,160,.4)', borderRadius: 2 }}></div></div>
              </div>
            ))}
            <div style={{ background: 'rgba(255,176,136,.06)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,.1)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 8, right: 8 }}><svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="2.5"/><circle cx="16" cy="16" r="13" fill="none" stroke="#FFB088" strokeWidth="2.5" strokeDasharray="81.7" strokeDashoffset="4.9" strokeLinecap="round" transform="rotate(-90 16 16)"/></svg></div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>94%</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>AI Accuracy</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>847 signals</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Performance Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          { c: '42,157,92', col: 'var(--ok)', val: '+8%', lbl: 'Risk Change · 30d', icon: <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/> },
          { c: '255,107,53', col: 'var(--o)', val: '78%', lbl: 'Success Rate', icon: <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></> },
          { c: '42,157,92', col: 'var(--ok)', val: '$284K', lbl: 'Stabilized this week', icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/> },
        ].map((card, i) => (
          <div key={i} className="dcard" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `rgba(${card.c},.08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={card.col} strokeWidth="2" strokeLinecap="round">{card.icon}</svg></div>
            <div><div style={{ fontSize: 22, fontWeight: 900, color: card.col }}>{card.val}</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>{card.lbl}</div></div>
          </div>
        ))}
      </div>

      {/* 3. This Week's Story + KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 16, marginBottom: 24, alignItems: 'stretch' }}>
        <div className="dcard" style={{ borderLeft: '3px solid var(--o)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--t1)' }}>This Week&apos;s Story</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--o)', fontFamily: "'DM Mono',monospace", marginLeft: 4 }}>AI SUMMARY</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { c: 'var(--danger)', t: <><strong style={{ color: 'var(--danger)' }}>3 accounts deteriorated</strong> this week - Acme Corp, TechFlow, and Meridian Labs. Combined $1.54M at risk.</> },
              { c: 'var(--ok)', t: <><strong style={{ color: 'var(--ok)' }}>Brightwave re-engaged</strong> after 2 weeks dark - Chris Lee responded to outreach.</> },
              { c: 'var(--ok)', t: <><strong style={{ color: 'var(--ok)' }}>Cobalt Systems closed-won</strong> - $150K. First close this quarter.</> },
              { c: 'var(--amber)', t: <>Net pipeline risk <strong style={{ color: 'var(--danger)' }}>+$85K</strong> - intervention rate at <strong style={{ color: 'var(--ok)' }}>78%</strong> (target: 80%).</> },
              { c: 'var(--o)', t: <><strong>Focus today:</strong> Meridian CRO video call before Gong demo, Axion legal fast-track.</> },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: row.c, marginTop: 5, flexShrink: 0 }}></span>
                <span>{row.t}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t4)', marginBottom: 6 }}>Act now</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[
                { id: 'meridian', c: 'var(--danger)', name: 'Meridian Labs', sub: '0 exec contact · 31d to renewal', pct: '82%', pc: 'var(--danger)' },
                { id: 'acme', c: 'var(--danger)', name: 'Acme Corp', sub: 'CFO dark 8d · $45K invoice overdue', pct: '76%', pc: 'var(--danger)' },
                { id: 'techvault', c: 'var(--amber)', name: 'TechVault Inc', sub: 'Price concern WhatsApp · 48h no reply', pct: '61%', pc: 'var(--amber)' },
              ].map((r, i) => (
                <div key={i} onClick={() => openA360(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: r.c, flexShrink: 0 }}></span>
                  <span style={{ fontWeight: 700, color: 'var(--t1)', minWidth: 100 }}>{r.name}</span>
                  <span style={{ color: 'var(--t3)', flex: 1 }}>{r.sub}</span>
                  <span style={{ fontWeight: 800, color: r.pc, fontFamily: 'DM Mono,monospace' }}>{r.pct}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>At risk <strong style={{ color: 'var(--danger)' }}>$1.54M</strong></span>
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>Won <strong style={{ color: 'var(--ok)' }}>$150K</strong></span>
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>Intervention <strong style={{ color: 'var(--t1)' }}>78%</strong></span>
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>Actions needed <strong style={{ color: 'var(--amber)' }}>3</strong></span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, flex: 1 }}>
            <div style={{ padding: '11px 13px', background: 'rgba(224,62,62,.05)', border: '1px solid rgba(224,62,62,.12)', borderRadius: 10 }}><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--danger)', letterSpacing: '-1px', lineHeight: 1 }}>3</div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)', marginTop: 3 }}>Deteriorated</div><div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>Acme · TechFlow · Meridian</div><div style={{ fontSize: 9, color: 'var(--danger)', marginTop: 3, fontWeight: 600 }}>$1.54M at risk</div></div>
            <div style={{ padding: '11px 13px', background: 'rgba(42,157,92,.05)', border: '1px solid rgba(42,157,92,.12)', borderRadius: 10 }}><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--ok)', letterSpacing: '-1px', lineHeight: 1 }}>1</div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)', marginTop: 3 }}>Recovered</div><div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>Brightwave re-engaged</div><div style={{ fontSize: 9, color: 'var(--ok)', marginTop: 3, fontWeight: 600 }}>Chris Lee · 2 wks dark</div></div>
            <div style={{ padding: '11px 13px', background: 'rgba(224,62,62,.05)', border: '1px solid rgba(224,62,62,.12)', borderRadius: 10 }}><div style={{ fontSize: 18, fontWeight: 900, color: 'var(--danger)', letterSpacing: '-1px', lineHeight: 1 }}>+$85K</div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)', marginTop: 3 }}>Net risk</div><div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>Intervention at 78%</div><div style={{ fontSize: 9, color: 'var(--amber)', marginTop: 3, fontWeight: 600 }}>Target: 80%</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, flex: 1 }}>
            <div className="dcard" style={{ padding: '11px 13px' }}><div className="dcard-title" style={{ fontSize: 9 }}>Win Rate</div><div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1, margin: '3px 0' }}>34%</div><div style={{ fontSize: 10, color: 'var(--t3)' }}><span className="dcard-delta delta-up" style={{ fontSize: 9 }}>▲ +12%</span> this qtr</div><div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 3 }}>9 of 26 deals closed</div></div>
            <div className="dcard" style={{ padding: '11px 13px' }}><div className="dcard-title" style={{ fontSize: 9 }}>Deal Cycle</div><div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1, margin: '3px 0' }}>47d</div><div style={{ fontSize: 10, color: 'var(--t3)' }}><span className="dcard-delta delta-up" style={{ fontSize: 9 }}>▲ -8d</span> faster</div><div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 3 }}>vs 55d last quarter</div></div>
            <div className="dcard" style={{ padding: '11px 13px' }}><div className="dcard-title" style={{ fontSize: 9 }}>Churn Prev.</div><div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-1px', color: 'var(--ok)', lineHeight: 1, margin: '3px 0' }}>87%</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>14 of 16 saved</div><div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 3 }}>$284K ARR protected</div></div>
          </div>
        </div>
      </div>

      {/* Risk Trend + Churn Distribution */}
      <div className="two-col" style={{ marginBottom: 20 }}>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          {SEC('Revenue at Risk Trend', <span style={{ fontSize: 10, color: 'var(--t3)' }}>$892K total · +$145K vs prior</span>)}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, marginBottom: 12 }}>
              {[['W1', 45, 'rgba(224,62,62,.12)', 'var(--t3)'], ['W2', 55, 'rgba(224,62,62,.15)', 'var(--t3)'], ['W3', 72, 'rgba(224,62,62,.18)', 'var(--t3)'], ['W4', 62, 'rgba(224,62,62,.15)', 'var(--t3)'], ['Now', 68, 'var(--danger)', 'var(--danger)']].map((b, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}><div style={{ width: '100%', height: b[1] as number, background: b[2] as string, borderRadius: '4px 4px 0 0' }}></div><span style={{ fontSize: i === 4 ? 10 : 9, fontWeight: i === 4 ? 600 : 400, color: b[3] as string }}>{b[0]}</span></div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t3)' }}><span>Peak: <strong style={{ color: 'var(--danger)' }}>$1.04M</strong> (W3)</span><span>Trajectory: <strong style={{ color: 'var(--danger)' }}>+12%/wk</strong></span></div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <div style={{ flex: 1, padding: '6px 8px', background: 'rgba(224,62,62,.05)', border: '1px solid rgba(224,62,62,.1)', borderRadius: 8, fontSize: 11 }}><strong style={{ color: 'var(--danger)' }}>Exec disengagement</strong><div style={{ color: 'var(--t3)', marginTop: 2 }}>$85K</div></div>
              <div style={{ flex: 1, padding: '6px 8px', background: 'rgba(42,157,92,.05)', border: '1px solid rgba(42,157,92,.1)', borderRadius: 8, fontSize: 11 }}><strong style={{ color: 'var(--ok)' }}>SLA resolution</strong><div style={{ color: 'var(--t3)', marginTop: 2 }}>+$62K</div></div>
              <div style={{ flex: 1, padding: '6px 8px', background: 'rgba(232,133,10,.05)', border: '1px solid rgba(232,133,10,.1)', borderRadius: 8, fontSize: 11 }}><strong style={{ color: 'var(--amber)' }}>New competitor</strong><div style={{ color: 'var(--t3)', marginTop: 2 }}>$45K</div></div>
            </div>
          </div>
        </div>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          {SEC('Churn Probability Distribution')}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {[['3', 'Critical', '$1.4M exposure', 'var(--danger)', '224,62,62'], ['2', 'Monitor', '$305K exposure', 'var(--amber)', '232,133,10'], ['4', 'Healthy', '$690K pipeline', 'var(--ok)', '42,157,92']].map((c, i) => (
                <div key={i} style={{ flex: 1, padding: 12, background: `rgba(${c[4]},.06)`, border: `1px solid rgba(${c[4]},.12)`, borderRadius: 10, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 900, color: c[3] as string }}>{c[0]}</div><div style={{ fontSize: 10, fontWeight: 700, color: c[3] as string }}>{c[1]}</div><div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>{c[2]}</div></div>
              ))}
            </div>
            <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}><div style={{ width: '33%', background: 'var(--danger)' }}></div><div style={{ width: '22%', background: 'var(--amber)' }}></div><div style={{ width: '45%', background: 'var(--ok)' }}></div></div>
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>33% critical · 22% monitoring · 45% healthy</div>
          </div>
        </div>
      </div>

      {/* Top Risk Drivers + Intervention Effectiveness */}
      <div className="two-col" style={{ marginBottom: 20 }}>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          {SEC('Top Revenue Risk Drivers (30d)')}
          <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Exec Disengagement', accts: 'Acme · Meridian · TechFlow', w: '34%', pct: '34%', c: 'var(--danger)', delta: '▲ +6%', dc: 'var(--danger)' },
              { label: 'Invoice Delays', accts: 'Vertex · Axion · NovaTech', w: '28%', pct: '28%', c: 'var(--amber)', delta: '▲ +2%', dc: 'var(--amber)' },
              { label: 'Competitor Activity', accts: 'Meridian (Gong) · Atlas', w: '22%', pct: '22%', c: 'var(--amber)', delta: '▼ -3%', dc: 'var(--ok)' },
              { label: 'Usage Decline', accts: 'Coastal · TechVault', w: '16%', pct: '16%', c: 'var(--t3)', delta: '- 0%', dc: 'var(--t3)', dim: true },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 156, flexShrink: 0 }}><div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{r.label}</div><div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>{r.accts}</div></div>
                <div className="pbar" style={{ flex: 1, height: 7 }}><div className="pbar-fill" style={{ width: r.w, background: r.c }}></div></div>
                <div style={{ fontSize: 13, fontWeight: 900, color: r.dim ? 'var(--t2)' : r.c, width: 34, textAlign: 'right' }}>{r.pct}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: r.dc, fontFamily: 'DM Mono,monospace', width: 36, textAlign: 'right' }}>{r.delta}</div>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--border-soft)', margin: '2px 0' }}></div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: 'rgba(220,38,38,.04)', border: '1px solid rgba(220,38,38,.1)', borderRadius: 8 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.5 }}>Exec disengagement is up <strong style={{ color: 'var(--danger)' }}>6% WoW</strong> and driving the most churn risk. Prioritise direct CRO outreach to Acme and Meridian this week.</span>
            </div>
          </div>
        </div>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          {SEC('Intervention Effectiveness')}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { title: 'Draft Follow-up', sub: '28 used · most frequent action', pct: '74%', pc: 'var(--ok)', rec: false, kind: 'draft' },
              { title: 'Exec Escalation', sub: '14 used · highest churn reduction', pct: '68%', pc: 'var(--ok)', rec: false, kind: 'escalate' },
              { title: 'Invoice Chase', sub: '9 used · lowest performer', pct: '45%', pc: 'var(--amber)', rec: false, kind: 'redline' },
              { title: 'Exec Call', sub: '★ Recommended — highest impact', pct: '83%', pc: 'var(--ok)', rec: true, kind: 'schedule' },
            ].map((a, i) => (
              <div key={i} onClick={() => {
                if (a.kind === 'draft') actionConfirm('email', 'Follow-up Drafted', 'AI-drafted follow-up ready for review.')
                else if (a.kind === 'escalate') actionConfirm('escalate', 'Escalated to CRO', 'Risk brief sent. Exec-to-exec recommended within 24h.')
                else if (a.kind === 'redline') actionConfirm('email', 'Redline Sent', 'Simplified redline sent to legal.')
                else actionConfirm('schedule', 'Call Scheduled', 'Calendar invite drafted with AI agenda attached.')
              }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: a.rec ? 'rgba(42,157,92,.04)' : 'var(--inset)', border: a.rec ? '1px solid rgba(42,157,92,.12)' : '1px solid transparent', borderRadius: 12, cursor: 'pointer' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: a.rec ? 'rgba(42,157,92,.08)' : 'rgba(255,107,53,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={a.rec ? 'var(--ok)' : 'var(--o)'} strokeWidth="2" strokeLinecap="round">{actionIcon(a.kind)}</svg>
                </div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{a.title}</div><div style={{ fontSize: 11, color: a.rec ? 'var(--ok)' : 'var(--t3)', fontWeight: a.rec ? 600 : 400 }}>{a.sub}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 18, fontWeight: 900, color: a.pc }}>{a.pct}</div><div style={{ fontSize: 9, color: a.rec ? 'var(--ok)' : 'var(--t3)' }}>success</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Forecast vs Actual */}
      <div className="dcard" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        {SEC('Forecast vs Actual', <div style={{ display: 'flex', gap: 4 }}>{['30', '60', '90'].map(d => <div key={d} className={`fc-tab${fva === d ? ' on' : ''}`} style={{ padding: '4px 10px', fontSize: 10 }} onClick={() => setFva(d)}>{d} Days</div>)}</div>)}
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: 20, alignItems: 'center' }}>
          <div><div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4, fontFamily: "'DM Mono',monospace" }}>FORECAST</div><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--t1)' }}>{f.forecast}</div></div>
          <div><div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4, fontFamily: "'DM Mono',monospace" }}>ACTUAL (MTD)</div><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--ok)' }}>{f.actual}</div></div>
          <div><div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4, fontFamily: "'DM Mono',monospace" }}>VARIANCE</div><div style={{ fontSize: 26, fontWeight: 900, color: f.gap.startsWith('+') ? 'var(--ok)' : 'var(--amber)' }}>{f.gap}</div></div>
          <div><div className="pbar" style={{ height: 10, marginBottom: 6 }}><div className="pbar-fill" style={{ width: f.width, background: 'linear-gradient(90deg,var(--ok),#52C87A)' }}></div></div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)' }}><span>{f.pct}</span><span>{f.days}</span></div></div>
        </div>
      </div>

      {/* Exposure Trend chart + Signal Source */}
      <div className="two-col" style={{ marginBottom: 20 }}>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          {SEC('Revenue Exposure Trend', <span style={{ fontSize: 10, color: 'var(--t3)' }}>$892K · +$145K vs prior</span>)}
          <div style={{ padding: '16px 20px 12px' }}>
            <div style={{ display: 'flex', gap: 0, height: 130, alignItems: 'stretch' }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingBottom: 18, marginRight: 6, flexShrink: 0 }}>
                {['$1.2M', '$800K', '$400K', '$0'].map(l => <span key={l} style={{ fontSize: 8, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>{l}</span>)}
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <svg width="100%" height="100%" viewBox="0 0 300 130" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(220,38,38,.18)"/><stop offset="100%" stopColor="rgba(220,38,38,.02)"/></linearGradient>
                    <linearGradient id="stableGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(22,163,74,.18)"/><stop offset="100%" stopColor="rgba(22,163,74,.02)"/></linearGradient>
                  </defs>
                  <path d="M0 60 L60 51 L120 15 L180 40 L240 23 L240 112 L180 112 L120 112 L60 112 L0 112 Z" fill="url(#riskGrad)"/>
                  <polyline points="0,60 60,51 120,15 180,40 240,23" fill="none" stroke="rgba(220,38,38,.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M0 79 L60 74 L120 84 L180 67 L240 62 L240 112 L180 112 L120 112 L60 112 L0 112 Z" fill="url(#stableGrad)"/>
                  <polyline points="0,79 60,74 120,84 180,67 240,62" fill="none" stroke="rgba(22,163,74,.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="0" cy="60" r="3" fill="rgba(220,38,38,.9)"/><circle cx="60" cy="51" r="3" fill="rgba(220,38,38,.9)"/><circle cx="120" cy="15" r="4" fill="var(--danger)" stroke="#fff" strokeWidth="1.5"/><circle cx="180" cy="40" r="3" fill="rgba(220,38,38,.9)"/><circle cx="240" cy="23" r="4" fill="var(--danger)" stroke="#fff" strokeWidth="1.5"/>
                  <circle cx="0" cy="79" r="3" fill="rgba(22,163,74,.9)"/><circle cx="60" cy="74" r="3" fill="rgba(22,163,74,.9)"/><circle cx="120" cy="84" r="3" fill="rgba(22,163,74,.9)"/><circle cx="180" cy="67" r="3" fill="rgba(22,163,74,.9)"/><circle cx="240" cy="62" r="4" fill="var(--ok)" stroke="#fff" strokeWidth="1.5"/>
                  <line x1="120" y1="15" x2="120" y2="112" stroke="rgba(220,38,38,.2)" strokeWidth="1" strokeDasharray="3,3"/>
                  {[['W1', 0, 'var(--t3)', '400'], ['W2', 60, 'var(--t3)', '400'], ['W3', 120, 'var(--danger)', '700'], ['W4', 180, 'var(--t3)', '400'], ['Now', 240, 'var(--t1)', '700']].map((t, i) => <text key={i} x={t[1] as number} y="126" fontSize="8" fill={t[2] as string} textAnchor="middle" fontFamily="DM Mono,monospace" fontWeight={t[3] as string}>{t[0]}</text>)}
                </svg>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--t3)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="rgba(220,38,38,.8)" strokeWidth="2"/></svg>At Risk</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="rgba(22,163,74,.7)" strokeWidth="2"/></svg>Stabilized</span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--t3)' }}><span>Peak: <strong style={{ color: 'var(--danger)' }}>$1.04M</strong> W3</span><span>Trend: <strong style={{ color: 'var(--danger)' }}>+12%/wk</strong></span></div>
            </div>
          </div>
        </div>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          {SEC('Signal Source Breakdown', <span style={{ fontSize: 10, color: 'var(--t3)' }}>847 signals</span>)}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['Gmail / Outlook', '372 · 44%', '44%'], ['WhatsApp', '251 · 30%', '30%'], ['Slack', '152 · 18%', '18%'], ['Zoom / Calls', '72 · 8%', '8%']].map((s, i) => (
              <div key={i}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 12, fontWeight: 700 }}>{s[0]}</span><span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{s[1]}</span></div><div className="pbar"><div className="pbar-fill" style={{ width: s[2] }}></div></div></div>
            ))}
          </div>
        </div>
      </div>

      {/* Deep Intervention table + Renewal Outlook */}
      <div className="two-col" style={{ marginBottom: 20 }}>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          {SEC('Intervention Effectiveness (Deep)', <span style={{ fontSize: 10, color: 'var(--t3)' }}>Action to outcome</span>)}
          <div style={{ padding: '0 20px 16px' }}>
            <table className="dtable" style={{ fontSize: 12 }}>
              <thead><tr><th>Action</th><th>Used</th><th>Success</th><th>Avg Δ Churn</th></tr></thead>
              <tbody>
                {[['Follow-up Email', '28', '74%', 'var(--ok)', '-18%', false], ['Exec Escalation', '14', '68%', 'var(--ok)', '-22%', false], ['Invoice Chase', '9', '45%', 'var(--amber)', '-8%', false], ['Exec Call', '6', '83%', 'var(--ok)', '-31%', true]].map((r, i) => (
                  <tr key={i}><td style={{ fontWeight: 700 }}>{r[0]}</td><td>{r[1]}</td><td style={{ color: r[3] as string, fontWeight: 700 }}>{r[2]}</td><td style={{ fontFamily: "'DM Mono',monospace", color: r[5] ? 'var(--ok)' : undefined, fontWeight: r[5] ? 700 : 400 }}>{r[4]}</td></tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(42,157,92,.05)', border: '1px solid rgba(42,157,92,.1)', borderRadius: 8, fontSize: 11, color: 'var(--t2)' }}>Executive calls show <strong style={{ color: 'var(--ok)' }}>highest churn reduction</strong> per intervention (-31% avg). Follow-ups remain most frequently used at 74% effectiveness.</div>
          </div>
        </div>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          {SEC('Renewal Outlook', <span style={{ fontSize: 10, color: 'var(--t3)' }}>Next 90 days · $892K</span>)}
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { id: 'meridian', name: 'Meridian Labs', sub: '32 days · $245K', tag: 'AT RISK', tcls: 'rhi', bg: 'rgba(224,62,62,.04)', bd: 'rgba(224,62,62,.1)', dim: false },
              { id: null, name: 'NovaCorp', sub: '58 days · $310K', tag: 'MONITOR', tcls: 'rmd', bg: 'rgba(232,133,10,.04)', bd: 'rgba(232,133,10,.1)', dim: false },
              { id: 'brightwave', name: 'Brightwave', sub: '74 days · $195K', tag: 'ON TRACK', tcls: 'rlo', bg: 'rgba(42,157,92,.04)', bd: 'rgba(42,157,92,.1)', dim: true },
              { id: 'vertex', name: 'Vertex Systems', sub: '88 days · $142K', tag: 'ON TRACK', tcls: 'rlo', bg: 'rgba(42,157,92,.04)', bd: 'rgba(42,157,92,.1)', dim: true },
            ].map((r, i) => (
              <div key={i} onClick={() => r.id && openA360(r.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: r.bg, border: `1px solid ${r.bd}`, borderRadius: 10, cursor: r.id ? 'pointer' : 'default' }}>
                <div><div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>{r.sub}</div></div>
                <span className={`rp ${r.tcls}`} style={r.dim ? { opacity: .75 } : undefined}>{r.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions + Recovery Patterns */}
      <div className="two-col">
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          {SEC('Intervention Quick Actions')}
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { title: 'Draft Follow-up', sub: '74% success rate', kind: 'draft' },
              { title: 'Exec Escalation', sub: '68% success · -22% churn', kind: 'escalate' },
              { title: 'Invoice Chase', sub: '45% success rate', kind: 'redline' },
            ].map((a, i) => (
              <div key={i} onClick={() => {
                if (a.kind === 'draft') actionConfirm('email', 'Follow-up Drafted', 'AI-drafted follow-up ready for review.')
                else if (a.kind === 'escalate') actionConfirm('escalate', 'Escalated to CRO', 'Risk brief sent. Exec-to-exec recommended within 24h.')
                else actionConfirm('email', 'Redline Sent', 'Simplified redline sent to legal.')
              }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--inset)', borderRadius: 10, cursor: 'pointer' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,107,53,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2">{actionIcon(a.kind)}</svg></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{a.title}</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>{a.sub}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          {SEC('Recovery Patterns')}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 10, background: 'var(--inset)', borderRadius: 10, textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 900, color: 'var(--t1)' }}>3.2d</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>Avg recovery</div></div>
              <div style={{ padding: 10, background: 'var(--inset)', borderRadius: 10, textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ok)' }}>74%</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>Save rate</div></div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>
              <div style={{ marginBottom: 6 }}><strong>Best window:</strong> Tue-Thu 10AM-2PM</div>
              <div style={{ marginBottom: 6 }}><strong>Most effective:</strong> <span style={{ color: 'var(--o)', fontWeight: 700 }}>Video + exec sponsor</span></div>
              <div><strong>Fastest recoveries:</strong> 3+ stakeholders engaged</div>
            </div>
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(255,107,53,.05)', border: '1px solid rgba(255,107,53,.1)', borderRadius: 8, fontSize: 11, color: 'var(--o)', fontWeight: 600 }}>Recommendation: Increase exec calls - 83% success vs 74% for email</div>
          </div>
        </div>
      </div>

      <A360Modal config={modal} onClose={() => setModal(null)} />
    </div>
  )
}
