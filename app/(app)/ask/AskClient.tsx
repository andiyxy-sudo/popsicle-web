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
    <div className="dsk-screen on" style={{ maxWidth: 760, minHeight: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column' }}>
      <PageHead
        eyebrow="Ask AI"
        crumb="grounded in your data"
        title={<>Ask anything.{' '}<span style={{ color: 'var(--ink-muted)' }}>Answers come from your signals, accounts, and correspondence.</span></>}
      />

      {msgs.length === 0 && !busy && (
        <div>
          {SUGGESTIONS.map(sg => (
            <div key={sg} onClick={() => send(sg)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '18px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer', fontSize: 15, color: 'var(--ink)' }}>
              <span>{sg}</span><span style={{ color: 'var(--accent)' }}>→</span>
            </div>
          ))}
        </div>
      )}

      {msgs.map((m, i) => (
        <div key={i} style={{ padding: '20px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: m.role === 'user' ? 'var(--accent)' : 'var(--ink-faint)', marginBottom: 8 }}>
            {m.role === 'user' ? 'you' : 'popsicle'}
          </div>
          <div style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{m.content}</div>
        </div>
      ))}

      {busy && (
        <div style={{ padding: '20px 0', display: 'flex', gap: 5 }}>
          {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', opacity: .5 }} />)}
        </div>
      )}
      <div ref={endRef} />

      <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 28 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Ask about any account, signal, or conversation"
          style={{ flex: 1, padding: '14px 0', border: 0, borderBottom: '1px solid var(--ink, #0E0D0B)', fontSize: 15, background: 'transparent', color: 'var(--ink)', outline: 'none', fontFamily: "'Outfit',sans-serif" }}
        />
        <button onClick={() => send()} disabled={busy || !input.trim()} style={{ padding: '12px 26px', background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', border: 0, borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", opacity: busy || !input.trim() ? .55 : 1 }}>Ask</button>
      </div>
    </div>
  )
}
