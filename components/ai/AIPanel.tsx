'use client'

import { useState, useRef, useEffect } from 'react'

interface AIPanelProps {
  open: boolean
  onClose: () => void
  isDemo: boolean
  greetingName: string
}

interface Followups { acts: { label: string; prompt?: string; color: string }[]; pills: { label: string; prompt: string }[] }
interface Msg { role: 'user' | 'assistant'; content: string; followups?: Followups }

// ---------- markdown -> clean HTML ----------
function formatAI(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:rgba(13,10,7,.06);padding:1px 5px;border-radius:5px;font-family:DM Mono,monospace;font-size:12px">$1</code>')
  const lines = text.split('\n')
  let html = ''
  let inList = false
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { if (inList) { html += '</ul>'; inList = false } continue }
    const bullet = line.match(/^[-*•]\s+(.*)$/)
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/)
    if (bullet) {
      if (!inList) { html += '<ul style="margin:6px 0 6px 2px;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px">'; inList = true }
      html += `<li style="display:flex;gap:8px;align-items:flex-start"><span style="color:var(--o);font-weight:900;line-height:1.5;flex-shrink:0">·</span><span style="flex:1">${inline(bullet[1])}</span></li>`
    } else if (numbered) {
      if (!inList) { html += '<ul style="margin:6px 0 6px 2px;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px">'; inList = true }
      html += `<li style="display:flex;gap:8px;align-items:flex-start"><span style="color:var(--o);font-weight:800;font-family:DM Mono,monospace;font-size:12px;flex-shrink:0;min-width:14px">${numbered[1]}.</span><span style="flex:1">${inline(numbered[2])}</span></li>`
    } else {
      if (inList) { html += '</ul>'; inList = false }
      html += `<p style="margin:0 0 8px">${inline(line)}</p>`
    }
  }
  if (inList) html += '</ul>'
  return html
}

// ---------- keyword-based follow-ups (demo) ----------
function getFollowups(q: string): Followups {
  const ql = q.toLowerCase()
  const A = (label: string, color: string, prompt?: string) => ({ label, color, prompt })
  const P = (label: string, prompt: string) => ({ label, prompt })

  if (ql.includes('acme') || ql.includes('sarah')) {
    return {
      acts: [A('📧 Draft CEO video', 'var(--danger)', 'Draft a CEO video outreach script for Acme Corp CFO Sarah Chen'), A('🚨 Escalate to CRO', 'var(--danger)', 'Draft an internal escalation to our CRO about Acme Corp')],
      pills: [P('What signals are driving churn?', 'What signals are driving Acme churn risk?'), P('Show me the email history', 'Show me all email signals for Acme Corp'), P('Best recovery play?', 'What is the best recovery play for Acme Corp right now?')],
    }
  }
  if (ql.includes('meridian')) {
    return {
      acts: [A('⚔️ Battle card', 'var(--danger)', 'Write a competitive battle card for Meridian Labs vs Gong'), A('📞 Re-engage CTO', 'var(--amber)', 'Draft a re-engagement message for Meridian Labs CTO')],
      pills: [P('How do we beat Gong?', 'How do we beat Gong in the Meridian evaluation?'), P('Forecast if we lose Meridian', 'What happens to Q4 forecast if Meridian churns?')],
    }
  }
  if (ql.includes('nexus')) {
    return {
      acts: [A('✉ Draft PO nudge', 'var(--ok)', 'Draft a gentle PO nudge email for Nexus AI')],
      pills: [P('When will they sign?', 'When is Nexus AI most likely to sign based on signals?'), P('Expansion potential?', 'What is the expansion potential for Nexus AI post close?')],
    }
  }
  if (ql.includes('forecast') || ql.includes('pipeline') || ql.includes('q4')) {
    return {
      acts: [A('🎯 Top 3 actions', 'var(--o)', 'What are my top 3 actions to protect the most ARR this week?')],
      pills: [P('Best vs worst case gap?', 'What is driving the gap between best case and worst case Q4?'), P('Which deals can still close?', 'Which at-risk deals can realistically still close in Q4?')],
    }
  }
  if (ql.includes('risk') || ql.includes('churn') || ql.includes('priorit') || ql.includes('urgent')) {
    return {
      acts: [A('🚨 Escalate Acme', 'var(--danger)', 'Draft an escalation plan for Acme Corp'), A('⚔️ Meridian battle card', 'var(--danger)', 'Write a competitive battle card for Meridian Labs vs Gong')],
      pills: [P('What is driving risk this week?', 'What is driving the biggest risk increase this week?'), P('Which rep has most exposure?', 'Which rep has the most ARR exposure right now?'), P('Recovery timeline?', 'If I act on all critical accounts today, what is the realistic recovery timeline?')],
    }
  }
  if (ql.includes('health') || ql.includes('score')) {
    return {
      acts: [A('🎯 Top actions to improve score', 'var(--o)', 'What are the top 3 actions to improve my pipeline health score above 85?')],
      pills: [P('What moves the score fastest?', 'What single action moves my pipeline health score the most this week?'), P('Breakdown by account', 'Break down the health score contribution by each account')],
    }
  }
  if (ql.includes('draft') || ql.includes('email') || ql.includes('write')) {
    return {
      acts: [],
      pills: [P('Best subject line for Acme?', 'What is the best email subject line to get Sarah Chen to reply?'), P('When to send?', 'What is the best time and day to send outreach to Sarah Chen?')],
    }
  }
  return {
    acts: [A('🎯 Top priorities', 'var(--danger)', 'What are my top 3 priorities right now?'), A('📊 Pipeline forecast', 'var(--o)', 'Give me the Q4 2026 pipeline forecast breakdown')],
    pills: [P('Why is Acme down 14%?', 'Why is Acme Corp down 14% this week?'), P('Win-back Meridian', 'What is the win-back strategy for Meridian Labs?'), P('Which deal closes first?', 'Which deal is most likely to close first and why?')],
  }
}

