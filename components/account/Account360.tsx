'use client'

// Account 360, mobile-parity rebuild on the get_account_360 RPC.
// Architecture (mobile contract): Comms = the EVIDENCE record (one chronological
// multi-channel feed: emails + Slack + calls interleaved), Timeline = the
// JUDGMENT record (signals only). Cross-links both ways. Client-side filters
// ported from the mobile bridge: meeting-artifact classifier + Slack relevance
// rules. Days-dark computed UNFILTERED (snapshot before filters).
// Mount contract unchanged: listens for the global 'open-a360' CustomEvent.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
// Demo data is loaded on demand (dynamic import) so the slide-over, which is
// mounted on every page, does not ship the whole demo dataset to every visitor.
import { DateField } from '@/components/ui/DateField'
import { useEscape } from '@/components/ui/useEscape'
import type { DEMO_PEOPLE as DemoPeopleT, DEMO_CONTRACTS as DemoContractsT } from '@/lib/demo-dataset'
import { orgIdsBrowser } from '@/lib/org'

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

interface Msg { id: string; account_name?: string | null; integration: string | null; sender: string | null; subject: string | null; content: string | null; received_at: string | null; direction: string | null; channel_id: string | null; external_id: string | null; thread_id: string | null }
interface Sig { id: string; account_name?: string | null; corroboration?: { with?: Array<{ signal_id: string; source: string }>; reason?: string } | null; signal_type: string | null; severity: string | null; title: string | null; description: string | null; risk_amount: number | null; source_integration: string | null; source_message_id: string | null; created_at: string | null; status: string | null; ai_analysis: Record<string, unknown> | null; is_dismissed?: boolean }
interface Tr { meeting_id: string | null; meeting_uuid: string; topic: string | null; start_time: string | null; duration: number | null; sentiment: string | null; analysis_confidence: number | null; analyzed_at: string | null }
interface Payload { account: Record<string, unknown>; messages: Msg[]; signals: Sig[]; dismissed_signals: Sig[]; transcripts: Tr[]; baseline: Record<string, unknown> | null; slack_channels: Array<{ channel_id: string; is_external: boolean }>; slack_anchor_sigs: string[] }

const TYPE_LABELS: Record<string, string> = {
  silent_stall: 'Silent Stall', competitor_mention: 'Competitor', legal_loopin: 'Legal', price_flinch: 'Price Flinch',
  champion_change: 'Champion Change', timeline_slip: 'Timeline Slip', reengaged: 'Re-engaged', call_objection: 'Objection',
  call_sentiment_drop: 'Sentiment Drop', call_buying_signal: 'Buying Signal', call_commitment: 'Commitment',
  call_summary: 'Call Summary', meeting_cancelled: 'Meeting Cancelled', meeting_declined: 'Meeting Declined',
  deal_stage_backward: 'Stage Backward', commitment_overdue: 'Commitment Overdue',
}
const SRC_LABEL: Record<string, string> = { gmail: 'Email', slack: 'Slack message', zoom: 'Call · Zoom', meet: 'Call · Meet', fireflies: 'Call · Fireflies' }

