'use client'

import { useState } from 'react'
import { buildA360 } from '@/lib/demo-accounts'

const SEC = (t: string, right?: React.ReactNode, color = 'var(--o)') => (
  <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color, fontFamily: "'DM Mono',monospace" }}>{t}</span>
    {right}
  </div>
)

const REPS = [
  { initials: 'AG', name: 'Andy G', role: 'VP of Sales · 4 accounts', grad: 'linear-gradient(135deg,#FF9050,#FF6B35)', medal: '🥇', badge: '🏆 Top performer', badgeBg: 'rgba(255,107,53,.1)', badgeC: 'var(--o)', protected: '$284K', signals: 47, saved: 4, saveRate: '89%', resp: '1.2h', respC: '#22C55E', trend: '↓ improving', trendC: '#22C55E', spark: 'M0.0,2.0 L13.3,16.4 L26.7,6.8 L40.0,26.0 L53.3,11.6 L66.7,21.2 L80.0,11.6', sparkColor: '#22C55E', barW: '89%', barC: 'var(--ok)', accts: [['acme', 'Acme'], ['techflow', 'Techflow'], ['axion', 'Axion'], ['meridian', 'Meridian']] },
  { initials: 'MR', name: 'Mike Ross', role: 'AE Senior · 3 accounts', grad: 'linear-gradient(135deg,#60A5FA,#3B82F6)', medal: '🥈', badge: '⚡ Most closes', badgeBg: 'rgba(59,130,246,.1)', badgeC: '#3B82F6', protected: '$176K', signals: 32, saved: 2, saveRate: '78%', resp: '2.4h', respC: '#FB923C', trend: '→ steady', trendC: '#FB923C', spark: 'M0.0,2.0 L13.3,12.3 L26.7,19.1 L40.0,8.9 L53.3,26.0 L66.7,22.6 L80.0,26.0', sparkColor: '#FB923C', barW: '78%', barC: 'var(--ok)', accts: [['nexus', 'Nexus'], ['cobalt', 'Cobalt'], ['brightwave', 'Brightwave']] },
  { initials: 'JT', name: 'Jamie Torres', role: 'Account Executive · 2 accounts', grad: 'linear-gradient(135deg,#A78BFA,#7C3AED)', medal: '🥉', badge: '📈 Improving', badgeBg: 'rgba(245,158,11,.1)', badgeC: 'var(--amber)', protected: '$100K', signals: 21, saved: 1, saveRate: '65%', resp: '3.1h', respC: '#EF4444', trend: '↑ needs coaching', trendC: '#EF4444', spark: 'M0.0,7.1 L13.3,12.3 L26.7,2.0 L40.0,14.0 L53.3,19.1 L66.7,24.3 L80.0,26.0', sparkColor: '#EF4444', barW: '65%', barC: 'var(--amber)', accts: [['techvault', 'Techvault'], ['vertex', 'Vertex']] },
]

const LEADERBOARD = [
  { rank: 1, initials: 'AG', name: 'Andy G', role: 'VP of Sales · 4 accounts', grad: 'linear-gradient(135deg,#FF9050,#FF6B35)', tc: '#fff', signals: 47, saved: 4, protected: '$284K', resp: '1.2h', save: '89%', barW: '89%', rankBg: 'rgba(255,107,53,.1)', rankC: 'var(--o)' },
  { rank: 2, initials: 'MR', name: 'Mike Ross', role: 'AE Senior · 3 accounts', grad: 'var(--inset)', tc: 'var(--t1)', signals: 32, saved: 2, protected: '$176K', resp: '2.4h', save: '78%', barW: '78%', rankBg: 'var(--inset)', rankC: 'var(--t1)' },
  { rank: 3, initials: 'JT', name: 'Jamie Torres', role: 'AE · 2 accounts', grad: 'var(--inset)', tc: 'var(--t1)', signals: 21, saved: 1, protected: '$100K', resp: '3.1h', save: '65%', saveC: 'var(--amber)', barW: '65%', rankBg: 'var(--inset)', rankC: 'var(--t1)' },
]

