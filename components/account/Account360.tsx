'use client'

// Account 360 — mobile-parity rebuild on the get_account_360 RPC.
// Architecture (mobile contract): Comms = the EVIDENCE record (one chronological
// multi-channel feed: emails + Slack + calls interleaved), Timeline = the
// JUDGMENT record (signals only). Cross-links both ways. Client-side filters
// ported from the mobile bridge: meeting-artifact classifier + Slack relevance
// rules. Days-dark computed UNFILTERED (snapshot before filters).
// Mount contract unchanged: listens for the global 'open-a360' CustomEvent.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ---------- meeting-artifact classifier (port of _shared/messageArtifact.ts
// per the mobile contract's 5 rule families; the DB column is informational,
// this classifier is authoritative for display) ----------
const NOTETAKER_SENDERS = ['fred@fireflies.ai', 'fireflies.ai', 'otter.ai', 'assistant@otter.ai', 'meetgeek.ai', 'notes@tldv.io', 'tldv.io', 'no-reply@zoom.us', 'noreply-transcripts', 'gemini-notes', 'notetaker']
const CALENDAR_SENDERS = ['calendar-notification@google.com', 'calendar@google.com', 'no-reply@calendar', 'invitations@', 'calendly.com', 'scheduling@']
const INVITE_SUBJECTS = [/^invitation:/i, /^updated invitation:/i, /^cancell?ed event:/i, /^declined:/i, /^accepted:/i, /^tentatively accepted:/i, /^canceled:/i]
const RECAP_SUBJECTS = [/meeting recap/i, /your meeting notes/i, /meeting summary/i, /call recording/i, /transcript.*ready/i, /notes from your/i, /recap:/i]
const BODY_MARKERS = [/view meeting recap/i, /powered by fireflies/i, /this event has been (updated|cancell?ed)/i, /join with google meet/i, /when:[\s\S]*calendar/i]

function isMeetingArtifact(sender?: string | null, subject?: string | null, body?: string | null): boolean {
  const s = (sender || '').toLowerCase()
  const sub = subject || ''
  if (NOTETAKER_SENDERS.some(x => s.includes(x))) return true
  if (CALENDAR_SENDERS.some(x => s.includes(x))) return true
  if (INVITE_SUBJECTS.some(r => r.test(sub))) return true
  if (RECAP_SUBJECTS.some(r => r.test(sub))) return true
  const b = (body || '').slice(0, 4000)
  if (b && BODY_MARKERS.some(r => r.test(b))) return true
  return false
}

// Mirrors slack-detect's chunker window (mobile contract).
const CHUNK_GAP_MS = 30 * 60 * 1000

interface Msg { id: string; integration: string | null; sender: string | null; subject: string | null; content: string | null; received_at: string | null; direction: string | null; channel_id: string | null; external_id: string | null; thread_id: string | null }
interface Sig { id: string; signal_type: string | null; severity: string | null; title: string | null; description: string | null; risk_amount: number | null; source_integration: string | null; source_message_id: string | null; created_at: string | null; status: string | null; ai_analysis: Record<string, unknown> | null; is_dismissed?: boolean }
interface Tr { meeting_id: string | null; meeting_uuid: string; topic: string | null; start_time: string | null; duration: number | null; sentiment: string | null; analysis_confidence: number | null; analyzed_at: string | null }
interface Payload { account: Record<string, unknown>; messages: Msg[]; signals: Sig[]; dismissed_signals: Sig[]; transcripts: Tr[]; baseline: Record<string, unknown> | null; slack_channels: Array<{ channel_id: string; is_external: boolean }>; slack_anchor_sigs: string[] }