const CTX_CHIPS = [
  { name: 'Acme', color: 'var(--danger)' },
  { name: 'Meridian', color: 'var(--danger)' },
  { name: 'Nexus AI', color: 'var(--ok)' },
  { name: 'TechFlow', color: 'var(--amber)' },
]

const SUGGESTION_GROUPS = [
  { cat: 'Risk & Alerts', color: 'var(--danger)',
    icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>,
    items: ['What are my top 3 priorities right now?', 'Which accounts are most likely to churn this quarter?', 'Why is Acme Corp high risk?'] },
  { cat: 'Draft & Outreach', color: 'var(--o)',
    icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="22 7 12 13 2 7"/></svg>,
    items: ['Draft a follow-up email to Acme Corp CFO', 'Write a competitive battle card vs Gong'] },
  { cat: 'Forecast & Revenue', color: 'var(--ok)',
    icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>,
    items: ['Show me this week forecast', 'What is the best case forecast scenario for Q4?'] },
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
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      })
      const data = await res.json()
      const reply = data.content || data.error || 'Sorry, I could not generate a response.'
      const followups = data.content ? getFollowups(content) : undefined
      setMessages([...next, { role: 'assistant', content: reply, followups }])
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
        {/* Header */}
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

        {/* Context chips */}
        {isDemo && (
          <div className="ai-ctx-strip">
            {CTX_CHIPS.map((c, i) => (
              <div key={i} className={`ai-ctx-chip${i === 0 ? ' active' : ''}`} onClick={() => send(`Give me a status update on ${c.name}`)}>
                <div className="ai-ctx-dot" style={{ background: c.color }}></div>{c.name}
              </div>
            ))}
            <div className="ai-ctx-chip" style={{ color: 'var(--t4)' }}>+5</div>
          </div>
        )}

        {/* Messages */}
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
                <div key={i}>
                  <div className={`ai-msg ${m.role === 'user' ? 'user' : 'bot'}`}>
                    {m.role === 'user'
                      ? m.content
                      : (
                        <>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--o)', fontFamily: "'DM Mono',monospace", letterSpacing: '.8px', padding: '8px 14px 6px', borderBottom: '1px solid var(--border-soft)', background: 'var(--inset)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                            POPSICLE AI {isDemo ? '· 847 SIGNALS · 91% CONF' : ''}
                          </div>
                          <div className="msg-text" dangerouslySetInnerHTML={{ __html: formatAI(m.content) }} />
                          {/* Action buttons */}
                          {m.followups && m.followups.acts.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '10px 14px 6px', borderTop: '1px solid var(--border-soft)' }}>
                              {m.followups.acts.map((a, ai) => {
                                const bg = a.color === 'var(--danger)' ? 'rgba(220,38,38,.08)' : a.color === 'var(--ok)' ? 'rgba(22,163,74,.08)' : 'rgba(255,107,53,.08)'
                                const bd = a.color === 'var(--danger)' ? 'rgba(220,38,38,.2)' : a.color === 'var(--ok)' ? 'rgba(22,163,74,.2)' : 'rgba(255,107,53,.2)'
                                return (
                                  <div key={ai} onClick={() => a.prompt && send(a.prompt)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: bg, border: `1px solid ${bd}`, fontSize: 11, fontWeight: 700, color: a.color, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    {a.label}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          {/* Ask next pills */}
                          {m.followups && m.followups.pills.length > 0 && (
                            <div style={{ padding: '6px 14px 12px' }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t4)', marginBottom: 6 }}>Ask next</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {m.followups.pills.map((p, pi) => (
                                  <div key={pi} onClick={() => send(p.prompt)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: 20, background: 'var(--inset)', fontSize: 11, fontWeight: 600, color: 'var(--t2)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,107,53,.08)'; e.currentTarget.style.color = 'var(--o)' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--inset)'; e.currentTarget.style.color = 'var(--t2)' }}
                                  >
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                    {p.label}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                  </div>
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

        {/* Input */}
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
