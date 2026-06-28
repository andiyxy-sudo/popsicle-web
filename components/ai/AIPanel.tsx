'use client'

import { useState, useRef, useEffect } from 'react'

interface AIPanelProps {
  open: boolean
  onClose: () => void
  isDemo: boolean
  greetingName: string
}

interface Msg { role: 'user' | 'assistant'; content: string }

const SUGGESTION_GROUPS = [
  {
    cat: 'Risk & Alerts', color: 'var(--danger)',
    icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>,
    items: [
      'What are my top 3 priorities right now?',
      'Which accounts are most likely to churn this quarter?',
      'Why is Acme Corp high risk?',
      'What is the total ARR at risk right now?',
    ],
  },
  {
    cat: 'Draft & Outreach', color: 'var(--o)',
    icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="22 7 12 13 2 7"/></svg>,
    items: [
      'Draft a follow-up email to Acme Corp CFO',
      'Write a re-engagement message for Meridian Labs CEO',
      'Write a competitive battle card vs Gong',
    ],
  },
  {
    cat: 'Forecast & Revenue', color: 'var(--ok)',
    icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>,
    items: [
      'Show me this week forecast',
      'How much ARR can I protect if I act on all high risk accounts today?',
      'What is the best case forecast scenario for Q4?',
    ],
  },
]

export function AIPanel({ open, onClose, isDemo, greetingName }: AIPanelProps) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const msgsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function send(text: string) {
    const content = text.trim()
    if (!content || loading) return
    const next: Msg[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json()
      const reply = data.content || data.error || 'Sorry, I could not generate a response.'
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Something went wrong reaching the AI service. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const hasChat = messages.length > 0

  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,9,.18)', zIndex: 200, animation: 'fadeBg .2s ease' }} />}
      <div className={`ai-panel${open ? ' open' : ''}`}>
        <div className="ai-panel-hdr">
          <div className="ai-hdr-top">
            {hasChat && (
              <div onClick={() => setMessages([])} style={{ display: 'flex', width: 28, height: 28, borderRadius: 8, background: 'rgba(255,107,53,.08)', border: '1px solid rgba(255,107,53,.18)', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </div>
            )}
            <div className="ai-hdr-logo">
              <svg width="26" height="46" viewBox="0 0 48 86" fill="none">
                <defs><linearGradient id="pgai" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#FFB060"/><stop offset="100%" stopColor="#FF6B35"/></linearGradient></defs>
                <path d="M4 22C4 10.954 12.954 2 24 2h0c11.046 0 20 8.954 20 20v28c0 2.21-1.79 4-4 4H8c-2.21 0-4-1.79-4-4V22z" fill="url(#pgai)"/>
                <path d="M17 54h14v20a4 4 0 01-4 4h-6a4 4 0 01-4-4V54z" fill="#C4510A"/>
                <path d="M25 16L17 35h7l-4 15 13-19h-8l5-15z" fill="white" fillOpacity=".95"/>
              </svg>
            </div>
            <div>
              <div className="ai-hdr-title">Ask Popsicle</div>
              <div className="ai-hdr-sub">revenue intelligence OS · live</div>
            </div>
            <div className="ai-hdr-close" onClick={onClose}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
          </div>
          {isDemo && (
            <div className="ai-hdr-stats">
              <div className="ai-hdr-stat"><div className="v ok">847</div><div className="l">signals</div></div>
              <div className="ai-hdr-divider"></div>
              <div className="ai-hdr-stat"><div className="v ok">91%</div><div className="l">conf</div></div>
              <div className="ai-hdr-divider"></div>
              <div className="ai-hdr-stat"><div className="v red">$1.2M</div><div className="l">at risk</div></div>
              <div className="ai-hdr-divider"></div>
              <div className="ai-hdr-stat"><div className="v ok">$560K</div><div className="l">saved</div></div>
            </div>
          )}
        </div>

        <div className="ai-panel-msgs" ref={msgsRef}>
          {!hasChat ? (
            <div className="ai-suggestions-block" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '0 14px 10px', fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.65 }}>
                Hi {greetingName} — ask me anything about your pipeline, accounts, or signals.
              </div>
              {SUGGESTION_GROUPS.map((g, gi) => (
                <div key={gi}>
                  <div className="ai-sug-cat" style={{ padding: '10px 14px 5px' }}>{g.icon}<span style={{ color: g.color }}>{g.cat}</span></div>
                  {g.items.map((s, si) => (
                    <div key={si} className="ai-suggestion" onClick={() => send(s)}>
                      <svg className="ai-suggestion-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                      {s}
                    </div>
                  ))}
                  {gi < SUGGESTION_GROUPS.length - 1 && <div style={{ height: 1, background: 'rgba(13,10,7,.06)', margin: '3px 14px' }}></div>}
                </div>
              ))}
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div key={i} className={`ai-msg ${m.role === 'user' ? 'user' : 'bot'}`}>
                  {m.role === 'user' ? m.content : <div className="msg-text">{m.content}</div>}
                </div>
              ))}
              {loading && (
                <div className="ai-msg bot">
                  <div className="msg-text" style={{ display: 'flex', gap: 5 }}>
                    {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--o)', display: 'inline-block', animation: `aiBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="ai-panel-input">
          <div className="ai-input-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round" opacity=".5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && input.trim()) { send(input); } }}
              placeholder="Ask anything about your pipeline…"
            />
            <button className="ai-send-btn" onClick={() => input.trim() && send(input)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <div className="ai-input-hint">↵ to send · Esc to close</div>
        </div>
      </div>

      <style>{`
        @keyframes aiBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
        @keyframes fadeBg { from{opacity:0} to{opacity:1} }
      `}</style>
    </>
  )
}
