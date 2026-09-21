'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AGENT_NAME } from '@/lib/agent/config'
import { Answer } from '@/components/ask/AnswerText'
import type { AgentBrief, AgentMessage } from '@/lib/agent/compose'
import { AgentNote, Dateline } from './AgentNote'

// The Ask bar that sits on every page, with the conversation pulling up out of it.
// Ask a question from Acme's page and the answer rises above the bar, about Acme,
// without leaving the page. Follow-ups go in the same bar. "Open in Ask" hands the
// whole conversation to the Ask page.
type Msg = { role: 'user' | 'assistant'; content: string }
type Said = { id: string; kind: 'brief'; brief: AgentBrief } | { id: string; kind: 'note'; msg: AgentMessage }

const LABEL: Record<string, string> = { pulse: 'Pulse', portfolio: 'Portfolio', signals: 'Signals', forecast: 'Forecast', intelligence: 'Intelligence', team: 'Team', integrations: 'Integrations', settings: 'Settings' }

export function AskDock() {
  const pathname = usePathname()
  const router = useRouter()
  const [ask, setAsk] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const loaded = useRef(false)
  // restore after mount (never during render, so server and client HTML agree)
  useEffect(() => { try { const r = sessionStorage.getItem('ask:dock'); if (r) setMsgs(JSON.parse(r) as Msg[]) } catch { /* ignore */ } loaded.current = true }, [])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [streaming, setStreaming] = useState(false)
  // what the agent has said to you this session, shown above your questions
  const [said, setSaid] = useState<Said[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)       // the newest item, briefly highlighted
  const gen = useRef(0)
  const ctrl = useRef<AbortController | null>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // what the question is about: the account you are looking at, or the screen
  const seg = (pathname ?? '').split('/').filter(Boolean)
  const account = seg[0] === 'accounts' && seg[1] ? decodeURIComponent(seg[1]) : undefined
  const screen = account ? undefined : seg[0]
  const about = account ?? (screen ? LABEL[screen] ?? screen : undefined)

  useEffect(() => { if (!loaded.current) return; try { sessionStorage.setItem('ask:dock', JSON.stringify(msgs.slice(-20))) } catch { /* ignore */ } }, [msgs])
  // follow a streaming answer only while you are reading at the bottom. The moment you
  // scroll up, it stops pulling you down (it used to snap back on every new word).
  const followRef = useRef(true)
  const onPaneScroll = () => { const p = paneRef.current; if (p) followRef.current = p.scrollHeight - p.scrollTop - p.clientHeight < 48 }
  useEffect(() => { const p = paneRef.current; if (p && followRef.current) p.scrollTop = p.scrollHeight }, [msgs])
  useEffect(() => { const p = paneRef.current; if (open && p) { followRef.current = true; p.scrollTop = p.scrollHeight } }, [open])
  const dockRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    // v11.97: a click anywhere outside the sheet and the bar folds it away.
    // Clicks inside overlays the sheet opened (Account 360, source popups) don't count.
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (!t || dockRef.current?.contains(t)) return
      if ((t as Element).closest?.('[role="dialog"], .a360-panel, .smodal-overlay')) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [open])

  useEffect(() => {
    const onSay = (e: Event) => {
      const d = (e as CustomEvent<{ kind: 'brief'; brief: AgentBrief } | { kind: 'note'; msg: AgentMessage }>).detail
      if (!d) return
      const id = d.kind === 'brief' ? `brief:${d.brief.generatedAt}` : d.msg.key
      setSaid(prev => prev.some(x => x.id === id) ? prev : [{ id, ...d } as Said, ...prev].slice(0, 6))
      setFresh(id); setTimeout(() => setFresh(f => (f === id ? null : f)), 2600)
      setOpen(true)
      if (paneRef.current) paneRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener('agent:say', onSay)
    return () => window.removeEventListener('agent:say', onSay)
  }, [])

  const act = (a: AgentMessage['actions'][number]) => {
    if (a.href?.startsWith('a360:')) {
      const [, name, sev] = a.href.split(':')
      window.dispatchEvent(new CustomEvent('open-a360', { detail: { name, contact: '', stage: 'Active', risk: (sev || 'watch').toUpperCase(), arr: '--', health: '--' } }))
    } else if (a.href) { setOpen(false); router.push(a.href) }
    else if (a.ask) { setAsk(a.ask); setTimeout(() => inputRef.current?.focus(), 0) }
  }

  useEffect(() => {
    const onAsk = (e: Event) => {
      const d = (e as CustomEvent<{ q: string; account?: string }>).detail
      if (d?.q) sendRef.current(d.q, d.account)
    }
    window.addEventListener('dock:ask', onAsk)
    return () => window.removeEventListener('dock:ask', onAsk)
  }, [])

  async function send(override?: string, focusAccount?: string) {
    const q = (override ?? ask).trim()
    if (!q || busy) return
    const next: Msg[] = [...msgs, { role: 'user', content: q }]
    setMsgs(next); setAsk(''); setOpen(true); setBusy(true); followRef.current = true
    const my = ++gen.current
    const c = new AbortController(); ctrl.current = c
    const live = () => gen.current === my
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: c.signal,
        body: JSON.stringify({ messages: next, stream: true, focus: { account: focusAccount ?? account, screen: focusAccount ? undefined : screen } }) })
      if (!live()) return
      let answer = ''
      const ct = r.headers.get('content-type') || ''
      if (r.body && ct.includes('text/plain')) {
        const reader = r.body.getReader(); const dec = new TextDecoder()
        setBusy(false); setStreaming(true)
        setMsgs([...next, { role: 'assistant', content: '' }])
        for (;;) {
          const { done, value } = await reader.read()
          if (done || !live()) break
          answer += dec.decode(value, { stream: true })
          setMsgs([...next, { role: 'assistant', content: answer }])
        }
      } else {
        const j = await r.json().catch(() => ({}))
        if (!live()) return
        setMsgs([...next, { role: 'assistant', content: j.content || j.error || 'No answer came back. Try rephrasing the question.' }])
      }
    } catch {
      if (live()) setMsgs([...next, { role: 'assistant', content: 'Could not reach the co-pilot. Try again in a moment.' }])
    }
    if (live()) { setBusy(false); setStreaming(false) }
  }

  const sendRef = useRef(send)
  sendRef.current = send

  function startFresh() {
    gen.current += 1; ctrl.current?.abort()
    setMsgs([]); setSaid([]); setBusy(false); setStreaming(false); setOpen(false)
    inputRef.current?.focus()
  }
  function openFull() {
    try { sessionStorage.setItem('ask:handoff', JSON.stringify(msgs)) } catch { /* ignore */ }
    setOpen(false)
    router.push(`/ask?handoff=1${account ? `&account=${encodeURIComponent(account)}` : ''}`)
  }

  const hasConvo = msgs.length > 0 || said.length > 0
  return (
    <div className="dock" ref={dockRef}>
      {open && hasConvo && (
        <div className="dock-sheet" role="dialog" aria-label={`${AGENT_NAME} conversation`}>
          <div className="dock-head">
            <span className="agent-mark" />
            <span className="dock-from">{AGENT_NAME}</span>
            {msgs.length === 0 && said[0]?.kind === 'brief' ? <span className="dock-about">· morning brief</span> : about && <span className="dock-about">· about {about}</span>}
            <span className="dock-head-actions">
              <button onClick={openFull} title="Continue on the Ask page">Open in Ask ↗</button>
              <button onClick={startFresh} title="Clear this conversation">Start fresh</button>
              <button onClick={() => setOpen(false)} aria-label="Close" className="dock-x">×</button>
            </span>
          </div>
          <div className="dock-pane" ref={paneRef} onScroll={onPaneScroll}>
            {said.map(item => (
              <div key={item.id} className={`dock-said${fresh === item.id ? ' fresh' : ''}`}>
                {item.kind === 'note' ? (
                  <AgentNote m={item.msg} compact onAction={act} onReceipt={href => { setOpen(false); router.push(href) }} />
                ) : (
                  <div className="note compact">
                    <div className="note-dateline"><span className="note-rule" style={{ background: '#E85A25' }} /><span className="note-dl-strong">MORNING BRIEF</span><span>· {item.brief.read} SIGNALS READ</span></div>
                    <div className="note-head">{(() => { const h = new Date().getHours(); return `${h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'}, ${item.brief.greeting.split(', ')[1]?.replace(/\.$/, '') ?? ''}.` })()} {item.brief.summary}</div>
                    <div className="brief-list">
                      {item.brief.messages.map(m => (
                        <div key={m.key} className="brief-row dock-brief-row" onClick={() => setExpanded(x => (x === m.key ? null : m.key))}>
                          {expanded === m.key
                            ? <AgentNote m={m} compact onAction={act} onReceipt={href => { setOpen(false); router.push(href) }} />
                            : <><Dateline m={m} /><div className="brief-row-t">{m.headline}</div></>}
                        </div>
                      ))}
                    </div>
                    <div className="dock-hint">Tap any line to open it, or reply below.</div>
                  </div>
                )}
              </div>
            ))}
            {msgs.map((m, i) => m.role === 'user' ? (
              <div key={i} className="dock-q"><span className="dock-q-label">You</span>{m.content}</div>
            ) : (
              <div key={i} className="dock-a">
                {m.content ? <Answer text={m.content} /> : null}
                {streaming && i === msgs.length - 1 && <span className="dock-caret" />}
              </div>
            ))}
            {busy && <div className="dock-thinking"><span /><span /><span />Reading your {account ? `${account} signals` : 'signals'}…</div>}
          </div>
        </div>
      )}

      <div className={`ed-askbar${open && hasConvo ? ' docked' : ''}`}>
        <span className="ed-askdot"><span /><span /></span>
        <input ref={inputRef} value={ask} onChange={e => setAsk(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          onFocus={() => { if (hasConvo) setOpen(true) }}
          placeholder={msgs.length ? 'Ask a follow-up' : said.length ? `Reply to ${AGENT_NAME}` : account ? `Ask about ${account}` : 'Ask Popsicle anything about your pipeline'} />
        {hasConvo && !open && <button className="dock-reopen" onClick={() => setOpen(true)} title="Show the conversation">{said.length && !msgs.length ? `${AGENT_NAME} ↑` : `${Math.ceil(msgs.length / 2) + said.length} ↑`}</button>}
        <button onClick={() => send()}>Ask</button>
      </div>
    </div>
  )
}
