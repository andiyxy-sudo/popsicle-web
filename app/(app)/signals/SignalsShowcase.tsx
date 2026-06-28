'use client'

import { useState } from 'react'
import { buildA360 } from '@/lib/demo-accounts'
import { A360Modal, ModalBtn, ModalConfig, ActionConfirmBody, ConfirmKind } from '@/components/account/A360Modal'
import { SIGNALS, ASSET_BODIES, Signal } from './SignalsData'

const FILTERS: [string, string][] = [['all', 'All (7)'], ['High Risk', 'High (3)'], ['Watch', 'Watch (3)'], ['Positive', 'Positive (1)']]

function sourceIcon(via: string) {
  if (via === 'Slack') return <svg width="18" height="18" viewBox="0 0 128 128"><path d="M27.2 80.7c0 7.3-6 13.3-13.3 13.3S.6 88 .6 80.7s6-13.3 13.3-13.3h13.3v13.3z" fill="#E01E5A"/><path d="M47.2 27.2c-7.3 0-13.3-6-13.3-13.3S39.9.6 47.2.6s13.3 6 13.3 13.3v13.3H47.2z" fill="#36C5F0"/><path d="M100.7 47.2c0-7.3 6-13.3 13.3-13.3s13.3 6 13.3 13.3-6 13.3-13.3 13.3h-13.3V47.2z" fill="#2EB67D"/><path d="M80.7 100.7c7.3 0 13.3 6 13.3 13.3s-6 13.3-13.3 13.3-13.3-6-13.3-13.3v-13.3h13.3z" fill="#ECB22E"/></svg>
  if (via === 'WhatsApp') return <svg width="18" height="18" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#25D366"/><path d="M34.5 29.3c-.5-.2-2.8-1.4-3.3-1.5-.4-.2-.8-.2-1.1.2-.3.5-1.2 1.5-1.5 1.8-.3.3-.5.4-1 .1-.5-.2-2-.7-3.8-2.3-1.4-1.2-2.3-2.8-2.6-3.2-.3-.5 0-.7.2-1 .2-.2.5-.5.7-.8.2-.3.3-.5.4-.8.1-.3 0-.6-.1-.8-.1-.2-1.1-2.7-1.5-3.7-.4-.9-.8-.8-1.1-.8h-.9c-.3 0-.8.1-1.2.6-.4.4-1.6 1.6-1.6 3.8s1.6 4.4 1.8 4.7c.2.3 3.2 4.9 7.8 6.9 4.5 1.9 4.5 1.3 5.3 1.2.8-.1 2.8-1.1 3.2-2.2.4-1.1.4-2 .3-2.2z" fill="#fff"/></svg>
  if (via === 'Zoom') return <svg width="18" height="18" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#2D8CFF"/><path d="M14 18h12c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H14c-1.1 0-2-.9-2-2v-8c0-1.1.9-2 2-2zm18 2l6-4v16l-6-4V20z" fill="#fff"/></svg>
  if (via === 'Call') return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
  return <svg width="18" height="18" viewBox="0 0 24 18"><rect width="24" height="18" rx="2" fill="#fff"/><rect x=".5" y=".5" width="23" height="17" rx="1.5" fill="none" stroke="#ddd" strokeWidth=".5"/><path d="M2 2l10 8L22 2" stroke="#EA4335" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

export function SignalsShowcase() {
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalConfig | null>(null)

  const filtered = filter === 'all' ? SIGNALS : SIGNALS.filter(s => s.risk === filter)

  function openA360(acct: string) {
    const payload = buildA360(acct)
    if (payload) window.dispatchEvent(new CustomEvent('open-a360', { detail: payload }))
  }

  function actionConfirm(kind: ConfirmKind, title: string, desc: string) {
    setModal({
      title: kind === 'escalate' ? 'Escalated' : 'Confirmed',
      body: <ActionConfirmBody kind={kind} title={title} desc={desc} />,
      footer: <ModalBtn primary onClick={() => setModal(null)}>Done</ModalBtn>,
    })
  }

  function timelineModal(s: Signal) {
    setModal({
      title: 'Signal Timeline',
      body: <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 12, fontFamily: "'DM Mono',monospace" }}>Signal Timeline - {s.title.split(' - ')[1] || s.title}</div>
        {s.timeline.map((t, ti) => (
          <div key={ti} style={{ display: 'flex', gap: 12, paddingBottom: ti < s.timeline.length - 1 ? 12 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.statusColor, marginTop: 4 }}></div>
              {ti < s.timeline.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }}></div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>{t.who} · {t.platform}</div>
              <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{t.msg}</div>
              <div style={{ fontSize: 10, color: t.statusColor, marginTop: 4, fontFamily: "'DM Mono',monospace" }}>{t.time} · {t.status}</div>
            </div>
          </div>
        ))}
      </div>,
      footer: <ModalBtn primary onClick={() => setModal(null)}>Close</ModalBtn>,
    })
  }

  function snoozeModal(s: Signal) {
    const opts = ['1 hour', '4 hours', 'Tomorrow morning', 'Next week', 'Custom...']
    setModal({
      title: 'Snooze Signal',
      body: <div>
        <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 14 }}>Snooze &quot;{s.title}&quot; and get reminded later.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {opts.map(o => (
            <div key={o} onClick={() => actionConfirm('snooze', 'Snoozed', `Signal snoozed for ${o}. You will be reminded.`)} style={{ padding: '12px 14px', background: 'var(--inset)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--t1)', border: '1px solid transparent' }}>{o}</div>
          ))}
        </div>
      </div>,
      footer: <ModalBtn onClick={() => setModal(null)}>Cancel</ModalBtn>,
    })
  }

  function assetModal(label: string, sub: string) {
    const body = ASSET_BODIES[label] || `AI-GENERATED: ${label}\n\nPrepared for: ${sub}\n\nThis asset has been customized based on account signals, communication history, and deal stage. All content is ready to send or edit before deploying.`
    setModal({
      title: `Asset Preview - ${label}`,
      body: <AssetPreviewBody label={label} sub={sub} text={body} onSend={() => actionConfirm('email', 'Sent', `${label} has been sent with tracking enabled.`)} />,
      footer: null,
    })
  }

  function deploy(s: Signal) {
    actionConfirm("deploy", "Response Deployed", `All ${s.assets.length} AI-prepared assets for "${s.title}" have been deployed. Tracking enabled across all channels.`)
  }

  return (
    <div className="dsk-screen on">
      <div className="page-hdr">
        <h1>Live Signals</h1>
        <p>7 alerts · 47 signals this week across 7 integrations</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { c: '224,62,62', col: 'var(--danger)', label: '3 Critical', sub: '$1.4M at risk · avg 4h old', icon: <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/> },
          { c: '232,133,10', col: 'var(--amber)', label: '3 Watch', sub: '$515K exposure', icon: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></> },
          { c: '42,157,92', col: 'var(--ok)', label: '1 Positive', sub: '$320K closing', icon: <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></> },
        ].map((card, i) => (
          <div key={i} style={{ flex: 1, padding: '12px 16px', background: `rgba(${card.c},.04)`, border: `1px solid rgba(${card.c},.1)`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `rgba(${card.c},.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={card.col} strokeWidth="2">{card.icon}</svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: card.col }}>{card.label}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="sig-filters" style={{ marginBottom: 16 }}>
        {FILTERS.map(([key, label]) => (
          <div key={key} className={`sig-filter${filter === key ? ' on' : ''}`} onClick={() => setFilter(key)}>{label}</div>
        ))}
      </div>

      {/* Signal cards */}
      <div>
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 24px', textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t2)', margin: '12px 0 6px' }}>No signals match this filter</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.65, maxWidth: 260 }}>Try selecting a different channel or clearing the filter to see all signals.</div>
            <div onClick={() => setFilter('all')} style={{ marginTop: 16, padding: '8px 18px', borderRadius: 8, background: 'var(--o)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Clear filter</div>
          </div>
        ) : filtered.map(s => {
          const isHigh = s.risk === 'High Risk', isPos = s.risk === 'Positive'
          const rc = isHigh ? '220,38,38' : isPos ? '22,163,74' : '217,119,6'
          const borderColor = isHigh ? 'var(--danger)' : isPos ? 'var(--ok)' : 'var(--amber)'
          const riskLabel = isHigh ? 'HIGH' : isPos ? 'POSITIVE' : 'WATCH'
          const riskCls = isHigh ? 'rhi' : isPos ? 'rlo' : 'rmd'
          const isExp = expanded === s.id
          return (
            <div key={s.id} style={{ marginBottom: 7 }}>
              <div
                onClick={() => setExpanded(isExp ? null : s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border-soft)', borderLeft: `4px solid ${borderColor}`, borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 4px rgba(13,10,7,.06)', cursor: 'pointer' }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 11, background: `rgba(${rc},.08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `inset 0 0 0 1px rgba(${rc},.12)` }}>{sourceIcon(s.via)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--t1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
                    <span className={`rp ${riskCls}`} style={{ fontSize: 8, flexShrink: 0 }}>{riskLabel}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.desc}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {s.tags.slice(0, 2).map((t, i) => (
                    <span key={i} style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 20, fontFamily: "'DM Mono',monospace", background: `rgba(${rc},.07)`, color: `rgb(${rc})`, border: `1px solid rgba(${rc},.12)`, whiteSpace: 'nowrap' }}>{t}</span>
                  ))}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 64 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--t2)' }}>{s.via}</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 1 }}>{s.time}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: s.deltaColor, background: `rgba(${rc},.08)`, border: `1px solid rgba(${rc},.15)`, padding: '3px 9px', borderRadius: 20, fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap' }}>{s.delta}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={(e) => { e.stopPropagation(); openA360(s.acct) }} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11.5, fontWeight: 700, color: 'var(--t2)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap' }}>360</button>
                  <button onClick={(e) => { e.stopPropagation(); deploy(s) }} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--o)', border: 'none', fontSize: 11.5, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(255,107,53,.22)' }}>Deploy →</button>
                </div>
              </div>

              {isExp && (
                <div style={{ padding: '10px 14px 12px', background: `rgba(${rc},.02)`, border: '1px solid var(--border-soft)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ flex: '0 0 auto' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--o)', marginBottom: 7 }}>AI-Prepared Response Kit</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {s.assets.map((a, ai) => (
                          <div key={ai} onClick={() => assetModal(a.label, a.sub)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px 5px 8px', background: 'var(--surface)', borderRadius: 20, cursor: 'pointer', border: '1px solid var(--border)' }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(255,107,53,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            </div>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--t1)', whiteSpace: 'nowrap' }}>{a.label}</span>
                            <span style={{ fontSize: 10, color: 'var(--o)', fontWeight: 700, marginLeft: 1 }}>→</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                      <button onClick={() => timelineModal(s)} style={{ padding: '7px 16px', borderRadius: 8, background: 'var(--surface)', border: '1.5px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--t1)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap' }}>Timeline</button>
                      <button onClick={() => snoozeModal(s)} style={{ padding: '7px 16px', borderRadius: 8, background: 'var(--inset)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--t3)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap' }}>Snooze</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <A360Modal config={modal} onClose={() => setModal(null)} />
    </div>
  )
}

function AssetPreviewBody({ label, sub, text, onSend }: { label: string; sub: string; text: string; onSend: () => void }) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(text)
  const [copied, setCopied] = useState(false)

  function copy() {
    if (navigator.clipboard) navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--t2)' }}><strong>{label}</strong><span style={{ color: 'var(--t3)' }}> · {sub}</span></div>
      {editing ? (
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          style={{ width: '100%', minHeight: 180, fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.7, fontFamily: "'Outfit',sans-serif", border: '1.5px solid var(--o)', borderRadius: 12, padding: 14, background: 'var(--surface)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
        />
      ) : (
        <div style={{ padding: 14, background: 'var(--inset)', borderRadius: 12, fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: "'Outfit',sans-serif" }}>{content}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onSend} style={{ flex: 1, padding: 10, borderRadius: 10, background: 'var(--o)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Send Now</button>
        <button onClick={() => setEditing(e => !e)} style={{ padding: '10px 18px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--t1)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>{editing ? 'Done' : 'Edit'}</button>
        <button onClick={copy} style={{ padding: '10px 18px', borderRadius: 10, background: 'var(--inset)', border: '1px solid var(--border)', color: 'var(--t1)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
    </div>
  )
}