function fmtMoney(v?: number | null) { if (!v) return null; return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${v}` }
function dayKey(iso: string) { const d = new Date(iso); const t = new Date(); t.setHours(0,0,0,0); const y = new Date(t); y.setDate(y.getDate() - 1); const dd = new Date(d); dd.setHours(0,0,0,0); if (dd.getTime() === t.getTime()) return 'Today'; if (dd.getTime() === y.getTime()) return 'Yesterday'; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function hhmm(iso: string) { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
const slackChannelOf = (m: Msg) => m.channel_id || (m.external_id ? m.external_id.replace(/:[^:]*$/, '') : null)
const slackTsOf = (m: Msg) => { const raw = m.external_id?.split(':').pop(); const n = raw ? parseFloat(raw) : NaN; return isNaN(n) ? (m.received_at ? new Date(m.received_at).getTime() : 0) : n * 1000 }


// ---------- Commitments (state lives in the commitments TABLE; ai_analysis is
// the immutable extraction record). "Looks done?" nudges come from the
// commitment_suggestions view; the user always decides - never auto-closed.
// Dismissals persist in commitment_evidence. ----------
interface Cm { id: string; text: string; owner: string | null; due_at: string | null; promised_at: string | null; status: string; done_at: string | null; source_signal_id: string | null }
interface Sugg { evidence_id: string; commitment_id: string; strength: string; span: string | null; evidence_at: string | null; evidence_source: string | null; evidence_subject: string | null }


function CommitmentsPanel({ account, onOpenSignal }: { account: string; onOpenSignal: (id: string) => void }) {
  const [items, setItems] = useState<Cm[] | null>(null)
  const [suggs, setSuggs] = useState<Sugg[]>([])
  const [showClosed, setShowClosed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [newOwner, setNewOwner] = useState<'us' | 'them'>('us')
  const [addErr, setAddErr] = useState('')
  const [newDue, setNewDue] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    const supa = createClient()
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return
    const [{ data: cms }, { data: sg }] = await Promise.all([
      supa.from('commitments').select('id, text, owner, due_at, promised_at, status, done_at, source_signal_id')
        .in('user_id', await orgIdsBrowser(supa, user.id)).eq('account_name', account).order('due_at', { ascending: true, nullsFirst: false }).limit(60),
      supa.from('commitment_suggestions').select('evidence_id, commitment_id, strength, span, evidence_at, evidence_source, evidence_subject')
        .in('user_id', await orgIdsBrowser(supa, user.id)).eq('account_name', account).limit(30),
    ])
    setItems((cms as Cm[]) ?? [])
    setSuggs((sg as Sugg[]) ?? [])
  }
  useEffect(() => { setItems(null); load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [account])

  async function setStatus(cm: Cm, status: 'done' | 'dropped', evidenceId?: string) {
    setBusy(cm.id)
    const supa = createClient()
    const patch: Record<string, unknown> = { status }
    if (status === 'done') patch.done_at = new Date().toISOString()
    await supa.from('commitments').update(patch).eq('id', cm.id)
    if (evidenceId) await supa.from('commitment_evidence').update({ verdict: 'confirmed', adjudicated_at: new Date().toISOString() }).eq('id', evidenceId).then(() => {}, () => {})
    setBusy(null); load()
  }
  async function notDone(sg: Sugg) {
    setBusy(sg.commitment_id)
    await createClient().from('commitment_evidence').update({ verdict: 'dismissed', dismissed_at: new Date().toISOString(), adjudicated_at: new Date().toISOString() }).eq('id', sg.evidence_id)
    setBusy(null); load()
  }
  async function addManual() {
    const text = newText.trim(); if (!text) return
    setBusy('new')
    const supa = createClient()
    const { data: { user } } = await supa.auth.getUser()
    if (user) {
      // text_hash is a generated column: never send it. Check the result; only clear the form if it saved.
      const { error } = await supa.from('commitments').insert({
        user_id: user.id, account_name: account, text, owner: newOwner,
        due_at: newDue ? new Date(newDue + 'T09:00:00').toISOString() : null, promised_at: new Date().toISOString(),
        source: 'manual', status: 'open', backfilled: false,
      })
      if (error) { setBusy(null); setAddErr(`Couldn\u2019t save: ${error.message}`); return }
    }
    setAddErr(''); setNewText(''); setNewDue(''); setAdding(false); setBusy(null); load()
  }

  if (!items) return <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--t3)' }}>Loading commitments...</div>
  const open = items.filter(c => c.status === 'open')
  const closed = items.filter(c => c.status !== 'open')
  const suggByCm = new Map<string, Sugg>()
  for (const sg of suggs) if (!suggByCm.has(sg.commitment_id)) suggByCm.set(sg.commitment_id, sg)
  const dueState = (c: Cm) => {
    if (!c.due_at) return { txt: 'No date', color: 'var(--t4)' }
    const d = Math.ceil((new Date(c.due_at).getTime() - Date.now()) / 86400000)
    if (d < 0) return { txt: `${-d}d overdue`, color: 'var(--danger)' }
    if (d === 0) return { txt: 'Due today', color: 'var(--amber)' }
    return { txt: `Due in ${d}d`, color: 'var(--t3)' }
  }
  const btn = (label: string, onClick: () => void, primary?: boolean) => (
    <button onClick={onClick} style={{ fontSize: 10.5, fontWeight: 700, padding: '5px 12px', borderRadius: 8, border: primary ? 'none' : '1px solid var(--border)', background: primary ? 'var(--o)' : 'var(--surface, #fff)', color: primary ? '#fff' : 'var(--t2)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>{label}</button>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.7px' }}>{open.length} open commitment{open.length === 1 ? '' : 's'}</div>
        {btn(adding ? 'Cancel' : '+ Add manual', () => setAdding(a => !a))}
      </div>
      {adding && (
        <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <input value={newText} onChange={e => setNewText(e.target.value)} placeholder="What was promised?" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, marginBottom: 8, background: 'var(--bg, #FBF8F3)', color: 'var(--t1)', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={newOwner} onChange={e => setNewOwner(e.target.value as 'us' | 'them')} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11.5, background: 'var(--bg, #FBF8F3)', color: 'var(--t1)' }}>
              <option value="us">We promised</option><option value="them">They promised</option>
            </select>
            <DateField value={newDue} onChange={setNewDue} placeholder="Due date" />
            {btn(busy === 'new' ? 'Saving...' : 'Save', addManual, true)}
          </div>
        </div>
      )}
      {addErr && <div style={{ fontSize: 13, color: 'var(--critical, #c43d2b)', padding: '8px 0' }}>{addErr}</div>}
      {open.length === 0 && !adding && <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 12.5, color: 'var(--t4)' }}>No open commitments for this account.</div>}
      {open.map(c => {
        const ds = dueState(c)
        const sg = suggByCm.get(c.id)
        return (
          <div key={c.id} style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border-soft, var(--border))', borderRadius: 12, padding: '12px 15px', marginBottom: 8, opacity: busy === c.id ? .6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 20, flexShrink: 0, marginTop: 1, background: c.owner === 'them' ? 'rgba(255,107,53,.08)' : 'var(--inset, #F4EFE7)', color: c.owner === 'them' ? 'var(--o)' : 'var(--t2)', textTransform: 'uppercase' }}>{c.owner === 'them' ? 'They' : c.owner === 'us' ? 'We' : '?'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.45 }}>{c.text}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: ds.color, fontFamily: "'DM Mono',monospace" }}>{ds.txt}</span>
                  {c.promised_at && <span style={{ fontSize: 10, color: 'var(--t4)' }}>promised {new Date(c.promised_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  {c.source_signal_id && <button onClick={() => onOpenSignal(c.source_signal_id!)} style={{ fontSize: 10, fontWeight: 700, color: 'var(--o)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View source →</button>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {btn('Done', () => setStatus(c, 'done'))}
                {btn('Drop', () => setStatus(c, 'dropped'))}
              </div>
            </div>
            {sg && (
              <div style={{ marginTop: 10, padding: '10px 13px', background: 'rgba(42,157,92,.05)', border: '1px solid rgba(42,157,92,.18)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ok)' }}>Looks done?</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 20 }}>{sg.strength === 'likely_delivered' ? 'Likely delivered' : 'Possible match'}</span>
                  <span style={{ fontSize: 9.5, color: 'var(--t4)', marginLeft: 'auto' }}>{sg.evidence_source || ''}{sg.evidence_at ? ` · ${new Date(sg.evidence_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span>
                </div>
                {sg.span && <div style={{ fontSize: 11.5, color: 'var(--t2)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 8 }}>&ldquo;{sg.span}&rdquo;</div>}
                {sg.evidence_subject && <div style={{ fontSize: 10, color: 'var(--t4)', marginBottom: 8 }}>{sg.evidence_subject}</div>}
                <div style={{ display: 'flex', gap: 6 }}>
                  {btn('Mark done', () => setStatus(c, 'done', sg.evidence_id), true)}
                  {btn('Not done', () => notDone(sg))}
                </div>
              </div>
            )}
          </div>
        )
      })}
      {closed.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setShowClosed(v => !v)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 10.5, fontWeight: 700, color: 'var(--t3)', cursor: 'pointer' }}>{showClosed ? 'Hide' : 'Show'} {closed.length} closed</button>
          {showClosed && closed.slice(0, 10).map(c => (
            <div key={c.id} style={{ fontSize: 11.5, color: 'var(--t3)', padding: '7px 0', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8 }}>
              <span style={{ color: c.status === 'done' ? 'var(--ok)' : 'var(--t4)', fontWeight: 800 }}>{c.status === 'done' ? '✓' : '✕'}</span>
              <span style={{ textDecoration: 'line-through', opacity: .8 }}>{c.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Account360() {
  const router = useRouter()
  const [openFor, setOpenFor] = useState<{ id?: string; name: string } | null>(null)
  useEscape(!!openFor, () => setOpenFor(null))
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(false)
  const [demoPeople, setDemoPeople] = useState<(typeof DemoPeopleT)[string]>([])
  const [demoContracts, setDemoContracts] = useState<(typeof DemoContractsT)[string]>([])
  const [tab, setTab] = useState<'comms' | 'timeline' | 'commitments' | 'people' | 'contracts'>('comms')
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
      // Demo accounts have non-uuid ids and no rows in the database: build the
      // payload locally so the slide-over works identically in the demo.
      const isDemoId = String(openFor!.id).startsWith('demo-') || document.body.dataset.demo === '1'
      const demoAcct = isDemoId ? await import('@/lib/demo-dataset').then(m => {
        const a = m.DEMO_ACCOUNTS.find(x => x.id === openFor!.id || x.name === openFor!.name)
        if (a) { setDemoPeople(m.DEMO_PEOPLE[a.name] ?? []); setDemoContracts(m.DEMO_CONTRACTS[a.name] ?? []) }
        return a ? { acct: a, sigs: (m.DEMO_SIGNALS as unknown as Sig[]).filter(x => x.account_name === a.name), msgs: (m.DEMO_MESSAGES as unknown as Msg[]).filter(x => x.account_name === a.name).slice(0, 30) } : null
      }) : null
      if (demoAcct) {
        const { acct: demoAccount, sigs, msgs } = demoAcct
        if (!dead) {
          setData({
            account: demoAccount as unknown as Record<string, unknown>,
            messages: msgs, signals: sigs, dismissed_signals: [], transcripts: [],
            baseline: null, slack_channels: [], slack_anchor_sigs: [],
          })
          setLoading(false)
        }
        return
      }
      const supa = createClient()
      // Only real UUIDs may reach the RPC - demo/static ids (e.g. 'acme') would
      // 400 at the database. Non-uuid ids fall back to name resolution.
      const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let id = openFor!.id && UUID.test(openFor!.id) ? openFor!.id : undefined
      if (!id && openFor!.name) {
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
            {(['comms', 'people', 'timeline', 'commitments', 'contracts'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '9px 16px', fontSize: 12, fontWeight: 800, color: tab === t ? 'var(--o)' : 'var(--t3)', background: 'none', border: 'none', borderBottom: tab === t ? '2.5px solid var(--o)' : '2.5px solid transparent', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", textTransform: 'capitalize' }}>{t === 'comms' ? 'Comms' : t === 'timeline' ? 'Timeline' : t === 'commitments' ? 'Commitments' : t === 'people' ? 'People' : 'Contracts'}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 24px 28px' }}>
          {loading && (
            <div>
              {[80, 62, 71].map((w, i) => (
                <div key={i} style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border-soft, var(--border))', borderRadius: 12, padding: '13px 15px', marginBottom: 8, animation: 'pulse 1.6s ease-in-out infinite', animationDelay: `${i * .18}s` }}>
                  <div style={{ height: 11, width: `${w}%`, background: 'var(--inset, #F4EFE7)', borderRadius: 6, marginBottom: 8 }}></div>
                  <div style={{ height: 9, width: `${w - 25}%`, background: 'var(--inset, #F4EFE7)', borderRadius: 6 }}></div>
                </div>
              ))}
            </div>
          )}
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

          {/* ============ PEOPLE ============ */}
          {!loading && data && tab === 'people' && (() => {
            const ppl = demoPeople
            if (!ppl.length) return <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12.5, color: 'var(--ink-faint)' }}>No contact roles recorded for this account yet.</div>
            const badgeColor = (b: string) => b === 'CHAMPION' ? 'var(--good, #2f8f5b)' : b === 'BLOCKER' || b === 'DECISION MAKER' ? 'var(--critical, #c43d2b)' : 'var(--blue, #2f6f9f)'
            return (
              <div>
                {ppl.map(person => (
                  <div key={person.name} style={{ padding: '18px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{person.name}</span>
                      <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{person.role}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '1.2px', color: badgeColor(person.badge) }}>{person.badge}</span>
                      <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{person.last}</span>
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.55, marginTop: 6 }}>{person.desc}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                      <span style={{ flex: 1, height: 3, background: 'var(--hairline, #EFEAE1)', position: 'relative', maxWidth: 220 }}>
                        <span style={{ position: 'absolute', inset: 0, width: `${person.eng}%`, background: person.eng >= 70 ? 'var(--good, #2f8f5b)' : person.eng >= 40 ? 'var(--warn, #d38b1d)' : 'var(--critical, #c43d2b)' }} />
                      </span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{person.eng}% engaged · {person.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* ============ CONTRACTS ============ */}
          {!loading && data && tab === 'contracts' && (() => {
            const cons = demoContracts
            if (!cons.length) return <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12.5, color: 'var(--ink-faint)' }}>No contracts on file for this account.</div>
            return (
              <div>
                {cons.map(c => (
                  <div key={c.name} style={{ padding: '18px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '1.2px', color: c.status.includes('DUE') || c.status.includes('PENDING') ? 'var(--warn, #d38b1d)' : 'var(--good, #2f8f5b)' }}>{c.status}</span>
                      <span style={{ marginLeft: 'auto', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: '-.03em', color: 'var(--ink)' }}>{c.value}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4 }}>{c.type}</div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 10, fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>
                      <span>{c.po}</span><span>{c.start} → {c.end}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 8 }}>{c.invoice}</div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* ============ COMMITMENTS: promises with state ============ */}
          {!loading && data && tab === 'commitments' && (
            <CommitmentsPanel account={acc.name || openFor.name} onOpenSignal={(id) => { close(); router.push(`/signals?signal=${id}`) }} />
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
                        {sg.status === 'snoozed' && <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--t4)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20 }}>SNOOZED</span>}
                        {sg.corroboration?.with?.length ? <span onClick={() => { close(); router.push(`/signals?signal=${sg.corroboration!.with![0].signal_id}`) }} title={sg.corroboration.reason || ''} style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20, cursor: 'pointer' }}>Corroborated · {Array.from(new Set([sg.source_integration, ...sg.corroboration.with.map(w => w.source)].filter(Boolean))).join(' + ')}</span> : null}
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
