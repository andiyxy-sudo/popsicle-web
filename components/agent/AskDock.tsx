'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AGENT_NAME } from '@/lib/agent/config'
import { Answer } from '@/components/ask/AnswerText'

// The Ask bar that sits on every page, with the conversation pulling up out of it.
// Ask a question from Acme's page and the answer rises above the bar, about Acme,
// without leaving the page. Follow-ups go in the same bar. "Open in Ask" hands the
// whole conversation to the Ask page.
type Msg = { role: 'user' | 'assistant'; content: string }

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
  useEffect(() => { const p = paneRef.current; if (p) p.scrollTo({ top: p.scrollHeight, behavior: 'smooth' }) }, [msgs, open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  async function send() {
    const q = ask.trim()
    if (!q || busy) return
    const next: Msg[] = [...msgs, { role: 'user', content: q }]
    setMsgs(next); setAsk(''); setOpen(true); setBusy(true)
    const my = ++gen.current
    const c = new AbortController(); ctrl.current = c
    const live = () => gen.current === my
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: c.signal,
        body: JSON.stringify({ messages: next, stream: true, focus: { account, screen } }) })
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

  function fresh() {
    gen.current += 1; ctrl.current?.abort()
    setMsgs([]); setBusy(false); setStreaming(false); setOpen(false)
    inputRef.current?.focus()
  }
  function openFull() {
    try { sessionStorage.setItem('ask:handoff', JSON.stringify(msgs)) } catch { /* ignore */ }
    setOpen(false)
    router.push(`/ask?handoff=1${account ? `&account=${encodeURIComponent(account)}` : ''}`)
  }

  const hasConvo = msgs.length > 0
  return (
    <div className="dock">
      {open && hasConvo && (
        <div className="dock-sheet" role="dialog" aria-label={`${AGENT_NAME} conversation`}>
          <div className="dock-head">
            <span className="agent-mark" />
            <span className="dock-from">{AGENT_NAME}</span>
            {about && <span className="dock-about">· about {about}</span>}
            <span className="dock-head-actions">
              <button onClick={openFull} title="Continue on the Ask page">Open in Ask ↗</button>
              <button onClick={fresh} title="Clear this conversation">Start fresh</button>
              <button onClick={() => setOpen(false)} aria-label="Close" className="dock-x">×</button>
            </span>
          </div>
          <div className="dock-pane" ref={paneRef}>
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
          placeholder={hasConvo ? 'Ask a follow-up' : account ? `Ask about ${account}` : 'Ask Popsicle anything about your pipeline'} />
        {hasConvo && !open && <button className="dock-reopen" onClick={() => setOpen(true)} title="Show the conversation">{Math.ceil(msgs.length / 2)} ↑</button>}
        <button onClick={send}>Ask</button>
      </div>
    </div>
  )
}
