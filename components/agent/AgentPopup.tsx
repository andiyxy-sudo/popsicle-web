'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AGENT_BRIEF_DELAY_MS, AGENT_MAX_POPUPS_PER_DAY, AGENT_NAME } from '@/lib/agent/config'
import type { AgentBrief, AgentMessage } from '@/lib/agent/compose'
import { AgentAvatar } from './AgentAvatar'

// the server composes in UTC; greet in the viewer's own time
const localGreeting = (g: string) => { const h = new Date().getHours(); return g.replace(/^(Morning|Afternoon|Evening)/, h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening') }

// The agent speaking up, on any page. Three moments only: the morning brief (once a
// day), a critical item, and an overdue commitment. Never more than a few a day, never
// over a modal, never on the Ask page (where the agent already lives).
const today = () => new Date().toISOString().slice(0, 10)
const LS = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
}

type LiveSig = { id: string; title: string; account?: string; severity?: string; source?: string; quote?: string }
type Shown = { kind: 'brief'; brief: AgentBrief } | { kind: 'message'; msg: AgentMessage; brief: AgentBrief } | { kind: 'signal'; sig: LiveSig }

const SRC: Record<string, string> = { gmail: 'Gmail', outlook: 'Outlook', whatsapp: 'WhatsApp', slack: 'Slack', zoom: 'Zoom', hubspot: 'HubSpot', gcal: 'Calendar', fireflies: 'Fireflies' }
// How the agent says a new signal out loud, by severity.
function speakSignal(s: LiveSig): { lead: string; text: string; lane: string } {
  const acct = s.account ?? 'one of your accounts'
  const via = s.source ? ` Came in on ${SRC[s.source] ?? s.source}.` : ''
  const q = (s.quote ?? '').trim()
  const quote = q ? ` ${q}${/[.!?"”]$/.test(q) ? '' : '.'}` : ''
  const title = s.title.replace(/\.$/, '')
  if (s.severity === 'high') return { lead: `Heads up on ${acct}.`, text: `${title}.${quote}${via}`, lane: 'risk' }
  if (s.severity === 'positive') return { lead: `Good news from ${acct}.`, text: `${title}.${quote}${via}`, lane: 'renewals' }
  return { lead: `Worth watching at ${acct}.`, text: `${title}.${quote}${via}`, lane: 'commitments' }
}

export function AgentPopup() {
  const pathname = usePathname()
  const router = useRouter()
  const [shown, setShown] = useState<Shown | null>(null)
  const [typing, setTyping] = useState(true)
  const [leaving, setLeaving] = useState(false)
  const briefRef = useRef<AgentBrief | null>(null)
  const queue = useRef<LiveSig[]>([])
  const shownRef = useRef<Shown | null>(null)
  shownRef.current = shown
  const hoverRef = useRef(false)

  const showSignal = (sig: LiveSig) => {
    setTyping(true); setLeaving(false); setShown({ kind: 'signal', sig })
    setTimeout(() => setTyping(false), 900)
  }
  // live signals arrive here from LiveSignals; one on screen at a time, the rest wait their turn
  useEffect(() => {
    const onSig = (e: Event) => {
      const sig = (e as CustomEvent<LiveSig>).detail
      if (!sig) return
      if (shownRef.current || document.body.dataset.modal === '1') { queue.current.push(sig); return }
      showSignal(sig)
    }
    window.addEventListener('agent:signal', onSig)
    return () => window.removeEventListener('agent:signal', onSig)
  }, [])
  // a signal steps aside on its own after a while, unless you are reading it
  useEffect(() => {
    if (!shown || shown.kind !== 'signal') return
    const t = setInterval(() => { if (!hoverRef.current) { clearInterval(t); setLeaving(true); setTimeout(() => setShown(null), 260) } }, 14000)
    return () => clearInterval(t)
  }, [shown])
  // when the current one closes, the next queued signal takes the stage
  useEffect(() => {
    if (shown || queue.current.length === 0) return
    const t = setTimeout(() => { if (!shownRef.current && document.body.dataset.modal !== '1') { const n = queue.current.shift(); if (n) showSignal(n) } }, 800)
    return () => clearTimeout(t)
  }, [shown])

  // fetch once per session (10-minute cache)
  useEffect(() => {
    let dead = false
    const cached = (() => { try { const raw = sessionStorage.getItem('agent:brief'); if (!raw) return null; const j = JSON.parse(raw); return Date.now() - j.t < 600_000 ? j.b as AgentBrief : null } catch { return null } })()
    if (cached) { briefRef.current = cached; return }
    fetch('/api/agent').then(r => r.ok ? r.json() : null).then((b: AgentBrief | null) => {
      if (dead || !b || !Array.isArray(b.messages)) return
      briefRef.current = b
      try { sessionStorage.setItem('agent:brief', JSON.stringify({ t: Date.now(), b })) } catch { /* ignore */ }
    }).catch(() => {})
    return () => { dead = true }
  }, [])

  // decide whether to speak, a few seconds after each page settles
  useEffect(() => {
    if (pathname?.startsWith('/ask')) { if (shownRef.current?.kind !== 'signal') setShown(null); return }
    const t = setTimeout(() => {
      const b = briefRef.current
      if (!b || shown) return
      if (document.body.dataset.modal === '1') return
      const d = today()
      const count = Number(LS.get(`agent:count:${d}`) || 0)
      if (count >= AGENT_MAX_POPUPS_PER_DAY) return
      const seen = new Set((LS.get(`agent:seen:${d}`) || '').split('|').filter(Boolean))
      let next: Shown | null = null
      if (!LS.get(`agent:brief:${d}`) && !b.quiet) next = { kind: 'brief', brief: b }
      else {
        const m = b.messages.find(x => (x.priority === 'critical' || x.lane === 'commitments') && !seen.has(x.key))
        if (m) next = { kind: 'message', msg: m, brief: b }
      }
      if (!next) return
      if (next.kind === 'brief') LS.set(`agent:brief:${d}`, '1')
      else { seen.add(next.msg.key); LS.set(`agent:seen:${d}`, [...seen].join('|')) }
      LS.set(`agent:count:${d}`, String(count + 1))
      setTyping(true); setLeaving(false); setShown(next)
      setTimeout(() => setTyping(false), 1100)
    }, AGENT_BRIEF_DELAY_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // step aside when a modal opens
  useEffect(() => {
    if (!shown) return
    const iv = setInterval(() => { if (document.body.dataset.modal === '1') setShown(null) }, 400)
    return () => clearInterval(iv)
  }, [shown])

  if (!shown) return null
  const close = () => { setLeaving(true); setTimeout(() => setShown(null), 260) }
  const open = (key?: string) => { close(); router.push(`/ask${key ? `?agent=${encodeURIComponent(key)}` : '?agent=brief'}`) }

  const spoken = shown.kind === 'signal' ? speakSignal(shown.sig) : null
  const b = shown.kind === 'signal' ? null : shown.brief
  const lead = shown.kind === 'signal' ? spoken!.lead : shown.kind === 'brief' ? localGreeting(b!.greeting) : shown.msg.headline
  const text = shown.kind === 'signal' ? spoken!.text : shown.kind === 'brief' ? b!.summary : shown.msg.body
  const openAccount = (name?: string, sev?: string) => {
    close()
    if (name) window.dispatchEvent(new CustomEvent('open-a360', { detail: { name, contact: '', stage: 'Active', risk: (sev || 'watch').toUpperCase(), arr: '--', health: '--' } }))
  }

  return (
    <div className={`agent-pop${leaving ? ' leaving' : ''}${shown.kind === 'signal' ? ` sev-${shown.sig.severity ?? 'watch'}` : ''}`} role="status" aria-live="polite"
      onMouseEnter={() => { hoverRef.current = true }} onMouseLeave={() => { hoverRef.current = false }}>
      <div className="agent-pop-head">
        <AgentAvatar size={38} />
        <div style={{ minWidth: 0 }}>
          <div className="agent-pop-name">{AGENT_NAME}</div>
          <div className="agent-pop-meta">{typing ? 'typing…' : shown.kind === 'signal' ? `just spotted this${shown.sig.source ? ` on ${SRC[shown.sig.source] ?? shown.sig.source}` : ''}` : 'just now'}</div>
        </div>
        <button className="agent-pop-x" onClick={close} aria-label="Dismiss">×</button>
      </div>

      <div className="agent-bubble">
        {typing ? (
          <span className="agent-typing"><i /><i /><i /></span>
        ) : (
          <div className="agent-bubble-in">
            <div className="agent-lead">{lead}</div>
            <div className="agent-text">{text}</div>
            {shown.kind === 'brief' && b && b.messages.length > 0 && (
              <div className="agent-peek">
                {b.messages.slice(0, 3).map(m => (
                  <div key={m.key} className="agent-peek-row">
                    <span className={`agent-lane-dot lane-${m.lane}`} />
                    <span className="agent-peek-t">{m.headline}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!typing && (
        <div className="agent-pop-actions">
          {shown.kind === 'signal' ? (
            <>
              <button className="agent-btn primary" onClick={() => openAccount(shown.sig.account, shown.sig.severity)}>{shown.sig.account ? 'Open account' : 'Show me'}</button>
              <button className="agent-btn" onClick={() => { close(); router.push(`/ask?q=${encodeURIComponent(`What should I do about this: ${shown.sig.title}${shown.sig.account ? ` at ${shown.sig.account}` : ''}?`)}${shown.sig.account ? `&account=${encodeURIComponent(shown.sig.account)}` : ''}`) }}>Ask me</button>
              <button className="agent-btn ghost" onClick={close}>Later</button>
            </>
          ) : (
            <>
              <button className="agent-btn primary" onClick={() => open(shown.kind === 'message' ? shown.msg.key : undefined)}>{shown.kind === 'brief' ? 'Walk me through it' : 'Show me'}</button>
              <button className="agent-btn" onClick={close}>Later</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