// Heat map intensity helper
const HEAT: Record<string, string> = { peak: '#FF6B35', high: 'rgba(255,107,53,.72)', med: 'rgba(255,107,53,.42)', low: 'rgba(255,107,53,.18)', off: 'var(--border)' }
const ROWS = ['8-10am', '10am-12', '12-2pm', '2-4pm', '4-6pm', '6-8pm']
const AG_HEAT = [['off', 'high', 'peak', 'peak', 'high', 'low', 'off'], ['peak', 'peak', 'peak', 'high', 'peak', 'off', 'off'], ['high', 'high', 'med', 'high', 'med', 'low', 'off'], ['peak', 'peak', 'high', 'peak', 'high', 'off', 'off'], ['med', 'high', 'peak', 'high', 'low', 'off', 'off'], ['off', 'low', 'low', 'low', 'off', 'off', 'off']]
const MR_HEAT = [['low', 'med', 'high', 'high', 'med', 'off', 'off'], ['high', 'high', 'high', 'med', 'high', 'low', 'off'], ['med', 'med', 'low', 'med', 'low', 'off', 'off'], ['high', 'high', 'med', 'high', 'med', 'off', 'off'], ['low', 'med', 'high', 'med', 'low', 'off', 'off'], ['off', 'off', 'low', 'off', 'off', 'off', 'off']]
const JT_HEAT = [['off', 'low', 'med', 'med', 'low', 'off', 'off'], ['med', 'high', 'high', 'low', 'med', 'off', 'off'], ['low', 'med', 'low', 'med', 'low', 'off', 'off'], ['med', 'high', 'med', 'med', 'high', 'off', 'off'], ['low', 'low', 'med', 'low', 'off', 'off', 'off'], ['off', 'off', 'off', 'off', 'off', 'off', 'off']]

const QUEUE = [
  { id: 'acme', name: 'Acme Corp', sev: 'CRITICAL', sevC: 'var(--danger)', bar: 'var(--danger)', desc: 'CFO silent 8 days · 3 emails opened, 0 replies', time: '8d', timeC: 'var(--danger)', rep: 'AG', repGrad: 'linear-gradient(135deg,#FF9050,#FF6B35)' },
  { id: 'meridian', name: 'Meridian Labs', sev: 'CRITICAL', sevC: 'var(--danger)', bar: 'var(--danger)', desc: 'Gong POC confirmed by CEO · competitor active', time: '5d', timeC: 'var(--danger)', rep: 'MR', repGrad: 'linear-gradient(135deg,#60A5FA,#3B82F6)' },
  { id: 'techflow', name: 'TechFlow Inc', sev: 'HIGH', sevC: 'var(--amber)', bar: 'var(--amber)', desc: 'COO budget concern on Zoom · "need to check finance"', time: '3h', timeC: 'var(--t3)', rep: 'AG', repGrad: 'linear-gradient(135deg,#FF9050,#FF6B35)' },
  { id: 'axion', name: 'Axion Partners', sev: 'HIGH', sevC: 'var(--amber)', bar: 'var(--amber)', desc: 'Legal stall day 3 · redline not sent yet', time: '3d', timeC: 'var(--danger)', rep: 'AG', repGrad: 'linear-gradient(135deg,#FF9050,#FF6B35)' },
  { id: 'techvault', name: 'TechVault Inc', sev: 'HIGH', sevC: 'var(--amber)', bar: 'var(--amber)', desc: 'VP Eng WhatsApp: price concern · no follow-up', time: '2d', timeC: 'var(--amber)', rep: 'JT', repGrad: 'linear-gradient(135deg,#A78BFA,#7C3AED)' },
  { id: 'vertex', name: 'Vertex Systems', sev: 'MEDIUM', sevC: 'var(--t3)', bar: 'var(--t3)', desc: 'Proposal opened 5x · no next step set', time: '4d', timeC: 'var(--danger)', rep: 'JT', repGrad: 'linear-gradient(135deg,#A78BFA,#7C3AED)' },
  { id: 'brightwave', name: 'Brightwave', sev: 'MEDIUM', sevC: 'var(--t3)', bar: 'var(--t3)', desc: 'Re-engagement email opened · no reply sent', time: '1d', timeC: 'var(--amber)', rep: 'MR', repGrad: 'linear-gradient(135deg,#60A5FA,#3B82F6)' },
]

