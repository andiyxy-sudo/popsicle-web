'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AGENT_BRIEF_DELAY_MS, AGENT_MAX_POPUPS_PER_DAY, AGENT_NAME, ASK_DOCK } from '@/lib/agent/config'
import { agentPopupsOn } from '@/lib/agent/prefs'
import type { AgentBrief, AgentMessage } from '@/lib/agent/compose'
import { money } from '@/lib/agent/compose'
import { AgentNote, Dateline } from './AgentNote'

// The agent putting a note on your desk, on any page. The morning brief (once a day),
// critical items and late promises, and new signals as they land. One note at a time,
// the rest wait their turn. Never over a modal.
const today = () => new Date().toISOString().slice(0, 10)
const LS = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
}
export type LiveSig = { id: string; title: string; account?: string; severity?: string; source?: string; quote?: string; quoteBy?: string; judgment?: string; amount?: number }
type Shown = { kind: 'brief'; brief: AgentBrief } | { kind: 'message'; msg: AgentMessage } | { kind: 'signal'; msg: AgentMessage; sig: LiveSig }

// a live signal as a note
function noteFromSignal(s: LiveSig): AgentMessage {
  const sev = s.severity === 'high' ? 'critical' : 'normal'
  return {
    key: `live:${s.id}`, lane: s.severity === 'positive' ? 'renewals' : s.severity === 'high' ? 'risk' : 'commitments', priority: sev,
    account: s.account, amount: s.amount, source: s.source, when: new Date().toISOString(), tag: s.severity === 'positive' ? 'GOOD NEWS' : 'JUST IN',
    headline: /[.!?]$/.test(s.title) ? s.title : `${s.title}.`,
    quote: s.quote ? s.quote.replace(/^["“]|["”]$/g, '') : undefined, quoteBy: s.quoteBy,
    judgment: s.judgment,
    receipts: s.account ? [{ type: 'account', id: s.account, label: s.account, href: `/accounts/${encodeURIComponent(s.account)}` }] : [],
    actions: s.account
      ? [{ label: 'Open account', href: `a360:${s.account}:${s.severity ?? 'watch'}` }, { label: 'Ask about this', ask: `What should I do about this: ${s.title} at ${s.account}?` }]
      : [{ label: 'Ask about this', ask: `What should I do about this: ${s.title}?` }],
  }
}

