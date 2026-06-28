'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Which accounts are most at risk this week?',
  'What buying signals have I seen from Acme Corp?',
  'Summarize my pipeline health',
  'Which deals have gone quiet in the last 2 weeks?',
]

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(text?: string) {
    const content = text ?? input.trim()
    if (!content || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      if (data.content) {
        setMessages([...newMessages, { role: 'assistant', content: data.content }])
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Topbar */}
      <header style={{
        height: 64, background: 'var(--surface)',
        boxShadow: '0 1px 4px rgba(13,10,7,.06)',
        display: 'flex', alignItems: 'center',
        padding: '0 28px', gap: 16, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--t4)', fontFamily: "'DM Mono', monospace", lineHeight: 1, marginBottom: 3 }}>
            Revenue Intelligence
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--t1)', lineHeight: 1 }}>
            Ask AI
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{
              marginLeft: 'auto', padding: '7px 14px',
              borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
              background: 'var(--inset)', fontSize: 12, fontWeight: 600,
              color: 'var(--t3)', cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
            }}
          >
            New chat
          </button>
        )}
      </header>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
        {messages.length === 0 ? (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
                background: 'linear-gradient(135deg, var(--o-bg), rgba(255,107,53,.12))',
                border: '1.5px solid var(--o-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', marginBottom: 8, letterSpacing: '-0.5px' }}>
                Ask about your revenue
              </h2>
              <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.6 }}>
                Ask questions about your accounts, signals, and pipeline. Powered by AI with context from your connected integrations.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  style={{
                    padding: '14px 16px', borderRadius: 'var(--r)',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    textAlign: 'left', cursor: 'pointer',
                    fontSize: 13, color: 'var(--t2)', fontWeight: 500,
                    fontFamily: "'Outfit', sans-serif",
                    boxShadow: 'var(--sh-sm)', transition: 'all .15s', lineHeight: 1.4,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--o-border)'
                    e.currentTarget.style.boxShadow = 'var(--sh-md), 0 0 0 3px var(--o-bg)'
                    e.currentTarget.style.color = 'var(--t1)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.boxShadow = 'var(--sh-sm)'
                    e.currentTarget.style.color = 'var(--t2)'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                gap: 12, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: msg.role === 'user'
                    ? 'linear-gradient(140deg,#FFB347,#FF6B35)'
                    : 'linear-gradient(135deg, var(--o-bg), rgba(255,107,53,.12))',
                  border: msg.role === 'assistant' ? '1px solid var(--o-border)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                  color: msg.role === 'user' ? '#fff' : 'var(--o)',
                }}>
                  {msg.role === 'user' ? 'U' : 'P'}
                </div>
                <div style={{
                  maxWidth: '80%',
                  background: msg.role === 'user' ? 'var(--o)' : 'var(--surface)',
                  borderRadius: msg.role === 'user' ? '18px 6px 18px 18px' : '6px 18px 18px 18px',
                  padding: '12px 16px',
                  fontSize: 14, lineHeight: 1.6,
                  color: msg.role === 'user' ? '#fff' : 'var(--t1)',
                  boxShadow: 'var(--sh-sm)',
                  border: msg.role === 'assistant' ? '1px solid var(--border-soft)' : 'none',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--o-bg), rgba(255,107,53,.12))',
                  border: '1px solid var(--o-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: 'var(--o)',
                }}>
                  P
                </div>
                <div style={{
                  background: 'var(--surface)', borderRadius: '6px 18px 18px 18px',
                  padding: '14px 18px', boxShadow: 'var(--sh-sm)',
                  border: '1px solid var(--border-soft)',
                  display: 'flex', gap: 5, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: '50%', background: 'var(--o)',
                      animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '16px 36px 24px',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border-soft)',
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <form
            onSubmit={e => { e.preventDefault(); handleSend() }}
            style={{
              display: 'flex', gap: 10, alignItems: 'flex-end',
              background: 'var(--inset)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '10px 14px',
              transition: 'all .2s',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--o)'
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--o-bg)'
              e.currentTarget.style.background = 'var(--surface)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.background = 'var(--inset)'
            }}
          >
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Ask about your accounts, signals, or pipeline..."
              rows={1}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 14, color: 'var(--t1)', resize: 'none',
                fontFamily: "'Outfit', sans-serif", lineHeight: 1.5,
                maxHeight: 120, overflowY: 'auto',
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none',
                background: input.trim() && !loading ? 'var(--o)' : 'var(--border)',
                color: '#fff', cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all .15s',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: 'var(--t4)' }}>
            Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  )
}
