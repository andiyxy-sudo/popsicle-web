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
  const [contacts, setContacts] = useState<string[]>([])
  const [draftState, setDraftState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [copied, setCopied] = useState(false)
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'needs_scope' | 'error'>('idle')
  const [sendErr, setSendErr] = useState('')
  // Deep link (?signal=<id>): opened detail, row flash, and not-found state
  const [detailFor, setDetailFor] = useState<DBSignal | null>(null)
  const [deepNotFound, setDeepNotFound] = useState(false)
  const [filter, setFilter] = useState<'all' | 'critical' | 'watch' | 'positive'>('all')
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const [modalMode, setModalMode] = useState<'view' | 'handle' | 'remove' | 'assign' | 'snooze'>('view')
  const [handleText, setHandleText] = useState('')
  const [acctOptions, setAcctOptions] = useState<Array<{ id: string; name: string }> | null>(null)
  const [assignPick, setAssignPick] = useState('')
  const [flashId, setFlashId] = useState<string | null>(null)

  useEffect(() => {
    setModalMode('view'); setHandleText(''); setAssignPick('')
  }, [detailFor?.id])

  // hide the floating Ask bar while a sheet is open
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.dataset.modal = (detailFor || draftFor) ? '1' : '0'
    return () => { document.body.dataset.modal = '0' }
  }, [detailFor, draftFor])

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
    if (s.account_name) router.push(`/accounts/${encodeURIComponent(s.account_name)}`)
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
    setContacts([])
    if (s.account_name) {
      createClient().from('account_baselines').select('contact_email')
        .eq('account_name', s.account_name).not('contact_email', 'is', null)
        .order('last_message_at', { ascending: false }).limit(6)
        .then(({ data }) => setContacts(Array.from(new Set(((data ?? []) as Array<{ contact_email: string }>).map(x => x.contact_email.toLowerCase())))))
    }
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
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Live Signals <span style={{ margin: '0 8px' }}>/</span> nothing open</div>
        <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.4vw,44px)', letterSpacing: '-.035em', margin: '18px 0 40px', lineHeight: 1.14, maxWidth: 920, color: 'var(--ink)' }}>
          All quiet. <span style={{ color: 'var(--ink-muted)' }}>Signals appear here as your conversations come in.</span>
        </h1>
        <div className="dcard" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 24px', textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t2)', margin: '12px 0 6px' }}>No signals yet</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.65, maxWidth: 320 }}>Connect Gmail, Slack, or Zoom on the Integrations page and Popsicle will surface revenue signals here automatically as your conversations come in.</div>
        </div>
      </div>
    )
  }

  const critical = high
  const totalWatchRisk = watch.reduce((a, x) => a + (Number(x.risk_amount) || 0), 0)
  const posValue = positive.reduce((a, x) => a + (Number(x.risk_amount) || 0), 0)
  const newest = mounted && signals[0]?.created_at ? timeAgo(signals[0].created_at) : ''
  const srcCount = new Set(signals.map(x => x.source_integration).filter(Boolean)).size
  const shown = filter === 'critical' ? critical : filter === 'watch' ? watch : filter === 'positive' ? positive : [...critical, ...watch, ...positive]
  const ACTION_LABEL: Record<string, string> = {
    silent_stall: 'Follow up', call_objection: 'Send redline', price_flinch: 'Share ROI sheet',
    competitor_mention: 'Send comparison', legal_loopin: 'Send redline', champion_change: 'Map contact',
    timeline_slip: 'Confirm date', meeting_cancelled: 'Rebook', meeting_declined: 'Rebook',
    deal_stage_backward: 'Book exec call', call_buying_signal: 'Fast-track', call_commitment: 'Confirm in writing',
    reengaged: 'Fast-track', commitment_overdue: 'Close it out', call_sentiment_drop: 'Book exec call',
  }

  return (
    <div className="dsk-screen on">
      {/* breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', minHeight: 30 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          Live Signals <span style={{ margin: '0 8px' }}>/</span> {signals.length} active{srcCount ? ` · ${srcCount} sources` : ''}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className="sig-pulse" style={{ width: 6, height: 6, display: 'inline-block', borderRadius: '50%', background: 'var(--accent)' }} />
          live{newest ? ` · ${newest}` : ''}
        </div>
      </div>

      {/* narrative headline */}
      <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.4vw,44px)', letterSpacing: '-.035em', margin: '18px 0 0', lineHeight: 1.14, maxWidth: 920, color: 'var(--ink)' }}>
        {critical.length > 0 ? (
          <>{critical.length === 1 ? 'One critical signal sits on the' : `${critical.length} critical signals sit on the`}{' '}
            {totalRisk > 0 && <span style={{ color: 'var(--critical, #c43d2b)' }}>{fmtMoney(totalRisk)}</span>} at risk right now.{' '}
            <span style={{ color: 'var(--ink-muted)' }}>
              {positive.length > 0 ? <>{positive[0].account_name || 'One account'} is the bright spot: <span style={{ color: 'var(--good, #2f8f5b)' }}>{(positive[0].title || '').toLowerCase()}</span>.</> : <>Nothing positive is in play yet.</>}
            </span>
          </>
        ) : watch.length > 0 ? (
          <>No critical signals today. <span style={{ color: 'var(--ink-muted)' }}>{watch.length} worth watching{totalWatchRisk > 0 ? <> across <span style={{ color: 'var(--warn, #d38b1d)' }}>{fmtMoney(totalWatchRisk)}</span> of exposure</> : null}.</span></>
        ) : (
          <>All quiet across your pipeline. <span style={{ color: 'var(--ink-muted)' }}>Nothing needs you right now.</span></>
        )}
      </h1>

      {/* stat row, hairline-divided */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginTop: 40, paddingTop: 26, borderTop: '1px solid var(--rule-strong, #0E0D0B)' }}>
        {[
          { n: String(critical.length), lbl: `critical${totalRisk > 0 ? ` · ${fmtMoney(totalRisk)} at risk` : ''}`, color: 'var(--critical, #c43d2b)' },
          { n: String(watch.length), lbl: `watch${totalWatchRisk > 0 ? ` · ${fmtMoney(totalWatchRisk)} exposure` : ''}`, color: 'var(--warn, #d38b1d)' },
          { n: String(positive.length), lbl: `positive${posValue > 0 ? ` · ${fmtMoney(posValue)} closing` : ''}`, color: 'var(--good, #2f8f5b)' },
          { n: String(signals.length), lbl: 'signals in view', color: 'var(--ink)' },
        ].map((st, i, arr) => (
          <div key={i} style={{ paddingRight: 32 }}>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.045em', fontSize: 40, lineHeight: 1, color: st.color, fontVariantNumeric: 'tabular-nums' }}>{st.n}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 8 }}>{st.lbl}</div>
          </div>
        ))}
      </div>

      {/* section head + filter pills */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 56, paddingBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--ink)' }}>All alerts</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {([['all', 'All', signals.length], ['critical', 'Critical', critical.length], ['watch', 'Watch', watch.length], ['positive', 'Positive', positive.length]] as const).map(([k, lbl, n]) => (
            <button key={k} onClick={() => setFilter(k as typeof filter)} style={{
              font: 'inherit', fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 999, cursor: 'pointer', border: 0,
              background: filter === k ? 'var(--ink)' : 'transparent', color: filter === k ? 'var(--paper, #FBF8F3)' : 'var(--ink-muted)',
            }}>{lbl} <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, opacity: .7 }}>{n}</span></button>
          ))}
        </div>
      </div>

      {/* alert rows */}
      <div style={{ borderTop: '1px solid var(--rule-strong, #0E0D0B)' }}>
        {shown.length === 0 && <div style={{ padding: '28px 0', fontSize: 14, color: 'var(--ink-faint)' }}>Nothing in this filter.</div>}
        {shown.map(s => {
          const isHigh = s.severity === 'high', isPos = s.severity === 'positive'
          const accent = isHigh ? 'var(--critical, #c43d2b)' : isPos ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)'
          const label = TYPE_LABELS[s.signal_type || ''] || 'Signal'
          const body = s.description || s.ai_analysis?.summary || ''
          const quote = typeof s.ai_analysis?.quote === 'string' ? s.ai_analysis.quote : null
          const isHandled = s.status === 'handled'
          const money = fmtMoney(s.risk_amount)
          const action = ACTION_LABEL[s.signal_type || ''] || 'Follow up'
          return (
            <div key={s.id} id={`sig-${s.id}`} onClick={() => setDetailFor(s)}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px 132px', alignItems: 'center', gap: 20,
                padding: '20px 0 20px 18px', borderBottom: '1px solid var(--hairline, #EFEAE1)', position: 'relative', cursor: 'pointer',
                background: flashId === s.id ? 'rgba(255,107,53,.07)' : 'transparent', transition: 'background .5s ease',
                opacity: busyId === s.id ? .5 : isHandled ? .55 : 1 }}>
              <span style={{ position: 'absolute', left: 0, top: 20, bottom: 20, width: 3, background: accent }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
                  {isHandled && <span style={{ color: 'var(--good)', fontWeight: 800, fontSize: 13 }}>✓</span>}
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{s.account_name || 'Unmapped'}</span>
                  <span style={{ fontSize: 13.5, color: accent }}>{label}</span>
                  <span onClick={e => { e.stopPropagation(); setDetailFor(s) }} style={{ fontSize: 13, color: accent, cursor: 'pointer' }}>· why →</span>
                  {s.corroboration?.with?.length ? (
                    <span onClick={e => { e.stopPropagation(); router.push(`/signals?signal=${s.corroboration!.with![0].signal_id}`) }} title={s.corroboration.reason || ''}
                      style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '1.1px', textTransform: 'uppercase', color: 'var(--ink-faint)', cursor: 'pointer' }}>corroborated</span>
                  ) : null}
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.5, marginTop: 5 }}>{quote ? `"${quote}"` : (s.title || body)}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)', marginTop: 7 }}>
                  via {s.source_integration || 'unknown'}{mounted && s.created_at ? ` · ${timeAgo(s.created_at)}` : ''}{money ? ` · ${money}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {isHandled ? (
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.1px', textTransform: 'uppercase', color: 'var(--good)' }}>{s.handled_action || 'handled'}</div>
                ) : money ? (
                  <>
                    <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-.03em', color: accent }}>{money}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--ink-faint)' }}>at risk</div>
                  </>
                ) : null}
              </div>
              <div onClick={e => e.stopPropagation()}>
                {!isHandled && (
                  <button onClick={() => openDraft(s)} style={{
                    font: 'inherit', fontSize: 12.5, fontWeight: 500, padding: '9px 0', width: '100%', borderRadius: 999, border: 0, cursor: 'pointer',
                    background: 'var(--accent-tint, #FFF1EA)', color: 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{action}</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, fontSize: 13 }}>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{shown.length} of {signals.length} alerts</span>
        <span onClick={() => router.push('/ask?q=' + encodeURIComponent('Which of my open signals should I act on first, and why?'))} style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}>Ask AI to prioritise →</span>
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
        // rows only carry what is not already stated above: no account name,
        // no repeated confidence, no source (now a note in the eyebrow)
        const aiRows = Object.entries(ai)
          .filter(([k, v]) => FACT_LABELS[k] && k !== 'confidence' && v != null && v !== '' && typeof v !== 'boolean' && typeof v !== 'object')
          .slice(0, 4)
        const quote = typeof ai.quote === 'string' && ai.quote.trim() ? ai.quote.trim() : null
        const reason = typeof ai.reason === 'string' && ai.reason.trim() ? ai.reason.trim() : null
        const unmapped = !d.account_name || /\(unmapped\)/i.test(d.account_name)
        const cleanAccount = d.account_name ? d.account_name.replace(/\s*\(unmapped\)\s*/i, '').trim() : null
        const topicRaw = typeof ai.topic === 'string' ? ai.topic : ''
        const topic = topicRaw.replace(/^(Zoom|Meet|Fireflies):\s*/i, '').trim()
        const headerTitle = (!unmapped && cleanAccount) ? cleanAccount : (topic || TYPE_LABELS[d.signal_type || ''] || 'Signal')
        const descText = String(d.description || (typeof ai.summary === 'string' ? ai.summary : '') || '').replace(/(call: )(Zoom: |Meet: |Fireflies: )/i, '$1')
        const conf = typeof ai.confidence === 'number' ? ai.confidence : null

        // What the detector actually saw. Prefer the model's own evidence list,
        // fall back to the labelled facts, and never invent a bullet.
        const evidence: string[] = (() => {
          const out: string[] = []
          const ev = ai.evidence
          if (Array.isArray(ev)) for (const e of ev) { if (typeof e === 'string' && e.trim()) out.push(e.trim()) }
          else if (typeof ev === 'string' && ev.trim()) out.push(ev.trim())
          if (quote) out.push(`They said: "${quote}"`)
          for (const [k, v] of aiRows) {
            const label = FACT_LABELS[k]
            if (label && !out.some(x => x.toLowerCase().startsWith(label.toLowerCase()))) out.push(`${label}: ${fmtFact(k, v)}`)
          }
          return out.slice(0, 3)
        })()

        // Why this pattern matters, stated plainly per signal type.
        const PATTERNS: Record<string, string> = {
          silent_stall: 'Accounts that go quiet past their own reply cadence stall far more often than they close.',
          competitor_mention: 'A named competitor in the thread usually means an evaluation is already running.',
          price_flinch: 'Pricing pushback this late typically adds a finance loop and weeks to the close.',
          legal_loopin: 'Once outside counsel joins, review cycles historically add two to three weeks.',
          timeline_slip: 'A second date change is the strongest single predictor of a slipped quarter.',
          deal_stage_backward: 'Stage regressions rarely recover without an executive conversation.',
          meeting_cancelled: 'Cancelled reviews without a rebook are where momentum quietly dies.',
          meeting_declined: 'A declined invite from the decision maker is worth more attention than a quiet week.',
          champion_change: 'A champion change resets the buying case; the new contact has not heard it yet.',
          call_objection: 'Objections raised on a call and left unanswered tend to resurface at signature.',
          call_sentiment_drop: 'A sentiment drop mid-cycle usually precedes a slower reply cadence.',
          call_buying_signal: 'Explicit buying language is the cheapest moment to ask for the next step.',
          reengaged: 'Re-engagement after silence is a short window; it closes again quickly.',
          commitment_overdue: 'Overdue promises are the most common reason a deal quietly loses trust.',
        }
        const pattern = PATTERNS[d.signal_type || ''] || null
        const mlab = { fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: 'var(--ink-faint)' }
        const actionRow = (text: string, go: () => void) => (
          <div onClick={go} key={text}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            <span>{text}</span><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12.5, color: sevColor }}>→</span>
          </div>
        )
        const descDuplicatesTitle = !!topic && descText.toLowerCase().includes(topic.toLowerCase())
        const inactive = d.status === 'deleted' ? 'removed' : d.status === 'handled' ? 'handled' : d.is_dismissed ? 'dismissed' : d.status === 'snoozed' ? 'snoozed' : null
        const row = (label: string, val: React.ReactNode) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
            <span style={{ fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{label}</span>
            <span style={{ fontSize: 13.5, color: 'var(--ink-muted)', textAlign: 'right' }}>{val}</span>
          </div>
        )
        return (
          <div onClick={() => setDetailFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(14,13,11,.42)', backdropFilter: 'blur(3px)', zIndex: 810, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, overflowY: 'auto' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 'min(470px,100%)', maxHeight: '86vh', overflowY: 'auto', background: 'var(--paper, #FBF8F3)', boxShadow: '0 40px 90px -30px rgba(14,13,11,.5)' }}>
              <div style={{ padding: '28px 30px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: sevColor, display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: sevColor }} />{sev} · {TYPE_LABELS[d.signal_type || ''] || 'signal'}{d.source_integration ? ` · via ${d.source_integration}` : ''}
                  </div>
                  <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 23, letterSpacing: '-.03em', margin: '11px 0 0', color: 'var(--ink)' }}>{d.title || TYPE_LABELS[d.signal_type || ''] || 'Signal'}</h2>
                  <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 4 }}>{headerTitle}{inactive ? ` · ${inactive}` : ''}</div>
                </div>
                <button onClick={() => setDetailFor(null)} style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', background: 'none', border: 0, cursor: 'pointer', color: 'var(--ink-faint)', flex: 'none', paddingTop: 4 }}>close</button>
              </div>
              <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '22px 30px 0' }} />
              <div style={{ padding: '20px 28px 24px' }}>
                {conf != null && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
                    <div>
                      <div style={mlab}>AI confidence</div>
                      <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: '-.04em', marginTop: 6, color: sevColor }}>{conf}%</div>
                    </div>
                    <div style={{ flex: 1, maxWidth: 160, paddingBottom: 8 }}>
                      <div style={{ height: 2, background: 'var(--hairline, #EFEAE1)' }}>
                        <div style={{ width: `${conf}%`, height: '100%', background: sevColor }} />
                      </div>
                    </div>
                  </div>
                )}
                {descText && !descDuplicatesTitle ? (
                  <div className="read-prose read-prose-ink" style={{ marginBottom: 16 }}>{descText}</div>
                ) : null}
                {quote && evidence.length === 0 && (
                  <div style={{ paddingLeft: 16, borderLeft: `2px solid ${sevColor}`, marginBottom: 20 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.5px', textTransform: 'uppercase', color: sevColor }}>In their words</div>
                    <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.5, fontStyle: 'italic', marginTop: 8 }}>&ldquo;{quote}&rdquo;</div>
                  </div>
                )}
                {reason && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ink-faint)', paddingBottom: 10, borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>Why this was raised</div>
                    <div className="read-prose" style={{ color: 'var(--ink-muted)', marginTop: 11 }}>{reason}</div>
                  </div>
                )}
                {typeof ai.recommendation === 'string' && ai.recommendation && (
                  <div style={{ paddingLeft: 16, borderLeft: '2px solid var(--accent)', margin: '20px 0' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--accent)' }}>Recommended play</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45, marginTop: 8 }}>{ai.recommendation}</div>
                  </div>
                )}
                {/* the account, source and confidence are already stated above,
                    so the rows carry only what is new */}
                <div style={{ marginBottom: 4 }}>
                  {unmapped && cleanAccount ? row('Account', `${cleanAccount} (not linked yet)`) : null}
                  {d.risk_amount ? row('At risk', fmtMoney(d.risk_amount)) : null}
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
                  <div style={{ marginTop: 18 }}>
                    <div style={{ ...mlab, marginBottom: 2 }}>Suggested actions</div>
                    {!inactive && actionRow('Draft a follow-up email', () => { setDetailFor(null); openDraft(d) })}
                    {!inactive && actionRow('Mark as handled', () => setModalMode('handle'))}
                    {d.signal_type?.startsWith('call') && d.source_message_id && actionRow('View full transcript', () => { setDetailFor(null); router.push(`/transcripts/${encodeURIComponent(d.source_message_id!)}`) })}
                    {d.account_name && !unmapped && actionRow('Open Account 360', () => { setDetailFor(null); open360(d) })}
                    {unmapped && !inactive && actionRow('Assign to an account', () => {
                      setModalMode('assign')
                      if (!acctOptions) {
                        createClient().from('accounts').select('id, name').order('name').limit(300)
                          .then(({ data }) => setAcctOptions((data as Array<{ id: string; name: string }>) ?? []))
                      }
                    })}
                    {!inactive && (
                      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
                        {[['Snooze', () => setModalMode('snooze')], ['Dismiss', () => { setDetailFor(null); setFlag(d, 'is_dismissed') }], ['Remove', () => setModalMode('remove')]].map(([lbl, fn]) => (
                          <button key={String(lbl)} onClick={fn as () => void}
                            style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.3px', textTransform: 'uppercase', background: 'none', border: 0, color: 'var(--ink-faint)', cursor: 'pointer', padding: 0 }}>{String(lbl)}</button>
                        ))}
                      </div>
                    )}
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
        <div onClick={() => setDraftFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(14,13,11,.42)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 620, background: 'var(--paper, #FBF8F3)', padding: '40px 44px 44px', boxShadow: '0 40px 90px -30px rgba(14,13,11,.5)', animation: 'fadeUp .3s both' }}>
            {/* eyebrow + close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: '2.2px', textTransform: 'uppercase', color: 'var(--accent)' }}>ai-drafted · draft email</span>
              <button onClick={() => setDraftFor(null)} style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: '2.2px', textTransform: 'uppercase', color: 'var(--ink-faint)', background: 'none', border: 0, cursor: 'pointer' }}>close</button>
            </div>
            <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 34, letterSpacing: '-.035em', margin: '12px 0 0', color: 'var(--ink)' }}>{draftFor.account_name || 'Draft reply'}</h2>
            <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '22px 0 0' }} />

            {draftState === 'loading' && (
              <div style={{ padding: '56px 0', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', gap: 5 }}>
                  {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', opacity: .5, animation: 'ping 1.4s ease-out infinite', animationDelay: `${i * .18}s` }} />)}
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink-muted)', marginTop: 16 }}>{draftSlow ? 'Still writing, checking every fact against the thread...' : 'Writing a draft from the thread and the signal...'}</div>
              </div>
            )}

            {draftState === 'error' && (
              <div style={{ padding: '44px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>No draft was written</div>
                <div style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto 20px' }}>{draftErr || 'Give it another try in a moment.'}</div>
                <button onClick={() => openDraft(draftFor)} style={{ font: 'inherit', fontSize: 13, fontWeight: 600, padding: '10px 22px', borderRadius: 999, border: 0, background: 'var(--accent-tint, #FFF1EA)', color: 'var(--accent)', cursor: 'pointer' }}>Try again</button>
              </div>
            )}

            {draftState === 'ready' && draft && (
              <>
                {/* recipient row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 15, color: 'var(--ink-muted)' }}>To</span>
                    <input value={draft.to || ''} onChange={e => setDraft({ ...draft, to: e.target.value })} placeholder="recipient@company.com"
                      style={{ flex: 1, minWidth: 0, font: 'inherit', fontSize: 15, fontWeight: 500, color: 'var(--ink)', border: 0, outline: 0, background: 'transparent', padding: 0 }} />
                  </span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                    via {draftFor.source_integration === 'gmail' && draftFor.source_message_id ? 'gmail · thread' : 'gmail · new'}
                  </span>
                </div>

                {contacts.filter(c => c !== (draft.to || '').toLowerCase()).length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>known</span>
                    {contacts.filter(c => c !== (draft.to || '').toLowerCase()).slice(0, 4).map(c => (
                      <span key={c} onClick={() => setDraft(d => d ? (!d.to ? { ...d, to: c } : { ...d, cc: d.cc ? `${d.cc}, ${c}` : c }) : d)}
                        style={{ fontSize: 12.5, color: 'var(--accent)', cursor: 'pointer' }}>{c}</span>
                    ))}
                  </div>
                )}

                <input value={draft.cc || ''} onChange={e => setDraft({ ...draft, cc: e.target.value })} placeholder="Cc (optional)"
                  style={{ width: '100%', font: 'inherit', fontSize: 13, color: 'var(--ink-muted)', border: 0, borderBottom: '1px solid var(--hairline, #EFEAE1)', outline: 0, background: 'transparent', padding: '12px 0' }} />

                {/* subject as the statement line */}
                <input value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })}
                  style={{ width: '100%', font: 'inherit', fontSize: 19, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ink)', border: 0, outline: 0, background: 'transparent', padding: '24px 0 16px' }} />

                {/* body */}
                <textarea value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} rows={11}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '22px 26px', fontSize: 15.5, lineHeight: 1.75, color: 'var(--ink)', background: '#FFFDFA', border: '1px solid var(--hairline, #EFEAE1)', borderRadius: 0, outline: 'none', resize: 'vertical', fontFamily: "'Outfit',sans-serif", display: 'block' }} />

                {draft.provenance && (
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-faint)', marginTop: 12 }}>
                    grounded in {draft.provenance.grounded_in.join(' + ')}{draft.provenance.thread_messages ? ` · ${draft.provenance.thread_messages} messages` : ''} · facts checked
                  </div>
                )}

                {/* actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 30, flexWrap: 'wrap' }}>
                  {sendState === 'needs_scope' ? (
                    <button onClick={() => { setDraftFor(null); router.push('/integrations') }} style={{ font: 'inherit', fontSize: 15, fontWeight: 600, padding: '15px 34px', borderRadius: 999, border: 0, background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', cursor: 'pointer', boxShadow: '0 10px 26px -12px rgba(255,107,53,.7)' }}>Reconnect Gmail</button>
                  ) : (
                    <button onClick={sendNow} disabled={sendState === 'sending' || sendState === 'sent' || !draft.to}
                      style={{ font: 'inherit', fontSize: 15, fontWeight: 600, padding: '15px 34px', borderRadius: 999, border: 0, cursor: sendState === 'sending' ? 'default' : 'pointer', color: '#fff',
                        background: sendState === 'sent' ? 'var(--good, #2f8f5b)' : 'linear-gradient(135deg,#FF8A50,#FF6B35)',
                        boxShadow: '0 10px 26px -12px rgba(255,107,53,.7)', opacity: sendState === 'sending' ? .75 : 1 }}>
                      {sendState === 'sending' ? 'Sending...' : sendState === 'sent' ? 'Sent' : 'Send now'}
                    </button>
                  )}
                  <button onClick={copyDraft} style={{ font: 'inherit', fontSize: 15, fontWeight: 600, padding: '15px 30px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--raised, #FFFDFA)', color: 'var(--ink)', cursor: 'pointer' }}>{copied ? 'Copied' : 'Copy'}</button>
                  <button onClick={() => openDraft(draftFor)} style={{ font: 'inherit', fontSize: 15, fontWeight: 500, padding: '15px 30px', borderRadius: 999, border: 0, background: 'var(--inset, #F0EDE7)', color: 'var(--ink-faint)', cursor: 'pointer' }}>Rewrite</button>
                  {sendState === 'error' && <span style={{ fontSize: 13, color: 'var(--critical, #c43d2b)' }}>{sendErr}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