export function TeamShowcase() {
  const [queueFilter, setQueueFilter] = useState('All')

  function openA360(id: string) {
    const payload = buildA360(id)
    if (payload) window.dispatchEvent(new CustomEvent('open-a360', { detail: payload }))
  }
  function askAI(prompt: string) {
    window.dispatchEvent(new CustomEvent('open-ai', { detail: { prompt } }))
  }

  const queueRows = queueFilter === 'All' ? QUEUE : QUEUE.filter(q => q.rep === queueFilter)

  function HeatGrid({ data }: { data: string[][] }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7,1fr)', gap: 4, alignItems: 'center' }}>
        <div></div>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} style={{ fontSize: 10, fontWeight: 600, color: 'var(--t4)', fontFamily: 'DM Mono,monospace', textAlign: 'center' }}>{d}</div>)}
        {ROWS.map((r, ri) => (
          <div key={`row${ri}`} style={{ display: 'contents' }}>
            <div style={{ fontSize: 10, color: 'var(--t4)', whiteSpace: 'nowrap', lineHeight: 1, display: 'flex', alignItems: 'center' }}>{r}</div>
            {data[ri].map((cell, ci) => <div key={`${ri}-${ci}`} style={{ height: 22, borderRadius: 5, background: HEAT[cell] }}></div>)}
          </div>
        ))}
      </div>
    )
  }

  function HeatLegend() {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 10, color: 'var(--t4)' }}>Less</span>
        {['off', 'low', 'med', 'high', 'peak'].map(k => <div key={k} style={{ width: 12, height: 12, borderRadius: 3, background: HEAT[k] }}></div>)}
        <span style={{ fontSize: 10, color: 'var(--t4)' }}>More</span>
      </div>
    )
  }

  return (
    <div className="dsk-screen on">
      <div className="page-hdr">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><h1>Team Intelligence</h1><p>Execution intelligence across live revenue signals</p></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>AI Confidence: 87%</span><div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)' }}></div></div>
        </div>
      </div>

      {/* Team KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16, marginBottom: 24, alignItems: 'stretch' }}>
        <div className="dcard" style={{ padding: '14px 16px', borderLeft: '3px solid var(--ok)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--t1)', letterSpacing: '.2px' }}>AI Insight</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { c: 'var(--ok)', t: <>Exec calls have <strong style={{ color: 'var(--ok)' }}>83% success rate</strong> vs 74% for email - highest impact intervention by far.</> },
              { c: 'var(--ok)', t: <>Andy G&apos;s 1.2h avg response time is <strong style={{ color: 'var(--ok)' }}>68% faster</strong> than team average - strongest signal coverage.</> },
              { c: 'var(--amber)', t: <>Jamie Torres&apos; 3.1h response time correlates with lower save rate - coaching on urgency recommended.</> },
              { c: 'var(--o)', t: <>Mike Ross closed 2 deals with zero escalation - replicate his re-engagement sequence across the team.</> },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5, color: 'var(--t1)', lineHeight: 1.5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.c, marginTop: 5, flexShrink: 0 }}></span><span>{r.t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dcard" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="dcard-title">Total ARR Exposure</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--danger)', letterSpacing: '-1px', lineHeight: 1 }}>$892K</div><span style={{ fontSize: 10, color: 'var(--t3)' }}>9 accounts</span></div>
          <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex' }}><div style={{ width: '54%', background: 'var(--danger)', borderRadius: '3px 0 0 3px' }}></div><div style={{ width: '24%', background: 'var(--amber)' }}></div><div style={{ width: '22%', background: 'var(--ok)', borderRadius: '0 3px 3px 0' }}></div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[['Critical', 'var(--danger)', '$480K · 2 accts'], ['Watching', 'var(--amber)', '$214K · 4 accts'], ['Healthy', 'var(--ok)', '$198K · 3 accts']].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--t2)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: r[1] as string, display: 'inline-block' }}></span>{r[0]}</div><span style={{ fontSize: 11, fontWeight: 700, color: r[1] as string, fontFamily: 'DM Mono,monospace' }}>{r[2]}</span></div>
            ))}
          </div>
        </div>

        <div className="dcard" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="dcard-title">Time-to-Action</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-1px', color: 'var(--t1)', lineHeight: 1 }}>4.2h</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}><span className="dcard-delta delta-up" style={{ fontSize: 11 }}>▼ -1.8h</span> vs last month</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 4, borderTop: '1px solid var(--border-soft)' }}>
            {[['Andy G', 'var(--ok)', '1.2h'], ['Mike Ross', 'var(--t2)', '2.4h'], ['Jamie Torres', 'var(--amber)', '3.1h']].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}><span style={{ color: 'var(--t3)' }}>{r[0]}</span><span style={{ fontWeight: 700, color: r[1] as string, fontFamily: 'DM Mono,monospace' }}>{r[2]}</span></div>
            ))}
          </div>
        </div>

        <div className="dcard" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="dcard-title">Signal Coverage</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-1px', color: 'var(--ok)', lineHeight: 1 }}>85%</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>8 of 10 accounts covered</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 4, borderTop: '1px solid var(--border-soft)' }}>
            {[['Signals this week', 'var(--t1)', '42'], ['Actioned', 'var(--ok)', '7 / 42'], ['Auto-deployed', 'var(--t2)', '62%']].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}><span style={{ color: 'var(--t3)' }}>{r[0]}</span><span style={{ fontWeight: 700, color: r[1] as string, fontFamily: 'DM Mono,monospace' }}>{r[2]}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="dcard" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Popsicle Saves Leaderboard · Summary</span></div>
          <span style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'DM Mono',monospace" }}>Q4 2026</span>
        </div>
        <table className="dtable">
          <thead><tr><th style={{ width: 40 }}>#</th><th>Rep</th><th>Signals Caught</th><th>Deals Recovered</th><th>Revenue Protected</th><th>Avg Response</th><th>Save Rate</th><th style={{ width: 140 }}>Performance</th></tr></thead>
          <tbody>
            {LEADERBOARD.map(r => (
              <tr key={r.rank}>
                <td><div className="team-rank" style={{ background: r.rankBg, color: r.rankC }}>{r.rank}</div></td>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: '50%', background: r.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: r.tc }}>{r.initials}</div><div><div style={{ fontWeight: 700 }}>{r.name}</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>{r.role}</div></div></div></td>
                <td style={{ fontWeight: 700 }}>{r.signals}</td>
                <td style={{ fontWeight: 700, color: 'var(--ok)' }}>{r.saved}</td>
                <td style={{ fontWeight: 900, color: 'var(--ok)', fontFamily: "'DM Mono',monospace" }}>{r.protected}</td>
                <td style={{ fontFamily: "'DM Mono',monospace" }}>{r.resp}</td>
                <td style={{ fontWeight: 700, color: r.saveC || 'var(--ok)' }}>{r.save}</td>
                <td><div className="team-bar" style={{ width: 140 }}><div className="team-bar-fill" style={{ width: r.barW }}></div></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '12px 20px', background: 'rgba(42,157,92,.04)', borderTop: '1px solid rgba(42,157,92,.12)', textAlign: 'center', fontSize: 13, color: 'var(--ok)', fontWeight: 700 }}>Team total: $560K protected · ▲ +38% vs Q3</div>
      </div>

      {/* Individual Breakdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M16 3.13a4 4 0 010 7.75"/><path d="M21 21v-2a4 4 0 00-3-3.85"/></svg>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>Individual Breakdown · Response Time Trend</span>
      </div>
      <div style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {REPS.map(rep => (
          <div key={rep.initials} className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: rep.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff' }}>{rep.initials}</div>
                <div style={{ position: 'absolute', bottom: 0, right: 0, fontSize: 13, lineHeight: 1, background: 'var(--surface)', borderRadius: '50%' }}>{rep.medal}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>{rep.name}</span><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: rep.badgeBg, color: rep.badgeC }}>{rep.badge}</span></div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{rep.role}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}><div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ok)', letterSpacing: '-1px' }}>{rep.protected}</div><div style={{ fontSize: 10, color: 'var(--t4)' }}>protected</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderBottom: '1px solid var(--border-soft)' }}>
              {[[`${rep.signals}`, 'Signals', 'var(--t1)'], [`${rep.saved}`, 'Saved', 'var(--ok)'], [rep.saveRate, 'Save rate', rep.saveRate === '65%' ? 'var(--amber)' : 'var(--ok)'], [rep.resp, 'Avg resp.', rep.respC]].map((s, i) => (
                <div key={i} style={{ padding: '10px 14px', borderRight: i < 3 ? '1px solid var(--border-soft)' : 'none', textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 900, color: s[2] }}>{s[0]}</div><div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2 }}>{s[1]}</div></div>
              ))}
            </div>
            <div style={{ padding: '12px 18px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 10, fontWeight: 600, color: 'var(--t4)' }}>Response time · last 7 days</span><span style={{ fontSize: 10, fontWeight: 700, color: rep.trendC }}>{rep.trend}</span></div>
              <svg width="80" height="28" viewBox="0 0 80 28" style={{ overflow: 'visible' }}><defs><linearGradient id={`sg-${rep.initials}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={rep.sparkColor} stopOpacity=".18"/><stop offset="100%" stopColor={rep.sparkColor} stopOpacity="0"/></linearGradient></defs><path d={`${rep.spark} L80,28 L0,28Z`} fill={`url(#sg-${rep.initials})`}/><path d={rep.spark} fill="none" stroke={rep.sparkColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="80" cy={rep.spark.split(' ').pop()?.split(',')[1]} r="2.5" fill={rep.sparkColor}/></svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} style={{ fontSize: 10, color: 'var(--t4)' }}>{d}</span>)}</div>
            </div>
            <div style={{ padding: '0 18px 14px' }}>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}><div style={{ height: '100%', width: rep.barW, background: rep.barC, borderRadius: 2 }}></div></div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {rep.accts.map(([id, label]) => <div key={id} onClick={() => openA360(id)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: 'var(--inset)', cursor: 'pointer', color: 'var(--t2)', fontWeight: 500 }}>{label}</div>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Heat Map */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Activity Heat Map · Signal Response</span></div>
          <span style={{ fontSize: 10, color: 'var(--t3)' }}>Last 7 days · by time of day</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          {[{ rep: REPS[0], heat: AG_HEAT }, { rep: REPS[1], heat: MR_HEAT }, { rep: REPS[2], heat: JT_HEAT }].map(({ rep, heat }) => (
            <div key={rep.initials} className="dcard" style={{ padding: '14px 16px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}><div style={{ width: 28, height: 28, borderRadius: '50%', background: rep.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff', flexShrink: 0 }}>{rep.initials}</div><span style={{ fontSize: 12, fontWeight: 800, color: 'var(--t1)' }}>{rep.name}</span></div>
              <HeatGrid data={heat} />
              <HeatLegend />
            </div>
          ))}
        </div>
      </div>

      {/* Unactioned Signal Queue */}
      <div style={{ marginBottom: 20 }}>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--danger)', fontFamily: "'DM Mono',monospace" }}>Unactioned Signal Queue</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 12, fontWeight: 800, color: 'var(--danger)' }}>{queueRows.length} unactioned</span><span style={{ fontSize: 10, color: 'var(--t3)' }}>of 42 this week · 83% unresolved</span></div>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '10px 18px 8px', borderBottom: '1px solid var(--border-soft)' }}>
            {[['All', QUEUE.length], ['AG', 3], ['MR', 2], ['JT', 2]].map(([f, n]) => (
              <div key={f} onClick={() => setQueueFilter(f as string)} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: queueFilter === f ? 'var(--o)' : 'var(--inset)', color: queueFilter === f ? '#fff' : 'var(--t3)', fontWeight: queueFilter === f ? 700 : 600, cursor: 'pointer' }}>{f} · {n}</div>
            ))}
          </div>
          <div>
            {queueRows.map(q => (
              <div key={q.id} onClick={() => openA360(q.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--border-soft)', cursor: 'pointer' }}>
                <div style={{ width: 3, height: 36, borderRadius: 2, background: q.bar, flexShrink: 0 }}></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}><span style={{ fontSize: 12, fontWeight: 800, color: 'var(--t1)' }}>{q.name}</span><span style={{ fontSize: 10, fontWeight: 700, color: q.sevC, background: q.sev === 'MEDIUM' ? 'var(--inset)' : `rgba(${q.sev === 'CRITICAL' ? '220,38,38' : '217,119,6'},.07)`, padding: '1px 7px', borderRadius: 20, border: `1px solid ${q.sev === 'MEDIUM' ? 'var(--border)' : `rgba(${q.sev === 'CRITICAL' ? '220,38,38' : '217,119,6'},.15)`}` }}>{q.sev}</span></div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{q.desc}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}><div style={{ fontSize: 12, fontWeight: 800, color: q.timeC, fontFamily: 'DM Mono,monospace' }}>{q.time}</div><div style={{ fontSize: 10, color: 'var(--t4)' }}>unactioned</div></div>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: q.repGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff', flexShrink: 0 }} title={q.rep}>{q.rep}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 18px', background: 'rgba(220,38,38,.03)', borderTop: '1px solid rgba(220,38,38,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 700 }}>⚠ $1.73M ARR in unactioned signals queue</span>
            <span onClick={() => askAI('Which unactioned signals should I prioritise right now and why?')} style={{ fontSize: 11, fontWeight: 700, color: 'var(--o)', cursor: 'pointer' }}>Ask AI to prioritise →</span>
          </div>
        </div>
      </div>

      {/* Signal Response Metrics */}
      <div className="three-col" style={{ marginBottom: 20 }}>
        <div className="dcard" style={{ textAlign: 'center' }}><div className="dcard-title">Signals per Day</div><div className="dcard-val">6.7</div><div className="dcard-sub"><span className="dcard-delta delta-up">▲ +2.1</span> vs last month</div></div>
        <div className="dcard" style={{ textAlign: 'center' }}><div className="dcard-title">Avg Close Time</div><div className="dcard-val">4.2h</div><div className="dcard-sub"><span className="dcard-delta delta-up">▼ -1.8h</span> improvement</div></div>
        <div className="dcard" style={{ textAlign: 'center' }}><div className="dcard-title">Auto-deploy Rate</div><div className="dcard-val" style={{ color: 'var(--ok)' }}>62%</div><div className="dcard-sub">AI responses deployed without edit</div></div>
      </div>

      {/* Movement + Coverage */}
      <div className="two-col">
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          {SEC('Revenue Movement This Week')}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 12, background: 'rgba(224,62,62,.05)', border: '1px solid rgba(224,62,62,.1)', borderRadius: 10 }}><div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>New critical accounts</div><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--danger)' }}>+2</div></div>
              <div style={{ padding: 12, background: 'rgba(42,157,92,.05)', border: '1px solid rgba(42,157,92,.1)', borderRadius: 10 }}><div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Accounts stabilized</div><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--ok)' }}>+3</div></div>
              <div style={{ padding: 12, background: 'var(--inset)', borderRadius: 10 }}><div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Actions taken</div><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--t1)' }}>14</div></div>
              <div style={{ padding: 12, background: 'var(--inset)', borderRadius: 10 }}><div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Avg response time</div><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--ok)' }}>↓ 1.2h</div></div>
            </div>
          </div>
        </div>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          {SEC('Coverage & Ownership', <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700 }}>2 unowned</span>)}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 12 }}>Critical coverage: <strong>8/10 owned</strong> · 6/10 with active follow-up</div>
            <div style={{ padding: '8px 10px', background: 'rgba(224,62,62,.05)', border: '1px solid rgba(224,62,62,.1)', borderRadius: 8, marginBottom: 8, fontSize: 12 }}><strong style={{ color: 'var(--danger)' }}>Unowned Risk: $245K</strong><span style={{ color: 'var(--t3)', marginLeft: 6 }}>· 2 accounts need assignment</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { initials: 'AG', grad: 'linear-gradient(135deg,#FF9050,#FF6B35)', tc: '#fff', name: 'Andy G', sub: '4 accounts · $480K exposure', status: 'Active', sc: 'var(--ok)' },
                { initials: 'MR', grad: 'var(--inset)', tc: 'var(--t1)', name: 'Mike Ross', sub: '3 accounts · $305K exposure', status: 'Active', sc: 'var(--ok)' },
                { initials: 'JT', grad: 'var(--inset)', tc: 'var(--t1)', name: 'Jamie Torres', sub: '2 accounts · $107K exposure', status: 'Slow', sc: 'var(--amber)' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--inset)', borderRadius: 8 }}><div style={{ width: 24, height: 24, borderRadius: '50%', background: r.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: r.tc }}>{r.initials}</div><div style={{ flex: 1, fontSize: 12 }}><strong>{r.name}</strong><span style={{ color: 'var(--t3)', marginLeft: 6 }}>{r.sub}</span></div><span style={{ fontSize: 10, fontWeight: 700, color: r.sc }}>{r.status}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
