'use client'

// Live Signals with the ACTION LOOP: every signal can be snoozed, dismissed,
// or answered with an AI-drafted follow-up email grounded in the signal's own
// analysis + the real thread. Snooze/dismiss update optimistically; the draft
// opens in a modal with copy / open-in-email / regenerate.

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface DBSignal {
  id: string
  account_name?: string
  signal_type?: string
  severity?: string
  title?: string
  description?: string
  ai_analysis?: ({ summary?: string; recommendation?: string } & Record<string, unknown>) | null
  is_dismissed?: boolean
  is_snoozed?: boolean
  risk_amount?: number
  impact_pct?: string | number
  source_integration?: string
  created_at?: string
}

const TYPE_LABELS: Record<string, string> = {
  silent_stall: 'Silent Stall', competitor_mention: 'Competitor Mention', legal_loopin: 'Legal Loop-in',
  price_flinch: 'Price Flinch', champion_change: 'Champion Change', timeline_slip: 'Timeline Slip', deal_stage_backward: 'Deal Moved Backward',
  reengaged: 'Re-engaged',
  call_objection: 'Call Objection', call_sentiment_drop: 'Call Sentiment Drop',
  call_buying_signal: 'Buying Signal', call_commitment: 'Call Commitment', call_summary: 'Call Summary',
  meeting_cancelled: 'Meeting Cancelled', meeting_declined: 'Meeting Declined',
}

