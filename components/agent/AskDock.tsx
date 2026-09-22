'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AGENT_NAME } from '@/lib/agent/config'
import { Answer } from '@/components/ask/AnswerText'
import type { AgentBrief, AgentMessage } from '@/lib/agent/compose'
import { AgentNote, Dateline } from './AgentNote'
import { getSettingsNow, useSettings } from '@/lib/useSettings'
import { inQuietHours, inWorkingHours, pastMorningDigest } from '@/lib/settings'

// The Ask bar that sits on every page, with the conversation pulling up out of it.
// Ask a question from Acme's page and the answer rises above the bar, about Acme,
// without leaving the page. Follow-ups go in the same bar. "Open in Ask" hands the
// whole conversation to the Ask page.
type Msg = { role: 'user' | 'assistant'; content: string }
type Said = { id: string; kind: 'brief'; brief: AgentBrief } | { id: string; kind: 'note'; msg: AgentMessage }

// the bar's prompt, asked the way a colleague would on each page
const PROMPT: Record<string, string> = {
  pulse: 'What needs you today?', portfolio: 'Which account is quietly slipping?', signals: 'Which of these signals is real?',
  forecast: 'Is the commit real?', intelligence: 'What\u2019s driving the risk?', team: 'Who on the team needs help?',
  review: 'Ask Popsicle about this deal', integrations: 'Which source is telling you the most?', settings: 'How should Popsicle work for you?',
}
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
  // only the newest alert shows; earlier ones fold behind a quiet "N earlier" line
  const [showEarlier, setShowEarlier] = useState(false)
  useSettings()   // loads your settings so alerts can respect them
  // when a new signal pops up, the sheet shows just that one; everything else is one click away
  const [alertOnly, setAlertOnly] = useState(false)
  useEffect(() => { if (!open) setAlertOnly(false) }, [open])   // reopening later shows everything
  // after you ask, only that question and its answer show; earlier ones stay (for follow-ups) behind one line
  const [latestOnly, setLatestOnly] = useState(false)
  const lastQIdx = Math.max(0, msgs.map(m => m.role).lastIndexOf('user'))
  const earlierCount = msgs.slice(0, lastQIdx).filter(m => m.role === 'user').length
  const [expanded, setExpanded] = useState<string | null>(null)
  // v11.112: questions worth asking about the page you're on
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggKey, setSuggKey] = useState('')   // which page the questions above belong to
  const cacheRef = useRef<Record<string, string[]>>({})
  const [loadingKey, setLoadingKey] = useState('')   // a page whose questions are still loading
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

  useEffect(() => {
    const key = `${screen ?? ''}|${account ?? ''}`
    if (cacheRef.current[key]) { setSuggestions(cacheRef.current[key]); setSuggKey(key); return }
    setLoadingKey(key)
    let dead = false
    const qs = new URLSearchParams({ screen: account ? 'account' : (screen || 'pulse') })
    if (account) qs.set('account', account)
    fetch(`/api/ask/suggest?${qs}`).then(r => r.ok ? r.json() : null).then((j: { questions?: string[] } | null) => {
      if (dead) return
      const q = j?.questions ?? []
      cacheRef.current[key] = q; setSuggestions(q); setSuggKey(key); setLoadingKey(k => (k === key ? '' : k))
    }).catch(() => { if (!dead) setLoadingKey(k => (k === key ? '' : k)) })
    return () => { dead = true }
  }, [screen, account])
  useEffect(() => { setOpen(false) }, [screen, account])
  useEffect(() => {
    const pages = ['pulse', 'portfolio', 'signals', 'forecast', 'intelligence', 'team', 'integrations', 'settings']
    let dead = false
    ;(async () => {
      for (const pg of pages) {
        const key = `${pg}|`
        if (dead || cacheRef.current[key]) continue
        try { const j = await (await fetch(`/api/ask/suggest?screen=${pg}`)).json(); if (!dead && Array.isArray(j?.questions) && !cacheRef.current[key]) cacheRef.current[key] = j.questions } catch { /* ignore */ }
      }
    })()
    return () => { dead = true }
  }, [])

  useEffect(() => { if (!loaded.current) return; try { sessionStorage.setItem('ask:dock', JSON.stringify(msgs.slice(-20))) } catch { /* ignore */ } }, [msgs])
  // follow a streaming answer only while you are reading at the bottom. The moment you
  // scroll up, it stops pulling you down (it used to snap back on every new word).
  const followRef = useRef(true)
  // v11.114: a soft fade at the foot of the sheet whenever there's more below
  const [moreBelow, setMoreBelow] = useState(false)
  const measure = () => { const p = paneRef.current; setMoreBelow(!!p && p.scrollHeight - p.scrollTop - p.clientHeight > 8) }
  const onPaneScroll = () => { const p = paneRef.current; if (p) followRef.current = p.scrollHeight - p.scrollTop - p.clientHeight < 48; measure() }
  useEffect(() => { const p = paneRef.current; if (p && followRef.current) p.scrollTop = p.scrollHeight }, [msgs])
  useEffect(() => { const p = paneRef.current; if (open && p) { followRef.current = true; p.scrollTop = p.scrollHeight } }, [open])
  useEffect(() => { const id = requestAnimationFrame(measure); return () => cancelAnimationFrame(id) })   // after every render
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
      // your Settings decide what may interrupt you
      const st = getSettingsNow()
      const timed = !st.demo   // the demo always performs, whatever the hour
      if (timed && d.kind === 'brief' && !pastMorningDigest(st)) return                       // the brief waits for your morning-digest time
      if (d.kind === 'note') {
        const critical = d.msg.priority === 'critical'
        if (!st.notifs.risk) return                                                    // risk alerts off
        if (timed && (inQuietHours(st) || !inWorkingHours(st)) && !critical) return            // quiet hours, or outside working hours: only critical gets through
        if (!critical && st.thresholds.minDeal && (d.msg.amount ?? Infinity) < st.thresholds.minDeal) return   // small deals stay quiet
        // push: a real browser notification when you're on another tab
        if (st.notifs.push && critical && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden && !(timed && inQuietHours(st))) {
          try { new Notification(`Popsicle · ${d.msg.account ?? 'New signal'}`, { body: d.msg.headline, tag: d.msg.key }) } catch { /* ignore */ }
        }
      }
      const id = d.kind === 'brief' ? `brief:${d.brief.generatedAt}` : d.msg.key
      setSaid(prev => prev.some(x => x.id === id) ? prev : [{ id, ...d } as Said, ...prev].slice(0, 6))
      setShowEarlier(false)
      setAlertOnly(true)
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
    setAlertOnly(false)
    setLatestOnly(true)
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
      if (live()) setMsgs([...next, { role: 'assistant', content: 'Couldn\u2019t reach Popsicle. Try again in a moment.' }])
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
  const showSuggest = suggestions.length > 0 && !ask.trim() && !busy && !streaming

  // ── the live placeholder ─────────────────────────────────────────────────────
  // Before you ask: the page's own live questions rotate slowly, each with "Ask this →".
  // After an answer: the natural next question. Click into the bar and it goes blank to type freely.
  const [focused, setFocused] = useState(false)
  const [hover, setHover] = useState(false)
  const [rotState, setRotState] = useState<{ key: string; n: number; steps: number }>({ key: '', n: 0, steps: 0 })
  const lastA = [...msgs].reverse().find(m => m.role === 'assistant')?.content ?? ''
  const lastQ = [...msgs].reverse().find(m => m.role === 'user')?.content ?? ''
  const followUp = (() => {
    if (!msgs.length || !lastA || busy || streaming) return null
    if (/^\s*\**\s*verdict\b/i.test(lastA)) return 'Why? And what would change that?'
    const acct = account ?? (/\b(about|on|for|is|will)\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){0,2})\b/.exec(lastQ)?.[2])
    if (/^\s*(\d+[.)]|[-•*])\s+/m.test(lastA)) return 'Which one should I tackle first?'
    if (acct && !/^(What|Which|Who|Why|How|Is|Will)$/.test(acct)) return `What should I do next on ${acct}?`
    return 'What should I check next?'
  })()
  const pageKey = `${screen ?? ''}|${account ?? ''}`
  const pageQs = cacheRef.current[pageKey] ?? (suggKey === pageKey ? suggestions : [])   // this page's own questions, read instantly when cached
  const qsPending = !cacheRef.current[pageKey] && (loadingKey === pageKey || suggKey !== pageKey)   // still loading: show nothing, not a stand-in
  const pool = msgs.length && open ? (followUp ? [followUp] : []) : pageQs   // closed or new page: the page's own questions
  const poolKey = pool.join('|')
  const rot = rotState.key === poolKey ? rotState.n : 0          // a new list always starts at its first question
  const steps = rotState.key === poolKey ? rotState.steps : 0
  const current = pool.length ? pool[rot % pool.length] : null
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    if (pool.length < 2 || focused || hover || reduced || steps >= pool.length * 2) return   // two calm rounds, then rest
    const t = setTimeout(() => setRotState(r => r.key === poolKey ? { key: poolKey, n: r.n + 1, steps: r.steps + 1 } : { key: poolKey, n: 1, steps: 1 }), 4600)
    return () => clearTimeout(t)
  }, [pool.length, poolKey, focused, hover, reduced, steps, rot])
  const showLive = !!current && !focused && !ask && !busy && !streaming
  return (
    <div className="dock" ref={dockRef}>
      {open && (hasConvo || showSuggest) && (
        <div className={`dock-sheet${moreBelow ? ' more-below' : ''}`} role="dialog" aria-label={`${AGENT_NAME} conversation`}>
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
            {!alertOnly && !hasConvo && showSuggest && (
              <div className="dock-suggest">
                <div className="dock-suggest-label">{account ? `Ask about ${account}` : `Ask about ${about ?? 'this page'}`}</div>
                {suggestions.map(q => (
                  <button key={q} className="dock-suggest-q" onClick={() => send(q)}>
                    <span>{q}</span><span aria-hidden className="dock-suggest-go">↗</span>
                  </button>
                ))}
              </div>
            )}
            {!alertOnly && !latestOnly && said.length > 1 && (
              <button className="dock-earlier" onClick={() => setShowEarlier(v => !v)} aria-expanded={showEarlier}>
                {showEarlier ? 'Hide earlier updates' : `${said.length - 1} earlier update${said.length - 1 === 1 ? '' : 's'}`}
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden style={{ transform: showEarlier ? 'rotate(180deg)' : undefined, transition: 'transform .2s ease' }}><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            )}
            {(latestOnly && msgs.length ? [] : showEarlier && !alertOnly ? said : said.slice(0, 1)).map(item => (
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
            {alertOnly && (said.length > 1 || msgs.length > 0) && (
              <button className="dock-earlier dock-seeall" onClick={() => setAlertOnly(false)}>
                {[said.length > 1 && `${said.length - 1} earlier update${said.length - 1 === 1 ? '' : 's'}`, msgs.length > 0 && 'your conversation'].filter(Boolean).join(' and ')}
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            )}
            {!alertOnly && latestOnly && (earlierCount > 0 || said.length > 0) && (
              <button className="dock-earlier" onClick={() => setLatestOnly(false)}>
                {[earlierCount > 0 && `${earlierCount} earlier question${earlierCount === 1 ? '' : 's'}`, said.length > 0 && `${said.length} update${said.length === 1 ? '' : 's'}`].filter(Boolean).join(' and ')}
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            )}
            {!alertOnly && (latestOnly ? msgs.slice(lastQIdx) : msgs).map((m, j) => { const i = latestOnly ? lastQIdx + j : j; return m.role === 'user' ? (
              <div key={i} className="dock-q"><span className="dock-q-label">You</span>{m.content}</div>
            ) : (
              <div key={i} className="dock-a">
                {m.content ? <Answer text={m.content} /> : null}
                {streaming && i === msgs.length - 1 && <span className="dock-caret" />}
              </div>
            ) })}
            {!alertOnly && hasConvo && showSuggest && (
              <div className="dock-next">
                <span className="dock-next-label">Ask next</span>
                {suggestions.filter(q => !msgs.some(m => m.role === 'user' && m.content === q)).map(q => (
                  <button key={q} className="dock-next-q" onClick={() => send(q)}>{q}</button>
                ))}
              </div>
            )}
            {busy && <div className="dock-thinking"><span /><span /><span />Reading your {account ? `${account} signals` : 'signals'}…</div>}
          </div>
        </div>
      )}

      <div className={`ed-askbar${open && hasConvo ? ' docked' : ''}`}>
        <span className="ed-askdot"><span /><span /></span>
        <div className="dock-in" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <input ref={inputRef} value={ask} onChange={e => setAsk(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') send()
            // Tab fills in the question that was showing (a quiet extra for keyboard users)
            if (e.key === 'Tab' && !ask && current) { e.preventDefault(); setAsk(current) }
          }}
          onFocus={() => { setFocused(true); if (hasConvo) setOpen(true) }}
          onBlur={() => setFocused(false)}
          placeholder={focused ? '' : showLive ? '' : (qsPending && !(open && msgs.length)) ? '' : (open && msgs.length ? 'Ask a follow-up' : open && said.length ? `Reply to ${AGENT_NAME}` : account ? `What's worrying you about ${account}?` : (PROMPT[screen ?? ''] ?? 'Ask Popsicle about your pipeline'))} />
        {showLive && (
          <div className="dock-live" key={current} aria-hidden={false}>
            <span className="dock-live-q">{current}</span>
            <button className="dock-live-go" onMouseDown={e => e.preventDefault()} onClick={() => send(current!)}>Ask this</button>
          </div>
        )}
        </div>
        {hasConvo && !open && <button className="dock-reopen" onClick={() => { setAlertOnly(false); setLatestOnly(false); setOpen(true) }} title="Show the conversation">{said.length && !msgs.length ? `${AGENT_NAME} ↑` : `${Math.ceil(msgs.length / 2) + said.length} ↑`}</button>}
        <button onClick={() => send()}>Ask</button>
      </div>
    </div>
  )
}