const TYPE_LABELS: Record<string, string> = {
  silent_stall: 'Silent Stall', competitor_mention: 'Competitor', legal_loopin: 'Legal', price_flinch: 'Price Flinch',
  champion_change: 'Champion Change', timeline_slip: 'Timeline Slip', reengaged: 'Re-engaged', call_objection: 'Objection',
  call_sentiment_drop: 'Sentiment Drop', call_buying_signal: 'Buying Signal', call_commitment: 'Commitment',
  call_summary: 'Call Summary', meeting_cancelled: 'Meeting Cancelled', meeting_declined: 'Meeting Declined',
  deal_stage_backward: 'Stage Backward',
}
const SRC_LABEL: Record<string, string> = { gmail: 'Email', slack: 'Slack message', zoom: 'Call · Zoom', meet: 'Call · Meet', fireflies: 'Call · Fireflies' }

function fmtMoney(v?: number | null) { if (!v) return null; return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${v}` }
function dayKey(iso: string) { const d = new Date(iso); const t = new Date(); t.setHours(0,0,0,0); const y = new Date(t); y.setDate(y.getDate() - 1); const dd = new Date(d); dd.setHours(0,0,0,0); if (dd.getTime() === t.getTime()) return 'Today'; if (dd.getTime() === y.getTime()) return 'Yesterday'; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function hhmm(iso: string) { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
const slackChannelOf = (m: Msg) => m.channel_id || (m.external_id ? m.external_id.replace(/:[^:]*$/, '') : null)
const slackTsOf = (m: Msg) => { const raw = m.external_id?.split(':').pop(); const n = raw ? parseFloat(raw) : NaN; return isNaN(n) ? (m.received_at ? new Date(m.received_at).getTime() : 0) : n * 1000 }

export function Account360() {
  const router = useRouter()
  const [openFor, setOpenFor] = useState<{ id?: string; name: string } | null>(null)
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'comms' | 'timeline'>('comms')
  const [fType, setFType] = useState<string | null>(null)
  const [fSev, setFSev] = useState<string | null>(null)
  const [fStatus, setFStatus] = useState<string | null>(null)
  const [flashMsg, setFlashMsg] = useState<string | null>(null)

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: string; name?: string }
      if (!detail?.name && !detail?.id) return
      setOpenFor({ id: detail.id, name: detail.name || '' })
      setTab('comms'); setFType(null); setFSev(null); setFStatus(null); setData(null)
    }
    window.addEventListener('open-a360', onOpen as EventListener)
    return () => window.removeEventListener('open-a360', onOpen as EventListener)
  }, [])

  useEffect(() => {
    if (!openFor) return
    let dead = false
    setLoading(true)
    async function load() {
      const supa = createClient()
      let id = openFor!.id
      if (!id) {
        const { data: acc } = await supa.from('accounts').select('id').eq('name', openFor!.name).maybeSingle()
        id = acc?.id
      }
      if (!id) { if (!dead) { setLoading(false); setData(null) } ; return }
      const { data: payload } = await supa.rpc('get_account_360', { p_account_id: id })
      if (!dead) { setData((payload as Payload) ?? null); setLoading(false) }
    }
    load()
    return () => { dead = true }
  }, [openFor])

  // ---------- filters (mobile contract) ----------
  const view = useMemo(() => {
    if (!data) return null
    const msgs = data.messages ?? []
    // days-dark snapshot BEFORE filters (team chatter counts as activity)
    const lastAnyISO = msgs[0]?.received_at ?? null
    const chanExternal = new Map<string, boolean>()
    for (const c of (data.slack_channels ?? [])) chanExternal.set(c.channel_id, !!c.is_external)
    const anchors = new Set((data.slack_anchor_sigs ?? []).filter(Boolean))
    const anchorTs = Array.from(anchors).map(a => { const ch = a.replace(/:[^:]*$/, ''); const raw = a.split(':').pop(); const n = raw ? parseFloat(raw) : NaN; return { ch, ts: isNaN(n) ? 0 : n * 1000 } })

    const shown = msgs.filter(m => {
      if (isMeetingArtifact(m.sender, m.subject, m.content)) return false
      const integ = (m.integration || '').toLowerCase()
      if (integ !== 'slack') return true // rule 1
      const ch = slackChannelOf(m)
      if (!ch) return false
      if (chanExternal.get(ch) === true) return true // rule 2
      // rule 3 (internal or untracked -> internal-conservative)
      if (m.external_id && anchors.has(m.external_id)) return true // 3a produced
      if (m.thread_id && anchors.has(`${ch}:${m.thread_id}`)) return true // 3b thread
      const ts = slackTsOf(m)
      if (anchorTs.some(a => a.ch === ch && Math.abs(ts - a.ts) <= CHUNK_GAP_MS)) return true // 3c window
      return false // rule 4
    })

    // signal linkage per message (for cross-link chips)
    const sigByMsgId = new Map<string, Sig>()
    const allSigs = [...(data.signals ?? []), ...(data.dismissed_signals ?? [])]
    for (const sg of allSigs) if (sg.source_message_id) sigByMsgId.set(sg.source_message_id, sg)

    // comms entries: messages + calls interleaved
    type Entry = { kind: 'msg' | 'call'; at: string; msg?: Msg; tr?: Tr; linked?: Sig | null }
    const entries: Entry[] = []
    for (const m of shown) {
      if (!m.received_at) continue
      entries.push({ kind: 'msg', at: m.received_at, msg: m, linked: (m.external_id && sigByMsgId.get(m.external_id)) || sigByMsgId.get(m.id) || null })
    }
    for (const t of (data.transcripts ?? [])) {
      if (!t.start_time) continue
      entries.push({ kind: 'call', at: t.start_time, tr: t, linked: sigByMsgId.get(t.meeting_uuid) || null })
    }
    entries.sort((a, b) => b.at.localeCompare(a.at))

    const daysDark = lastAnyISO ? Math.floor((Date.now() - new Date(lastAnyISO).getTime()) / 86400000) : null
    return { entries, allSigs, daysDark }
  }, [data])

  if (!openFor) return null
  const acc = (data?.account ?? {}) as { name?: string; value?: number; stage?: string; owner?: string; health_score?: number; domain?: string }

  const close = () => { setOpenFor(null); setData(null) }
  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick} style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, border: active ? '1.5px solid var(--o)' : '1px solid var(--border)', background: active ? 'rgba(255,107,53,.08)' : 'var(--surface)', color: active ? 'var(--o)' : 'var(--t3)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>{label}</button>
  )
  const jumpToSource = (sg: Sig) => {
    if ((sg.signal_type || '').startsWith('call') && sg.source_message_id) { close(); router.push(`/transcripts/${encodeURIComponent(sg.source_message_id)}`); return }
    if (sg.source_integration === 'gcal') return // calendar-state evidence: deliberately no link
    setTab('comms')
    const key = sg.source_message_id
    if (!key) return
    setTimeout(() => {
      const el = document.getElementById(`a360-msg-${key}`)
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setFlashMsg(key); setTimeout(() => setFlashMsg(null), 2600) }
    }, 120)
  }

  const timelineSigs = (view?.allSigs ?? []).filter(sg =>
    (!fType || sg.signal_type === fType) && (!fSev || sg.severity === fSev) &&
    (!fStatus || (fStatus === 'open' ? (!sg.status || sg.status === 'open') && !sg.is_dismissed : fStatus === 'handled' ? sg.status === 'handled' : fStatus === 'dismissed' ? !!sg.is_dismissed : true)))
  const typesPresent = Array.from(new Set((view?.allSigs ?? []).map(sg => sg.signal_type).filter(Boolean))) as string[]
  const sevsPresent = Array.from(new Set((view?.allSigs ?? []).map(sg => sg.severity).filter(Boolean))) as string[]

  let lastDay = ''

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,9,.5)', zIndex: 400, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(680px, 94vw)', height: '100%', background: 'var(--bg, #FBF8F3)', boxShadow: '-16px 0 48px rgba(15,12,9,.25)', display: 'flex', flexDirection: 'column' }}>
        {/* header */}
        <div style={{ padding: '18px 24px 0', background: 'var(--surface, #fff)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--t1)', letterSpacing: '-.4px' }}>{acc.name || openFor.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 2 }}>
                {[acc.stage, acc.value ? fmtMoney(Number(acc.value)) : null, acc.owner, view?.daysDark != null ? (view.daysDark === 0 ? 'active today' : `${view.daysDark}d dark`) : null].filter(Boolean).join(' · ') || (loading ? 'Loading...' : acc.domain || '')}
              </div>
            </div>
            <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 19, lineHeight: 1, paddingTop: 2 }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 2, marginTop: 14 }}>
            {(['comms', 'timeline'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '9px 16px', fontSize: 12, fontWeight: 800, color: tab === t ? 'var(--o)' : 'var(--t3)', background: 'none', border: 'none', borderBottom: tab === t ? '2.5px solid var(--o)' : '2.5px solid transparent', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", textTransform: 'capitalize' }}>{t === 'comms' ? 'Comms' : 'Timeline'}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 24px 28px' }}>
          {loading && <div style={{ textAlign: 'center', padding: '48px 0', fontSize: 12.5, color: 'var(--t3)' }}>Loading account...</div>}
          {!loading && !data && <div style={{ textAlign: 'center', padding: '48px 0', fontSize: 12.5, color: 'var(--t3)' }}>Account not found.</div>}

          {/* ============ COMMS: evidence ============ */}
          {!loading && data && tab === 'comms' && (
            <div>
              {(view?.entries ?? []).length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12.5, color: 'var(--t4)' }}>No correspondence yet for this account.</div>}
              {(view?.entries ?? []).map((en, i) => {
                const day = dayKey(en.at)
                const showDay = day !== lastDay; lastDay = day
                const key = en.kind === 'call' ? en.tr!.meeting_uuid : (en.msg!.external_id || en.msg!.id)
                const sent = en.kind === 'call' ? (en.tr!.sentiment || '').toLowerCase() : ''
                return (
                  <div key={i}>
                    {showDay && <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.7px', margin: '16px 0 8px' }}>{day}</div>}
                    <div id={`a360-msg-${key}`} style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border-soft, var(--border))', borderRadius: 12, padding: '11px 15px', marginBottom: 8, boxShadow: flashMsg === key ? '0 0 0 3px rgba(255,107,53,.4)' : '0 1px 4px rgba(13,10,7,.05)', transition: 'box-shadow .4s ease', cursor: en.kind === 'call' ? 'pointer' : 'default' }}
                      onClick={en.kind === 'call' ? () => { close(); router.push(`/transcripts/${encodeURIComponent(en.tr!.meeting_uuid)}`) } : undefined}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--t1)' }}>
                          {en.kind === 'call' ? (en.tr!.topic || 'Call').replace(/^(Zoom|Meet|Fireflies):\s*/i, '') : ((en.msg!.sender || '').replace(/<.*>/, '').trim() || en.msg!.subject || 'Message')}
                        </span>
                        {en.kind === 'msg' && <span style={{ fontSize: 10, color: 'var(--t4)' }}>{en.msg!.direction === 'outbound' ? '↗' : '↙'}</span>}
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--t3)', border: '1px solid var(--border)', padding: '1px 8px', borderRadius: 20 }}>
                          {en.kind === 'call' ? (SRC_LABEL[en.tr!.meeting_id || ''] || 'Call') : (SRC_LABEL[(en.msg!.integration || '').toLowerCase()] || en.msg!.integration || 'Message')}
                        </span>
                        {en.kind === 'call' && en.tr!.duration ? <span style={{ fontSize: 9.5, color: 'var(--t4)', fontFamily: "'DM Mono',monospace" }}>{en.tr!.duration} min</span> : null}
                        {en.kind === 'call' && sent && <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: sent === 'positive' ? 'var(--ok)' : sent === 'negative' ? 'var(--danger)' : 'var(--t4)', padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase' }}>{sent}</span>}
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t4)', fontFamily: "'DM Mono',monospace" }}>{hhmm(en.at)}</span>
                      </div>
                      {en.kind === 'msg' && en.msg!.subject && <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t2)', marginBottom: 3 }}>{en.msg!.subject}</div>}
                      {en.kind === 'msg' && en.msg!.content && <div style={{ fontSize: 11.5, color: 'var(--t2)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{en.msg!.content}</div>}
                      {en.linked && (
                        <button onClick={e => { e.stopPropagation(); close(); router.push(`/signals?signal=${en.linked!.id}`) }} style={{ marginTop: 7, fontSize: 10, fontWeight: 700, color: 'var(--o)', background: 'rgba(255,107,53,.07)', border: '1px solid rgba(255,107,53,.2)', padding: '3px 10px', borderRadius: 20, cursor: 'pointer' }}>⚡ {en.linked.title || 'View signal'}</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ============ TIMELINE: judgment ============ */}
          {!loading && data && tab === 'timeline' && (
            <div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {typesPresent.map(t => chip(TYPE_LABELS[t] || t, fType === t, () => setFType(fType === t ? null : t)))}
                {sevsPresent.map(sv => chip(sv.toUpperCase(), fSev === sv, () => setFSev(fSev === sv ? null : sv)))}
                {['open', 'handled', 'dismissed'].map(st => chip(st, fStatus === st, () => setFStatus(fStatus === st ? null : st)))}
              </div>
              {timelineSigs.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12.5, color: 'var(--t4)' }}>No signals match.</div>}
              {(() => { let lastD = ''; return timelineSigs.map(sg => {
                const day = sg.created_at ? dayKey(sg.created_at) : ''
                const showDay = day && day !== lastD; if (day) lastD = day
                const sevColor = sg.severity === 'high' ? 'var(--danger)' : sg.severity === 'positive' ? 'var(--ok)' : 'var(--amber)'
                const handled = sg.status === 'handled'
                const canLink = !!sg.source_message_id && sg.source_integration !== 'gcal'
                return (
                  <div key={sg.id}>
                    {showDay && <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.7px', margin: '16px 0 8px' }}>{day}</div>}
                    <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border-soft, var(--border))', borderLeft: `4px solid ${sevColor}`, borderRadius: 12, padding: '12px 15px', marginBottom: 8, opacity: handled || sg.is_dismissed ? .6 : 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--t1)', marginBottom: 3 }}>{handled && <span style={{ color: 'var(--ok)' }}>✓ </span>}{sg.title}</div>
                      {sg.description && <div style={{ fontSize: 11.5, color: 'var(--t2)', lineHeight: 1.55, marginBottom: 7 }}>{sg.description}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase' }}>{TYPE_LABELS[sg.signal_type || ''] || 'Signal'}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: sevColor, padding: '2px 8px', borderRadius: 20 }}>{(sg.severity || 'watch').toUpperCase()}</span>
                        {handled && <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--ok)', border: '1px solid rgba(42,157,92,.3)', padding: '2px 8px', borderRadius: 20 }}>HANDLED</span>}
                        {sg.is_dismissed && <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--t4)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20 }}>DISMISSED</span>}
                        {fmtMoney(sg.risk_amount) && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--t2)', fontFamily: "'DM Mono',monospace" }}>{fmtMoney(sg.risk_amount)}</span>}
                        {canLink && <button onClick={() => jumpToSource(sg)} style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: 'var(--o)', background: 'none', border: 'none', cursor: 'pointer' }}>View source →</button>}
                      </div>
                    </div>
                  </div>
                )
              }) })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Compatibility type exports for the legacy loader (lib/account360.ts) ----
// The rebuilt component no longer uses these shapes internally, but the loader
// still imports them; permissive records keep it compiling until it is retired.
export type A360Data = Record<string, any>
export type SigItem = Record<string, any>
export type CommItem = Record<string, any>
export type PersonItem = Record<string, any>
export type TimelineItem = Record<string, any>
