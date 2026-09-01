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
  source_message_id?: string | null
  account_name?: string
  signal_type?: string
  severity?: string
  title?: string
  description?: string
  ai_analysis?: ({ summary?: string; recommendation?: string } & Record<string, unknown>) | null
  is_dismissed?: boolean
  snoozed_until?: string | null
  corroboration?: { concern?: string; with?: Array<{ signal_id: string; source: string; at?: string }>; reason?: string } | null
  status?: string | null
  handled_action?: string | null
  handled_at?: string | null
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

interface Draft { subject: string; body: string; to: string; cc?: string; provenance?: { grounded_in: string[]; thread_messages: number; guards: { digits: string; greeting: string; deliberation: string }; attempts: number } }

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

export function SignalsReal({ signals: initial }: { signals: DBSignal[] }) {
  const router = useRouter()
  const [signals, setSignals] = useState<DBSignal[]>(initial)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Draft modal state
  const [draftFor, setDraftFor] = useState<DBSignal | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [draftErr, setDraftErr] = useState<string>('')
  const [draftSlow, setDraftSlow] = useState(false)
  const [draftState, setDraftState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [copied, setCopied] = useState(false)
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'needs_scope' | 'error'>('idle')
  const [sendErr, setSendErr] = useState('')
  // Deep link (?signal=<id>): opened detail, row flash, and not-found state
  const [detailFor, setDetailFor] = useState<DBSignal | null>(null)
  const [deepNotFound, setDeepNotFound] = useState(false)
  const [modalMode, setModalMode] = useState<'view' | 'handle' | 'remove' | 'assign' | 'snooze'>('view')
  const [handleText, setHandleText] = useState('')
  const [acctOptions, setAcctOptions] = useState<Array<{ id: string; name: string }> | null>(null)
  const [assignPick, setAssignPick] = useState('')
  const [flashId, setFlashId] = useState<string | null>(null)

  useEffect(() => {
    setModalMode('view'); setHandleText(''); setAssignPick('')
  }, [detailFor?.id])

  // Handle /signals?signal=<id> deep links (Slack "Open in Popsicle" etc).
  // If the signal is in the visible list: scroll to it, flash it, open detail.
  // If not (dismissed, snoozed, or older): fetch it directly (RLS keeps this
  // scoped to the signed-in user). Unknown or foreign ids get a friendly
  // not-found panel instead of an error.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const id = q.get('signal')
    if (!id) return
    // &action=reply (Slack "Draft a reply") jumps straight into the AI draft
    // view; anything else (or a signal that is no longer actionable) lands on
    // the detail view. Auth preservation carries the action param through
    // login automatically since proxy.ts keeps the full query string.
    const wantReply = q.get('action') === 'reply'
    const inList = initial.find(x => x.id === id)
    if (inList) {
      if (wantReply) openDraft(inList)
      else setDetailFor(inList)
      setFlashId(id)
      setTimeout(() => {
        document.getElementById(`sig-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 60)
      setTimeout(() => setFlashId(null), 3200)
      return
    }
    createClient().from('signals').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error || !data) { setDeepNotFound(true); return }
      const sig = data as DBSignal
      // Soft-deleted signals are gone as far as users are concerned.
      if (sig.status === 'deleted') { setDeepNotFound(true); return }
      // Reply only makes sense for live signals; handled/dismissed/snoozed
      // fall back to detail so the user sees the state.
      const live = !sig.is_dismissed && (!sig.status || sig.status === 'open')
      if (wantReply && live) openDraft(sig)
      else setDetailFor(sig)
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
  // Snooze = status transition (mobile contract): status='snoozed' + snoozed_until;
  // wake_snoozed_signals cron reopens it. Row leaves every open feed until then.
  async function snooze(s: DBSignal, until: Date) {
    if (busyId) return
    setBusyId(s.id)
    const prev = signals
    setSignals(prev.filter(x => x.id !== s.id))
    setDetailFor(null)
    const { error } = await createClient().from('signals')
      .update({ status: 'snoozed', snoozed_until: until.toISOString() }).eq('id', s.id)
    if (error) setSignals(prev)
    else router.refresh()
    setBusyId(null)
  }
  const tomorrow9 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d }
  const nextWeek9 = () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d }

  async function setFlag(s: DBSignal, flag: 'is_dismissed') {
    if (busyId) return
    setBusyId(s.id)
    const prev = signals
    setSignals(prev.filter(x => x.id !== s.id))
    const { error } = await createClient().from('signals').update({ [flag]: true }).eq('id', s.id)
    if (error) setSignals(prev)
    else router.refresh()
    setBusyId(null)
  }

  async function sendNow() {
    if (!draft || !draftFor || sendState === 'sending') return
    setSendState('sending'); setSendErr('')
    try {
      const supa = createClient()
      const { data: { session } } = await supa.auth.getSession()
      if (!session) { window.location.href = '/login'; return }
      const r = await fetch(`${SUPA_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'send', to: draft.to, cc: draft.cc || '', subject: draft.subject, body: draft.body, signal_id: draftFor.id }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok && data?.ok) {
        setSendState('sent')
        // Close the loop: sending IS handling. Auto-record it.
        markHandled(draftFor, 'Sent follow-up')
        setTimeout(() => { setDraftFor(null); setSendState('idle') }, 1400)
        return
      }
      if (data?.error === 'needs_scope') { setSendState('needs_scope'); return }
      setSendErr(String(data?.detail || data?.error || 'Send failed.'))
      setSendState('error')
    } catch {
      setSendErr('Network error.'); setSendState('error')
    }
  }

  async function markHandled(s: DBSignal, action: string) {
    if (busyId) return
    setBusyId(s.id)
    const patch = { status: 'handled', handled_at: new Date().toISOString(), handled_action: action || 'Handled' }
    const supa = createClient()
    const { data: updated, error } = await supa.from('signals').update(patch).eq('id', s.id).select('id')
    if (!error && (updated?.length ?? 0) > 0) {
      setSignals(prev => prev.map(x => x.id === s.id ? { ...x, ...patch } : x))
      setDetailFor(prev => prev && prev.id === s.id ? { ...prev, ...patch } : prev)
      router.refresh()
      // Broadcast the resolution (mobile contract): Slack ✓ card update and
      // HubSpot deal note, both opt-in, both fire-and-forget.
      try {
        const [{ data: { session } }, { data: { user } }] = await Promise.all([supa.auth.getSession(), supa.auth.getUser()])
        if (session) {
          const hdrs = { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` }
          const actor = (user?.email || 'user').split('@')[0]
          supa.from('integrations').select('provider, slack_post_resolutions, hubspot_log_resolutions')
            .in('provider', ['slack', 'hubspot']).eq('is_active', true)
            .then(({ data: integs }) => {
              const slackOn = (integs ?? []).some(i => i.provider === 'slack' && i.slack_post_resolutions)
              const hsOn = (integs ?? []).some(i => i.provider === 'hubspot' && i.hubspot_log_resolutions)
              if (slackOn) fetch(`${SUPA_URL}/functions/v1/post-to-slack`, { method: 'POST', headers: hdrs, body: JSON.stringify({ signal_id: s.id, action: 'resolve', actor }) }).catch(() => {})
              if (hsOn) fetch(`${SUPA_URL}/functions/v1/oauth-hubspot`, { method: 'POST', headers: hdrs, body: JSON.stringify({ action: 'log-note', signal_id: s.id }) }).catch(() => {})
            })
        }
      } catch { /* broadcasts never block the local transition */ }
    }
    setBusyId(null)
  }

  async function removeSignal(s: DBSignal, reason: string) {
    if (busyId) return
    setBusyId(s.id)
    const prev = signals
    setSignals(prev.filter(x => x.id !== s.id))
    setDetailFor(null)
    const { error } = await createClient().from('signals')
      .update({ status: 'deleted', deleted_reason: reason, deleted_at: new Date().toISOString() }).eq('id', s.id)
    if (error) setSignals(prev)
    else router.refresh()
    setBusyId(null)
  }

  // Assign an unmapped signal to an account. Prefers the shared remap-account
  // edge function (audit-logged, cascades to source); falls back to a direct
  // update + remap_log write if the function rejects the payload.
  async function assignAccount(s: DBSignal, accountId: string, accountName: string) {
    if (busyId) return
    setBusyId(s.id)
    const supa = createClient()
    const { data: { user } } = await supa.auth.getUser()
    const { error } = await supa.from('signals').update({ account_name: accountName }).eq('id', s.id)
    const ok = !error
    if (ok && user) {
      await supa.from('remap_log').insert({
        user_id: user.id, account_id: accountId, entity_type: 'signal', entity_id: s.id,
        method: 'manual_assign', prev_value: s.account_name ?? null,
      }).then(() => {}, () => {})
    }
    if (ok) {
      setSignals(prev => prev.map(x => x.id === s.id ? { ...x, account_name: accountName } : x))
      setDetailFor(prev => prev && prev.id === s.id ? { ...prev, account_name: accountName } : prev)
      router.refresh()
    }
    setBusyId(null)
  }

  async function openDraft(s: DBSignal) {
    setSendState('idle'); setSendErr(''); setDraftErr(''); setDraftSlow(false)
    const slowTimer = setTimeout(() => setDraftSlow(true), 9000)
    setTimeout(() => clearTimeout(slowTimer), 31000)
    setDraftFor(s); setDraft(null); setDraftState('loading'); setCopied(false)
    try {
      const r = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signal_id: s.id }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.body) {
        setDraftErr(j?.error === 'draft_ungrounded'
          ? 'The AI could not write a draft that stays strictly within what the thread and signal actually say, so nothing was shown. Try again, or write it yourself from the signal.'
          : j?.error === 'draft_timeout' ? 'Drafting took too long. Try again in a moment.' : 'Give it another try in a moment.')
        setDraftState('error'); return
      }
      setDraft({ subject: j.subject || '', body: j.body, to: j.to || '', provenance: j.provenance })
      setDraftState('ready')
    } catch { setDraftErr('Give it another try in a moment.'); setDraftState('error') }
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
          const isHandled = s.status === 'handled'
          const impact = s.impact_pct ? (typeof s.impact_pct === 'number' ? `${s.impact_pct}%` : s.impact_pct) : null
          return (
            <div key={s.id} id={`sig-${s.id}`} onClick={() => open360(s)} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border-soft)', borderLeft: `4px solid ${borderColor}`, borderRadius: 12, padding: '12px 16px', boxShadow: flashId === s.id ? '0 0 0 3px rgba(255,107,53,.45), 0 6px 20px rgba(255,107,53,.25)' : '0 1px 4px rgba(13,10,7,.06)', transition: 'box-shadow .5s ease', marginBottom: 7, cursor: s.account_name ? 'pointer' : 'default', opacity: busyId === s.id ? .5 : isHandled ? .55 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
                  {isHandled && <span style={{ color: 'var(--ok)', fontWeight: 900, fontSize: 13 }}>✓</span>}
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--t1)' }}>{headline}</span>
                  {s.corroboration?.with?.length ? (
                    <span onClick={e => { e.stopPropagation(); const sib = s.corroboration!.with![0]; router.push(`/signals?signal=${sib.signal_id}`) }} title={s.corroboration.reason || ''} style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--t3)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20, cursor: 'pointer' }}>
                      Corroborated · {Array.from(new Set([s.source_integration, ...s.corroboration.with.map(w => w.source)].filter(Boolean))).join(' + ')}
                    </span>
                  ) : null}
                  <span className={`rp ${riskCls}`} style={{ fontSize: 8 }}>{isHigh ? 'HIGH' : isPos ? 'POSITIVE' : 'WATCH'}</span>
                  {label !== 'Signal' && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>}
                </div>
                {body && <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>{body}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5 }}>
                  {s.account_name && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--t2)' }}>{s.account_name}</span>}
                  {money && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--danger)', fontFamily: "'DM Mono',monospace" }}>{money}{impact ? ` · ${impact}` : ''}</span>}
                  {s.created_at && <span style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'DM Mono',monospace" }}>{timeAgo(s.created_at)}</span>}
                </div>
                {/* Action row (handled signals show what was done instead) */}
                {isHandled ? (
                  <div style={{ marginTop: 9 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ok)', background: 'rgba(42,157,92,.08)', border: '1px solid rgba(42,157,92,.2)', padding: '3px 10px', borderRadius: 20 }}>✓ {s.handled_action || 'Handled'}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
                    {actionBtn('Draft follow-up', () => openDraft(s), true)}
                    {actionBtn('Mark handled', () => { setDetailFor(s); setModalMode('handle') })}
                    {actionBtn('Snooze', () => { setDetailFor(s); setModalMode('snooze') })}
                    {actionBtn('Dismiss', () => setFlag(s, 'is_dismissed'))}
                  </div>
                )}
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
        // Only show analysis fields that read well to a human, with proper labels.
        const FACT_LABELS: Record<string, string> = {
          sentiment: 'Sentiment', confidence: 'Confidence', days_silent: 'Days silent',
          days: 'Slipped by', old_date: 'Previous close', new_date: 'New close',
          old_stage: 'Previous stage', new_stage: 'New stage', meeting_at: 'Meeting',
          email: 'Contact', last_meeting_at: 'Last meeting', start: 'Scheduled',
        }
        const fmtFact = (k: string, v: unknown): string => {
          if ((k === 'meeting_at' || k === 'last_meeting_at' || k === 'start') && typeof v === 'string') {
            const t = new Date(v); if (!isNaN(t.getTime())) return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          }
          if (k === 'confidence' && typeof v === 'number') return `${v}%`
          if (k === 'days' || k === 'days_silent') return `${v}d`
          return String(v)
        }
        const aiRows = Object.entries(ai)
          .filter(([k, v]) => FACT_LABELS[k] && v != null && v !== '' && typeof v !== 'boolean' && typeof v !== 'object')
          .slice(0, 6)
        const quote = typeof ai.quote === 'string' && ai.quote.trim() ? ai.quote.trim() : null
        const reason = typeof ai.reason === 'string' && ai.reason.trim() ? ai.reason.trim() : null
        const unmapped = !d.account_name || /\(unmapped\)/i.test(d.account_name)
        const cleanAccount = d.account_name ? d.account_name.replace(/\s*\(unmapped\)\s*/i, '').trim() : null
        const topicRaw = typeof ai.topic === 'string' ? ai.topic : ''
        const topic = topicRaw.replace(/^(Zoom|Meet|Fireflies):\s*/i, '').trim()
        const headerTitle = (!unmapped && cleanAccount) ? cleanAccount : (topic || TYPE_LABELS[d.signal_type || ''] || 'Signal')
        const descText = String(d.description || (typeof ai.summary === 'string' ? ai.summary : '') || '').replace(/(call: )(Zoom: |Meet: |Fireflies: )/i, '$1')
        const descDuplicatesTitle = !!topic && descText.toLowerCase().includes(topic.toLowerCase())
        const inactive = d.status === 'deleted' ? 'removed' : d.status === 'handled' ? 'handled' : d.is_dismissed ? 'dismissed' : d.status === 'snoozed' ? 'snoozed' : null
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
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 3 }}>{headerTitle}</div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--t1)', lineHeight: 1.3, letterSpacing: '-.3px' }}>{d.title || TYPE_LABELS[d.signal_type || ''] || 'Signal'}</div>
                </div>
                <button onClick={() => setDetailFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 18, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ padding: 20, maxHeight: '62vh', overflowY: 'auto' }}>
                {descText && !descDuplicatesTitle ? (
                  <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 14 }}>{descText}</div>
                ) : null}
                {quote && (
                  <div style={{ borderLeft: '3px solid var(--o)', background: 'rgba(255,107,53,.05)', borderRadius: '0 10px 10px 0', padding: '10px 14px', marginBottom: 12 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{quote}&rdquo;</div>
                    <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 4, fontWeight: 600 }}>From the call</div>
                  </div>
                )}
                {reason && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 5 }}>Why this signal</div>
                    <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6 }}>{reason}</div>
                  </div>
                )}
                {typeof ai.recommendation === 'string' && ai.recommendation && (
                  <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.55, background: 'rgba(255,107,53,.06)', border: '1px solid rgba(255,107,53,.18)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                    <span style={{ fontWeight: 800, color: 'var(--o)' }}>Recommended: </span>{ai.recommendation}
                  </div>
                )}
                <div style={{ marginBottom: 4 }}>
                  {cleanAccount && !unmapped ? row('Account', cleanAccount) : null}
                  {unmapped && cleanAccount ? row('Account', `${cleanAccount} (not linked yet)`) : null}
                  {d.risk_amount ? row('At risk', fmtMoney(d.risk_amount)) : null}
                  {d.source_integration ? row('Source', d.source_integration.charAt(0).toUpperCase() + d.source_integration.slice(1)) : null}
                  {d.created_at ? row('Detected', new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : null}
                  {aiRows.map(([k, v]) => row(FACT_LABELS[k], fmtFact(k, v)))}
                </div>
                {inactive === 'snoozed' && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', background: 'var(--inset, #F4EFE7)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 14px', marginBottom: 12 }}>
                    Snoozed{d.snoozed_until ? ` until ${new Date(d.snoozed_until).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''} · wakes automatically
                  </div>
                )}
                {inactive === 'handled' && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ok)', background: 'rgba(42,157,92,.08)', border: '1px solid rgba(42,157,92,.2)', borderRadius: 10, padding: '9px 14px', marginBottom: 12 }}>
                    ✓ Handled{d.handled_action ? `: ${d.handled_action}` : ''}{d.handled_at ? ` · ${new Date(d.handled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                  </div>
                )}

                {modalMode === 'handle' && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 12, background: 'var(--bg, #FBF8F3)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t2)', marginBottom: 8 }}>What did you do?</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {['Sent follow-up', 'Called them', 'Scheduled meeting', 'Updated CRM'].map(a => (
                        <button key={a} onClick={() => setHandleText(a)} style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 20, border: handleText === a ? '1.5px solid var(--o)' : '1px solid var(--border)', background: handleText === a ? 'rgba(255,107,53,.08)' : 'var(--surface)', color: 'var(--t2)', cursor: 'pointer' }}>{a}</button>
                      ))}
                    </div>
                    <input value={handleText} onChange={e => setHandleText(e.target.value)} placeholder="Or type what you did" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--surface)', color: 'var(--t1)', outline: 'none', marginBottom: 8 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      {actionBtn('Confirm handled', () => markHandled(d, handleText.trim() || 'Handled'), true)}
                      {actionBtn('Cancel', () => setModalMode('view'))}
                    </div>
                  </div>
                )}

                {modalMode === 'snooze' && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 12, background: 'var(--bg, #FBF8F3)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t2)', marginBottom: 8 }}>Snooze until</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {actionBtn('2 hours', () => snooze(d, new Date(Date.now() + 2 * 3600_000)))}
                      {actionBtn('Tomorrow 9am', () => snooze(d, tomorrow9()))}
                      {actionBtn('Next week', () => snooze(d, nextWeek9()))}
                      {actionBtn('Cancel', () => setModalMode('view'))}
                    </div>
                  </div>
                )}

                {modalMode === 'remove' && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 12, background: 'var(--bg, #FBF8F3)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t2)', marginBottom: 8 }}>Why remove this? It trains detection.</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[['not_a_signal', 'Not a signal'], ['wrong_account', 'Wrong account'], ['duplicate', 'Duplicate'], ['other', 'Other']].map(([k, lbl]) => (
                        <button key={k} onClick={() => removeSignal(d, k)} style={{ fontSize: 10.5, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--t2)', cursor: 'pointer' }}>{lbl}</button>
                      ))}
                      <button onClick={() => setModalMode('view')} style={{ fontSize: 10.5, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: 'none', background: 'none', color: 'var(--t4)', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}

                {modalMode === 'assign' && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 12, background: 'var(--bg, #FBF8F3)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t2)', marginBottom: 8 }}>Assign this signal to an account</div>
                    {!acctOptions ? (
                      <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>Loading accounts...</div>
                    ) : (
                      <div>
                        <select value={assignPick} onChange={e => setAssignPick(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--surface)', color: 'var(--t1)', marginBottom: 8 }}>
                          <option value="">Choose an account</option>
                          {acctOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {actionBtn('Assign', () => { const a = acctOptions.find(x => x.id === assignPick); if (a) { assignAccount(d, a.id, a.name); setModalMode('view') } }, true)}
                          {actionBtn('Cancel', () => setModalMode('view'))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {modalMode === 'view' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                    {!inactive && actionBtn('Draft follow-up', () => { setDetailFor(null); openDraft(d) }, true)}
                    {!inactive && actionBtn('Mark handled', () => setModalMode('handle'))}
                    {d.signal_type?.startsWith('call') && d.source_message_id && actionBtn('View full transcript', () => { setDetailFor(null); router.push(`/transcripts/${encodeURIComponent(d.source_message_id!)}`) })}
                    {d.account_name && !unmapped && actionBtn('Open account', () => { setDetailFor(null); open360(d) })}
                    {unmapped && !inactive && actionBtn('Assign to account', () => {
                      setModalMode('assign')
                      if (!acctOptions) {
                        createClient().from('accounts').select('id, name').order('name').limit(300)
                          .then(({ data }) => setAcctOptions((data as Array<{ id: string; name: string }>) ?? []))
                      }
                    })}
                    {!inactive && actionBtn('Snooze', () => setModalMode('snooze'))}
                    {!inactive && actionBtn('Dismiss', () => { setDetailFor(null); setFlag(d, 'is_dismissed') })}
                    {!inactive && actionBtn('Remove', () => setModalMode('remove'))}
                  </div>
                )}
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
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 580, background: 'var(--bg, #FBF8F3)', borderRadius: 18, boxShadow: '0 28px 72px rgba(15,12,9,.32)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 16px', background: 'linear-gradient(135deg, #FF6B35 0%, #FF8F5C 55%, #FFB088 100%)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.09)' }}></div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,.75)', fontFamily: "'DM Mono',monospace", marginBottom: 4 }}>✦ AI Follow-up</div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: '-.3px' }}>{draftFor.account_name || 'Draft reply'}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.85)', marginTop: 3, lineHeight: 1.45 }}>Responding to: {draftFor.title || TYPE_LABELS[draftFor.signal_type || ''] || 'signal'}</div>
                </div>
                <button onClick={() => setDraftFor(null)} style={{ background: 'rgba(255,255,255,.18)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 15, lineHeight: 1, width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }}>✕</button>
              </div>
            </div>

            <div style={{ padding: 20, maxHeight: '60vh', overflowY: 'auto' }}>
              {draftState === 'loading' && (
                <div style={{ textAlign: 'center', padding: '36px 0' }}>
                  <div style={{ width: 36, height: 36, margin: '0 auto 14px', border: '3px solid rgba(255,107,53,.15)', borderTopColor: 'var(--o)', borderRadius: '50%', animation: 'spin .9s linear infinite' }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <div style={{ fontSize: 12.5, color: 'var(--t3)' }}>{draftSlow ? 'Still writing, checking every fact against the thread...' : 'Writing a draft from the thread and the signal...'}</div>
                </div>
              )}
              {draftState === 'error' && (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <div style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 700, marginBottom: 6 }}>Could not generate a draft</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16, maxWidth: 380, margin: '0 auto 16px', lineHeight: 1.55 }}>{draftErr || 'Give it another try in a moment.'}</div>
                  <button onClick={() => openDraft(draftFor)} style={{ padding: '9px 18px', background: 'var(--o)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Retry</button>
                </div>
              )}
              {draftState === 'ready' && draft && (
                <div style={{ background: 'var(--surface, #fff)', borderRadius: 14, border: '1px solid var(--border-soft, var(--border))', boxShadow: '0 2px 10px rgba(13,10,7,.05)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.6px', width: 52, flexShrink: 0 }}>To</span>
                    <input
                      value={draft.to || ''}
                      onChange={e => setDraft({ ...draft, to: e.target.value })}
                      placeholder="recipient@company.com"
                      style={{ flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 700, color: 'var(--t1)', border: 'none', outline: 'none', fontFamily: "'DM Mono',monospace", background: 'transparent' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.6px', width: 52, flexShrink: 0 }}>Cc</span>
                    <input
                      value={draft.cc || ''}
                      onChange={e => setDraft({ ...draft, cc: e.target.value })}
                      placeholder="optional, comma-separated"
                      style={{ flex: 1, padding: '7px 0', fontSize: 11.5, fontWeight: 600, color: 'var(--t2)', border: 'none', outline: 'none', fontFamily: "'DM Mono',monospace", background: 'transparent' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.6px', width: 52, flexShrink: 0 }}>Subject</span>
                    <input
                      value={draft.subject}
                      onChange={e => setDraft({ ...draft, subject: e.target.value })}
                      style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 800, color: 'var(--t1)', border: 'none', outline: 'none', fontFamily: "'Outfit',sans-serif", background: 'transparent' }}
                    />
                  </div>
                  {draft.provenance && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderBottom: '1px solid var(--line)', background: 'rgba(42,157,92,.04)' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                      <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600 }}>
                        Grounded in {draft.provenance.grounded_in.join(' + ')}{draft.provenance.thread_messages ? ` (${draft.provenance.thread_messages} messages)` : ''} · facts checked{draft.provenance.guards.greeting === 'rewritten' ? ' · greeting adjusted' : ''}
                      </span>
                    </div>
                  )}
                  <textarea
                    value={draft.body}
                    onChange={e => setDraft({ ...draft, body: e.target.value })}
                    rows={12}
                    style={{ width: '100%', padding: '14px 16px', fontSize: 13, lineHeight: 1.7, color: 'var(--t1)', border: 'none', outline: 'none', resize: 'vertical', fontFamily: "'Outfit',sans-serif", background: 'transparent', boxSizing: 'border-box', display: 'block' }}
                  />
                </div>
              )}
            </div>

            {draftState === 'ready' && draft && (
              <div style={{ padding: '13px 22px', borderTop: '1px solid var(--border-soft, var(--border))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface, #fff)' }}>
                <button onClick={() => openDraft(draftFor)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: 0, fontSize: 11.5, fontWeight: 700, color: 'var(--t3)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                  Regenerate
                </button>
                <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                  {sendState === 'needs_scope' && (
                    <span style={{ fontSize: 10.5, color: 'var(--t3)', maxWidth: 210, lineHeight: 1.4 }}>Reconnect Gmail once to enable sending.</span>
                  )}
                  {sendState === 'error' && <span style={{ fontSize: 10.5, color: 'var(--danger)', maxWidth: 200, lineHeight: 1.4 }}>{sendErr}</span>}
                  <button onClick={copyDraft} style={{ padding: '10px 18px', background: 'var(--surface, #fff)', color: 'var(--t2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                  <a href={mailto} style={{ padding: '10px 14px', color: 'var(--t3)', borderRadius: 10, fontSize: 11.5, fontWeight: 700, textDecoration: 'none', fontFamily: "'Outfit',sans-serif" }}>
                    Open in email
                  </a>
                  {sendState === 'needs_scope' ? (
                    <button onClick={() => { setDraftFor(null); router.push('/integrations') }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #FF6B35, #FF8F5C)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", boxShadow: '0 4px 16px rgba(255,107,53,.35)' }}>
                      Reconnect Gmail
                    </button>
                  ) : (
                    <button onClick={sendNow} disabled={sendState === 'sending' || sendState === 'sent' || !draft.to}
                      style={{ padding: '10px 22px', background: sendState === 'sent' ? 'var(--ok)' : 'linear-gradient(135deg, #FF6B35, #FF8F5C)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: sendState === 'sending' ? 'default' : 'pointer', fontFamily: "'Outfit',sans-serif", boxShadow: '0 4px 16px rgba(255,107,53,.35)', opacity: sendState === 'sending' ? .75 : 1 }}>
                      {sendState === 'sending' ? 'Sending...' : sendState === 'sent' ? '✓ Sent' : 'Send email →'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