export function AgentPopup() {
  const pathname = usePathname()
  const router = useRouter()
  const [shown, setShown] = useState<Shown | null>(null)
  const [leaving, setLeaving] = useState(false)
  const briefRef = useRef<AgentBrief | null>(null)
  const queue = useRef<LiveSig[]>([])
  const shownRef = useRef<Shown | null>(null)
  shownRef.current = shown
  const hoverRef = useRef(false)
  const considerRef = useRef<() => void>(() => {})

  useEffect(() => {
    let dead = false
    const cached = (() => { try { const raw = sessionStorage.getItem('agent:brief'); if (!raw) return null; const j = JSON.parse(raw); return Date.now() - j.t < 600_000 ? j.b as AgentBrief : null } catch { return null } })()
    if (cached) { briefRef.current = cached; return }
    fetch('/api/agent').then(r => r.ok ? r.json() : null).then((b: AgentBrief | null) => {
      if (dead || !b || !Array.isArray(b.messages)) return
      briefRef.current = b
      try { sessionStorage.setItem('agent:brief', JSON.stringify({ t: Date.now(), b })) } catch { /* ignore */ }
      setTimeout(() => considerRef.current(), 600)
    }).catch(() => {})
    return () => { dead = true }
  }, [])

  const dockMode = ASK_DOCK && !pathname?.startsWith('/ask')
  const present = (s: Shown) => {
    if (!agentPopupsOn()) return
    if (dockMode) {
      // the conversation pulls up out of the Ask bar; the agent talks there
      window.dispatchEvent(new CustomEvent('agent:say', { detail: s.kind === 'brief' ? { kind: 'brief', brief: s.brief } : { kind: 'note', msg: s.msg } }))
      return
    }
    setLeaving(false); setShown(s)
  }
  const close = () => { setLeaving(true); setTimeout(() => setShown(null), 240) }

  // new signals, handed over by LiveSignals
  useEffect(() => {
    const onSig = (e: Event) => {
      const sig = (e as CustomEvent<LiveSig>).detail
      if (!sig || !agentPopupsOn()) return
      if (shownRef.current || document.body.dataset.modal === '1') { queue.current.push(sig); return }
      present({ kind: 'signal', msg: noteFromSignal(sig), sig })
    }
    window.addEventListener('agent:signal', onSig)
    return () => window.removeEventListener('agent:signal', onSig)
  }, [])
  useEffect(() => {
    if (shown || queue.current.length === 0) return
    const t = setTimeout(() => { if (!shownRef.current && document.body.dataset.modal !== '1') { const n = queue.current.shift(); if (n) present({ kind: 'signal', msg: noteFromSignal(n), sig: n }) } }, 900)
    return () => clearTimeout(t)
  }, [shown])
  // a note steps aside after a while unless you're reading it
  useEffect(() => {
    if (!shown || shown.kind === 'brief') return
    const t = setInterval(() => { if (!hoverRef.current) { clearInterval(t); close() } }, 16000)
    return () => clearInterval(t)
  }, [shown])

  // the brief and critical notes: decide whether to speak
  const consider = () => {
    if (!agentPopupsOn()) return
    if (pathname?.startsWith('/ask')) return
    const b = briefRef.current
    if (!b || shownRef.current || document.body.dataset.modal === '1') return
    const d = today()
    const count = Number(LS.get(`agent:count:${d}`) || 0)
    if (count >= AGENT_MAX_POPUPS_PER_DAY) return
    const seen = new Set((LS.get(`agent:seen:${d}`) || '').split('|').filter(Boolean))
    let next: Shown | null = null
    if (!LS.get(`agent:brief:${d}`) && !b.quiet) next = { kind: 'brief', brief: b }
    else {
      const m = b.messages.find(x => (x.priority === 'critical' || x.lane === 'commitments') && !seen.has(x.key))
      if (m) next = { kind: 'message', msg: m }
    }
    if (!next) return
    if (next.kind === 'brief') LS.set(`agent:brief:${d}`, '1')
    else if (next.kind === 'message') { seen.add(next.msg.key); LS.set(`agent:seen:${d}`, [...seen].join('|')) }
    LS.set(`agent:count:${d}`, String(count + 1))
    present(next)
  }
  considerRef.current = consider
  // a few seconds after each page settles
  useEffect(() => {
    if (pathname?.startsWith('/ask')) { if (shownRef.current && shownRef.current.kind !== 'signal') setShown(null); return }
    const t = setTimeout(() => considerRef.current(), AGENT_BRIEF_DELAY_MS)
    return () => clearTimeout(t)
  }, [pathname])

  useEffect(() => {
    if (!shown) return
    const iv = setInterval(() => { if (document.body.dataset.modal === '1') setShown(null) }, 400)
    // a click anywhere outside the card closes it
    const onDown = (e: PointerEvent) => { const t = e.target as Element | null; if (t && !t.closest?.('.agent-card')) { setLeaving(true); setTimeout(() => setShown(null), 240) } }
    const arm = setTimeout(() => document.addEventListener('pointerdown', onDown), 200)   // not the click that opened it
    return () => { clearInterval(iv); clearTimeout(arm); document.removeEventListener('pointerdown', onDown) }
  }, [shown])

  if (!shown) return null

  const doAction = (a: AgentMessage['actions'][number]) => {
    close()
    if (a.href?.startsWith('a360:')) {
      const [, name, sev] = a.href.split(':')
      window.dispatchEvent(new CustomEvent('open-a360', { detail: { name, contact: '', stage: 'Active', risk: (sev || 'watch').toUpperCase(), arr: '--', health: '--' } }))
    } else if (a.href) router.push(a.href)
    else if (a.ask) router.push(`/ask?q=${encodeURIComponent(a.ask)}`)
  }

  return (
    <div className={`agent-card${leaving ? ' leaving' : ''}`} role="status" aria-live="polite"
      onMouseEnter={() => { hoverRef.current = true }} onMouseLeave={() => { hoverRef.current = false }}>
      <div className="agent-card-top">
        <span className="agent-mark" />
        <span className="agent-card-from">{AGENT_NAME}</span>
        <button className="agent-card-x" onClick={close} aria-label="Dismiss">×</button>
      </div>

      {shown.kind === 'brief' ? (
        <div className="note">
          <div className="note-dateline"><span className="note-rule" style={{ background: '#E85A25' }} /><span className="note-dl-strong">MORNING BRIEF</span><span>· {shown.brief.read} SIGNALS READ</span></div>
          <div className="note-head">{shown.brief.summary}</div>
          <div className="brief-list">
            {shown.brief.messages.filter(m => m.lane !== 'followup').map(m => (
              <div key={m.key} className="brief-row">
                <Dateline m={m} />
                <div className="brief-row-t">{m.headline}</div>
              </div>
            ))}
          </div>
          <div className="note-foot">
            <button className="note-act" onClick={() => { close(); router.push('/ask?agent=brief') }}>Walk me through it</button>
            <span className="note-link" onClick={close}>Later</span>
          </div>
        </div>
      ) : (
        <AgentNote m={shown.msg} onAction={doAction} onReceipt={href => { close(); router.push(href) }} compact />
      )}
    </div>
  )
}

export { money }