function fmtMoney(v?: number) {
  if (!v) return null
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${Math.round(v / 1000)}K`
  return `$${v}`
}

function timeAgo(iso?: string) {
  if (!iso) return ''
  const d = (Date.now() - new Date(iso).getTime()) / 86400000
  if (d < 1) return 'today'
  if (d < 2) return 'yesterday'
  return `${Math.floor(d)}d ago`
}

interface Draft { subject: string; body: string; to: string }

export function SignalsReal({ signals: initial }: { signals: DBSignal[] }) {
  const router = useRouter()
  const [signals, setSignals] = useState<DBSignal[]>(initial)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Draft modal state
  const [draftFor, setDraftFor] = useState<DBSignal | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [draftState, setDraftState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [copied, setCopied] = useState(false)
  // Deep link (?signal=<id>): opened detail, row flash, and not-found state
  const [detailFor, setDetailFor] = useState<DBSignal | null>(null)
  const [deepNotFound, setDeepNotFound] = useState(false)
  const [flashId, setFlashId] = useState<string | null>(null)

  // Handle /signals?signal=<id> deep links (Slack "Open in Popsicle" etc).
  // If the signal is in the visible list: scroll to it, flash it, open detail.
  // If not (dismissed, snoozed, or older): fetch it directly (RLS keeps this
  // scoped to the signed-in user). Unknown or foreign ids get a friendly
  // not-found panel instead of an error.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('signal')
    if (!id) return
    const inList = initial.find(x => x.id === id)
    if (inList) {
      setDetailFor(inList)
      setFlashId(id)
      setTimeout(() => {
        document.getElementById(`sig-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 60)
      setTimeout(() => setFlashId(null), 3200)
      return
    }
    createClient().from('signals').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error || !data) { setDeepNotFound(true); return }
      setDetailFor(data as DBSignal)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const high = signals.filter(s => s.severity === 'high')
  const watch = signals.filter(s => s.severity === 'watch')
  const positive = signals.filter(s => s.severity === 'positive')
  const totalRisk = high.concat(watch).reduce((sum, s) => sum + (s.risk_amount || 0), 0)

  function open360(s: DBSignal) {
    if (!s.account_name) return
    window.dispatchEvent(new CustomEvent('open-a360', { detail: {
      name: s.account_name, contact: '', stage: 'Active', arr: fmtMoney(s.risk_amount) || '--',
      health: 50, signals: 1, daysDark: '--', risk: (s.severity || 'watch').toUpperCase(),
      rep: 'You', lastTouch: s.title || 'Signal detected',
      _needsLoad: true,
    } }))
  }

  // Optimistic: remove from the list immediately, write in the background,
  // restore on failure so nothing silently disappears.
  async function setFlag(s: DBSignal, flag: 'is_snoozed' | 'is_dismissed') {
    if (busyId) return
    setBusyId(s.id)
    const prev = signals
    setSignals(prev.filter(x => x.id !== s.id))
    const { error } = await createClient().from('signals').update({ [flag]: true }).eq('id', s.id)
    if (error) setSignals(prev)
    else router.refresh()
    setBusyId(null)
  }

  async function openDraft(s: DBSignal) {
    setDraftFor(s); setDraft(null); setDraftState('loading'); setCopied(false)
    try {
      const r = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signal_id: s.id }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.body) { setDraftState('error'); return }
      setDraft({ subject: j.subject || '', body: j.body, to: j.to || '' })
      setDraftState('ready')
    } catch { setDraftState('error') }
  }

  function copyDraft() {
    if (!draft) return
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  const mailto = draft
    ? `mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`
    : '#'

  const actionBtn = (label: string, onClick: (e: React.MouseEvent) => void, primary?: boolean) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e) }}
      style={{
        padding: '5px 11px', fontSize: 10.5, fontWeight: 700, borderRadius: 7, cursor: 'pointer',
        fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap',
        background: primary ? 'var(--o)' : 'transparent',
        color: primary ? '#fff' : 'var(--t3)',
        border: primary ? 'none' : '1px solid var(--line)',
      }}>
      {label}
    </button>
  )

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
          <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.65, maxWidth: 320 }}>Connect Gmail, Slack, or Zoom on the Integrations page and Popsicle will surface revenue signals here automatically as your conversations come in.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="dsk-screen on">
      <div className="page-hdr">
        <h1>Live Signals</h1>
        <p>{signals.length} active signal{signals.length === 1 ? '' : 's'}{totalRisk > 0 ? <> · <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmtMoney(totalRisk)} at risk</span></> : null}</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
        <div className="dcard" style={{ padding: '14px 18px', borderLeft: '3px solid var(--danger)' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--danger)' }}>{high.length}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>High Risk</div>
        </div>
        <div className="dcard" style={{ padding: '14px 18px', borderLeft: '3px solid var(--amber)' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--amber)' }}>{watch.length}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>Watch</div>
        </div>
        <div className="dcard" style={{ padding: '14px 18px', borderLeft: '3px solid var(--ok)' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--ok)' }}>{positive.length}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>Positive</div>
        </div>
      </div>

      {/* Signal list - ordered high, watch, positive */}
      <div>
        {[...high, ...watch, ...positive].map(s => {
          const isHigh = s.severity === 'high', isPos = s.severity === 'positive'
          const borderColor = isHigh ? 'var(--danger)' : isPos ? 'var(--ok)' : 'var(--amber)'
          const riskCls = isHigh ? 'rhi' : isPos ? 'rlo' : 'rmd'
          const label = TYPE_LABELS[s.signal_type || ''] || 'Signal'
          const headline = s.title || (label + (s.account_name ? ` - ${s.account_name}` : ''))
          const body = s.description || s.ai_analysis?.summary || ''
          const money = fmtMoney(s.risk_amount)
          const impact = s.impact_pct ? (typeof s.impact_pct === 'number' ? `${s.impact_pct}%` : s.impact_pct) : null
          return (
            <div key={s.id} id={`sig-${s.id}`} onClick={() => open360(s)} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border-soft)', borderLeft: `4px solid ${borderColor}`, borderRadius: 12, padding: '12px 16px', boxShadow: flashId === s.id ? '0 0 0 3px rgba(255,107,53,.45), 0 6px 20px rgba(255,107,53,.25)' : '0 1px 4px rgba(13,10,7,.06)', transition: 'box-shadow .5s ease', marginBottom: 7, cursor: s.account_name ? 'pointer' : 'default', opacity: busyId === s.id ? .5 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--t1)' }}>{headline}</span>
                  <span className={`rp ${riskCls}`} style={{ fontSize: 8 }}>{isHigh ? 'HIGH' : isPos ? 'POSITIVE' : 'WATCH'}</span>
                  {label !== 'Signal' && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>}
                </div>
                {body && <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>{body}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5 }}>
                  {s.account_name && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--t2)' }}>{s.account_name}</span>}
                  {money && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--danger)', fontFamily: "'DM Mono',monospace" }}>{money}{impact ? ` · ${impact}` : ''}</span>}
                  {s.created_at && <span style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'DM Mono',monospace" }}>{timeAgo(s.created_at)}</span>}
                </div>
                {/* Action row */}
                <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
                  {actionBtn('Draft follow-up', () => openDraft(s), true)}
                  {actionBtn('Snooze', () => setFlag(s, 'is_snoozed'))}
                  {actionBtn('Dismiss', () => setFlag(s, 'is_dismissed'))}
                </div>
              </div>
              {s.source_integration && <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--t2)', flexShrink: 0, textTransform: 'capitalize' }}>{s.source_integration}</div>}
            </div>
          )
        })}
      </div>

      {/* Draft modal */}
      {/* Signal detail (deep-linked or opened): full analysis breakdown */}
      {detailFor && (() => {
        const d = detailFor
        const sev = d.severity === 'high' ? 'HIGH' : d.severity === 'positive' ? 'POSITIVE' : 'WATCH'
        const sevColor = d.severity === 'high' ? 'var(--danger)' : d.severity === 'positive' ? 'var(--ok)' : 'var(--amber)'
        const ai = (d.ai_analysis ?? {}) as Record<string, unknown>
        const aiRows = Object.entries(ai)
          .filter(([k, v]) => v != null && v !== '' && typeof v !== 'object' && !['summary', 'recommendation', 'detector'].includes(k))
          .slice(0, 8)
        const inactive = d.is_dismissed ? 'dismissed' : d.is_snoozed ? 'snoozed' : null
        const row = (label: string, val: React.ReactNode) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
            <span style={{ fontSize: 11.5, color: 'var(--t1)', fontWeight: 700, textAlign: 'right', fontFamily: "'DM Mono',monospace" }}>{val}</span>
          </div>
        )
        return (
          <div onClick={() => setDetailFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,9,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: 'var(--surface, #fff)', borderRadius: 16, boxShadow: '0 24px 64px rgba(15,12,9,.25)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: sevColor, padding: '2px 8px', borderRadius: 20, letterSpacing: '.5px' }}>{sev}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{TYPE_LABELS[d.signal_type || ''] || 'Signal'}</span>
                    {inactive && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t4)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase' }}>{inactive}</span>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', lineHeight: 1.35 }}>{d.title || 'Signal'}</div>
                </div>
                <button onClick={() => setDetailFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 18, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ padding: 20, maxHeight: '62vh', overflowY: 'auto' }}>
                {(d.description || ai.summary) ? (
                  <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 14 }}>{d.description || String(ai.summary)}</div>
                ) : null}
                {typeof ai.recommendation === 'string' && ai.recommendation && (
                  <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.55, background: 'rgba(255,107,53,.06)', border: '1px solid rgba(255,107,53,.18)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                    <span style={{ fontWeight: 800, color: 'var(--o)' }}>Recommended: </span>{ai.recommendation}
                  </div>
                )}
                <div style={{ marginBottom: 4 }}>
                  {d.account_name ? row('Account', d.account_name) : null}
                  {d.risk_amount ? row('At risk', fmtMoney(d.risk_amount)) : null}
                  {d.source_integration ? row('Source', d.source_integration) : null}
                  {d.created_at ? row('Detected', new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : null}
                  {aiRows.map(([k, v]) => row(k.replace(/_/g, ' '), String(v)))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                  {!inactive && actionBtn('Draft follow-up', () => { setDetailFor(null); openDraft(d) }, true)}
                  {d.account_name && actionBtn('Open account', () => { setDetailFor(null); open360(d) })}
                  {!inactive && actionBtn('Snooze', () => { setDetailFor(null); setFlag(d, 'is_snoozed') })}
                  {!inactive && actionBtn('Dismiss', () => { setDetailFor(null); setFlag(d, 'is_dismissed') })}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Deep link pointed at a signal that does not exist for this user */}
      {deepNotFound && (
        <div onClick={() => setDeepNotFound(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,9,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: 'var(--surface, #fff)', borderRadius: 16, boxShadow: '0 24px 64px rgba(15,12,9,.25)', padding: '32px 28px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--inset)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', marginBottom: 6 }}>Signal not found</div>
            <div style={{ fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.6, marginBottom: 18 }}>This link points to a signal that does not exist or belongs to a different account. It may have been deleted, or you may be signed in as a different user.</div>
            <button onClick={() => setDeepNotFound(false)} style={{ padding: '9px 22px', borderRadius: 10, background: 'var(--o)', border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit'" }}>Got it</button>
          </div>
        </div>
      )}

      {draftFor && (
        <div onClick={() => setDraftFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,9,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--surface, #fff)', borderRadius: 16, boxShadow: '0 24px 64px rgba(15,12,9,.25)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--t1)' }}>Follow-up draft</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>{draftFor.account_name || ''} · responding to: {draftFor.title || TYPE_LABELS[draftFor.signal_type || ''] || 'signal'}</div>
              </div>
              <button onClick={() => setDraftFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ padding: 20, maxHeight: '60vh', overflowY: 'auto' }}>
              {draftState === 'loading' && (
                <div style={{ textAlign: 'center', padding: '36px 0' }}>
                  <div style={{ width: 36, height: 36, margin: '0 auto 14px', border: '3px solid rgba(255,107,53,.15)', borderTopColor: 'var(--o)', borderRadius: '50%', animation: 'spin .9s linear infinite' }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <div style={{ fontSize: 12.5, color: 'var(--t3)' }}>Writing a draft from the thread and the signal...</div>
                </div>
              )}
              {draftState === 'error' && (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <div style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 700, marginBottom: 6 }}>Could not generate a draft</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16 }}>Give it another try in a moment.</div>
                  <button onClick={() => openDraft(draftFor)} style={{ padding: '9px 18px', background: 'var(--o)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Retry</button>
                </div>
              )}
              {draftState === 'ready' && draft && (
                <>
                  {draft.to && <div style={{ fontSize: 11.5, color: 'var(--t3)', marginBottom: 8 }}>To: <span style={{ fontWeight: 700, color: 'var(--t2)', fontFamily: "'DM Mono',monospace" }}>{draft.to}</span></div>}
                  <input
                    value={draft.subject}
                    onChange={e => setDraft({ ...draft, subject: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--t1)', border: '1px solid var(--line)', borderRadius: 9, marginBottom: 10, fontFamily: "'Outfit',sans-serif", background: 'transparent', boxSizing: 'border-box' }}
                  />
                  <textarea
                    value={draft.body}
                    onChange={e => setDraft({ ...draft, body: e.target.value })}
                    rows={11}
                    style={{ width: '100%', padding: '12px', fontSize: 13, lineHeight: 1.65, color: 'var(--t1)', border: '1px solid var(--line)', borderRadius: 9, resize: 'vertical', fontFamily: "'Outfit',sans-serif", background: 'transparent', boxSizing: 'border-box' }}
                  />
                </>
              )}
            </div>

            {draftState === 'ready' && draft && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => openDraft(draftFor)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: 'var(--t3)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>↻ Regenerate</button>
                <div style={{ display: 'flex', gap: 9 }}>
                  <button onClick={copyDraft} style={{ padding: '10px 16px', background: 'transparent', color: 'var(--t2)', border: '1px solid var(--line)', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                  <a href={mailto} style={{ padding: '10px 16px', background: 'var(--o)', color: '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700, textDecoration: 'none', fontFamily: "'Outfit',sans-serif", boxShadow: '0 3px 12px rgba(255,107,53,.22)' }}>
                    Open in email
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
