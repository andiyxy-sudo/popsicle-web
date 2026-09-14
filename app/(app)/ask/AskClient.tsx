'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHead } from '@/components/layout/PageHead'

interface Msg { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Which account needs my attention most right now?',
  'Summarize the risk across my pipeline',
  'What did we last hear from kata.ai?',
  'What commitments are outstanding this week?',
]

export function AskClient() {
  const router = useRouter()
  const params = useSearchParams()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const fired = useRef(false)

  async function send(q?: string) {
    const question = (q ?? input).trim()
    if (!question || busy) return
    const next: Msg[] = [...msgs, { role: 'user', content: question }]
    setMsgs(next)
    setInput('')
    setBusy(true)
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next }) })
      const j = await r.json().catch(() => ({}))
      setMsgs([...next, { role: 'assistant', content: j.content || j.error || 'No answer came back. Try rephrasing.' }])
    } catch {
      setMsgs([...next, { role: 'assistant', content: 'Could not reach the co-pilot. Try again in a moment.' }])
    }
    setBusy(false)
  }

  // Deep link: /ask?q=... auto-sends once (transcript per-turn asks land here).
  useEffect(() => {
    const q = params.get('q')
    if (q && !fired.current) { fired.current = true; send(q) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  return (
    <div className="dsk-screen on" style={{ maxWidth: 760 }}>
      <PageHead
        eyebrow="Ask AI"
        crumb="grounded in your data"
        title={<>Ask anything.{' '}<span style={{ color: 'var(--ink-muted)' }}>Answers come from your signals, accounts, and correspondence.</span></>}
        right={<span onClick={() => router.back()} style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)', cursor: 'pointer' }}>back</span>}
      />

      <div style={{ paddingBottom: 8 }}>
        {msgs.length === 0 && !busy && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>Try asking</div>
            {SUGGESTIONS.map(sg => (
              <button key={sg} onClick={() => send(sg)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'var(--surface, #fff)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--t2)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>{sg}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{ maxWidth: '82%', padding: '11px 15px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.role === 'user' ? 'linear-gradient(135deg, #FF6B35, #FF8F5C)' : 'var(--surface, #fff)', border: m.role === 'user' ? 'none' : '1px solid var(--border)', color: m.role === 'user' ? '#fff' : 'var(--t1)', fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div style={{ display: 'flex', gap: 5, padding: '10px 4px' }}>
            {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--o)', opacity: .5, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * .18}s` }} />)}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ display: 'flex', gap: 9, paddingTop: 18, borderTop: '1px solid var(--hairline, #EFEAE1)', marginTop: 24 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Ask about any account, signal, or conversation"
          style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface, #fff)', color: 'var(--t1)', outline: 'none', fontFamily: "'Outfit',sans-serif" }}
        />
        <button onClick={() => send()} disabled={busy || !input.trim()} style={{ padding: '12px 22px', background: 'linear-gradient(135deg, #FF6B35, #FF8F5C)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", opacity: busy || !input.trim() ? .55 : 1, boxShadow: '0 4px 16px rgba(255,107,53,.3)' }}>Ask</button>
      </div>
    </div>
  )
}
