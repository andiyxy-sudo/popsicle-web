'use client'

import { useState, useEffect } from 'react'

export interface A360Data {
  id: string
  name: string
  contact: string
  stage: string
  arr: string
  health: number
  signals: number
  daysDark: number | string
  risk: string
  rep: string
  lastTouch: string
  monogram?: string
  topSignal?: string
  tags?: [string, string][]
  brief?: string[]
  briefTypes?: ('danger' | 'warn' | 'ok')[]
  healthBars?: { label: string; val: number; color: string }[]
}

function riskClass(risk: string) {
  const r = risk.toUpperCase()
  if (r === 'HIGH') return 'rhi'
  if (r === 'MEDIUM' || r === 'MED') return 'rmd'
  return 'rlo'
}
function healthColor(h: number) {
  if (h < 40) return 'var(--danger)'
  if (h < 65) return 'var(--amber)'
  return 'var(--ok)'
}
function healthStroke(h: number) {
  if (h < 40) return '#F87171'
  if (h < 65) return '#FBBF24'
  return '#4ADE80'
}

export function Account360() {
  const [data, setData] = useState<A360Data | null>(null)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent).detail as A360Data
      if (detail) { setData(detail); setTab('overview'); setOpen(true) }
    }
    window.addEventListener('open-a360', onOpen as EventListener)
    return () => window.removeEventListener('open-a360', onOpen as EventListener)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function askAI(prompt: string) {
    setOpen(false)
    setTimeout(() => window.dispatchEvent(new CustomEvent('open-ai', { detail: { prompt } })), 120)
  }

  if (!data) return null

  const hc = healthColor(data.health)
  const hstroke = healthStroke(data.health)
  const circ = 2 * Math.PI * 26
  const offset = circ - (circ * data.health) / 100
  const mono = data.monogram || data.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const actions = [
    { label: 'Draft Follow-up', primary: true, prompt: `Draft a follow-up email to ${data.contact} at ${data.name}`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="22 7 12 13 2 7"/></svg> },
    { label: 'Schedule Call', prompt: `Help me schedule a call with ${data.contact} at ${data.name}`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { label: 'Battle Card', prompt: `Write a competitive battle card for ${data.name}`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
    { label: 'Escalate Risk', prompt: `Draft an internal escalation for ${data.name} (${data.contact})`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
    { label: 'Pricing Deck', prompt: `Create a pricing proposal outline for ${data.name}`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
    { label: 'Ask AI', prompt: `Analyse ${data.name} and recommend next steps`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
  ]

  return (
    <>
      <div className={`a360-backdrop${open ? ' on' : ''}`} onClick={() => setOpen(false)}></div>
      <div className={`a360-panel${open ? ' open' : ''}`}>
        <div className="a360-hero-bg">
          <div className="a360-hero-inner">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div className="a360-monogram" style={{ background: 'linear-gradient(135deg,#4A90D9,#7C3AED)' }}>{mono}</div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-.5px', color: 'var(--t1)', marginBottom: 3 }}>{data.name}</div>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>{data.contact}</span>
                    <span className="rp rmd" style={{ fontSize: 7.5, background: 'var(--o-bg)', color: 'var(--o)', borderColor: 'var(--o-border)' }}>{data.stage.toUpperCase()}</span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-1px', color: hc, lineHeight: 1 }}>{data.arr}</div>
                <div style={{ fontSize: 10, letterSpacing: '.1px', color: 'var(--t4)', marginTop: 3 }}>ARR</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0 14px', borderTop: '1px solid var(--border-soft)' }}>
              <div className="a360-hring">
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" strokeWidth="5"/>
                  <circle cx="32" cy="32" r="26" fill="none" stroke={hstroke} strokeWidth="5.5" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 32 32)" />
                </svg>
                <div className="a360-hring-val">
                  <span className="a360-hring-num" style={{ color: hc }}>{data.health}</span>
                  <span className="a360-hring-lbl" style={{ color: 'var(--t4)' }}>score</span>
                </div>
              </div>
              <div style={{ display: 'flex', flex: 1, gap: 0 }}>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border-soft)', padding: '0 10px' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--t1)' }}>{data.signals}</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2 }}>signals</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border-soft)', padding: '0 10px' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: typeof data.daysDark === 'number' && data.daysDark > 5 ? 'var(--danger)' : 'var(--t1)' }}>{data.daysDark}</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2 }}>days dark</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border-soft)', padding: '0 10px' }}>
                  <span className={`rp ${riskClass(data.risk)}`} style={{ fontSize: 9 }}>{data.risk.toUpperCase()}</span>
                  <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 4 }}>risk</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border-soft)', padding: '0 10px' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)' }}>{data.rep}</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2 }}>rep</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 14, fontSize: 11, color: 'var(--t4)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>{data.lastTouch}</span>
            </div>
          </div>
        </div>

        <div className="a360-tabs">
          {['overview', 'signals', 'people', 'timeline'].map(t => (
            <div key={t} className={`a360-tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</div>
          ))}
        </div>

        <div className="a360-two-col" style={{ height: 'calc(100vh - 280px)' }}>
          <div className="a360-main-col">
            {tab === 'overview' && (
              <div>
                {/* AI Risk Signals */}
                {data.brief && data.brief.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', marginBottom: 10, fontFamily: "'DM Mono',monospace" }}>AI Risk Signals</div>
                    {data.brief.map((b, i) => {
                      const type = data.briefTypes?.[i] || 'danger'
                      const rgb = type === 'danger' ? '224,62,62' : type === 'warn' ? '232,133,10' : '42,157,92'
                      const dot = type === 'danger' ? 'var(--danger)' : type === 'warn' ? 'var(--warn)' : 'var(--ok)'
                      return (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: `rgba(${rgb},.04)`, border: `1px solid rgba(${rgb},.1)`, borderRadius: 10, marginBottom: 6, alignItems: 'flex-start' }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 5 }}></div>
                          <div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.55 }}>{b}</div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Health Breakdown */}
                {data.healthBars && data.healthBars.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', marginBottom: 10, fontFamily: "'DM Mono',monospace" }}>Health Breakdown</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {data.healthBars.map((hb, i) => (
                        <div key={i} style={{ padding: '10px 12px', background: 'var(--inset)', borderRadius: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{hb.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: hb.color }}>{hb.val}%</span>
                          </div>
                          <div className="pbar" style={{ height: 5 }}><div className="pbar-fill" style={{ width: `${hb.val}%`, background: hb.color }}></div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deal Progress */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', marginBottom: 10, fontFamily: "'DM Mono',monospace" }}>Deal Progress</div>
                  <div className="pbar" style={{ height: 6 }}><div className="pbar-fill" style={{ width: `${data.health}%`, background: hc }}></div></div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8 }}>{data.stage} · health {data.health}/100</div>
                </div>

                {/* Fallback summary if no rich data */}
                {(!data.brief || data.brief.length === 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[['ARR', data.arr], ['Stage', data.stage], ['Health Score', `${data.health}/100`], ['Risk Level', data.risk], ['Active Signals', String(data.signals)], ['Owner', data.rep]].map(([k, v], i) => (
                      <div key={i} style={{ padding: 12, borderRadius: 10, background: 'var(--inset)', border: '1px solid var(--border-soft)' }}>
                        <div style={{ fontSize: 10, color: 'var(--t4)', marginBottom: 4 }}>{k}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab !== 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center', color: 'var(--t4)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, textTransform: 'capitalize' }}>{tab}</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 240 }}>Detailed {tab} view connects to live signal data once integrations sync for this account.</div>
              </div>
            )}
          </div>

          <div className="a360-action-col">
            <div className="a360-action-label">Recommended Actions</div>
            {actions.map((a, i) => (
              <button key={i} className={`a360-action-btn${a.primary ? ' primary' : ''}`} onClick={() => askAI(a.prompt)}>
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
