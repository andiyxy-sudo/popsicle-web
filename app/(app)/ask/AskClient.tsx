'use client'

// Ask AI, in the design's answer layout: the question as a headline, a live
// thinking state, then the answer set in readable prose with headings, lead-in
// bullets and a recommended play. The renderer is markdown-lite so whatever
// shape the model returns still reads cleanly.

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHead } from '@/components/layout/PageHead'

interface Msg { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Which account needs my attention most right now?',
  'Summarise the risk across my pipeline',
  'What did we last hear from Acme Corp?',
  'What should I send before the week closes?',
]
const THINKING = ['Reading your signals', 'Cross-referencing context', 'Checking the correspondence', 'Writing it up']

// ---- markdown-lite renderer -------------------------------------------------
function inline(text: string, key: number) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return (
    <span key={key}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>)}
    </span>
  )
}

function Answer({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  let para: string[] = []
  const flush = (k: number) => {
    if (!para.length) return
    out.push(
      <p key={`p${k}`} style={{ margin: '0 0 16px', fontSize: 16, lineHeight: 1.65, color: 'var(--ink-muted)' }}>
        {inline(para.join(' '), k)}
      </p>
    )
    para = []
  }
  lines.forEach((raw, i) => {
    const l = raw.trim()
    if (!l) { flush(i); return }
    if (/^#{1,6}\s/.test(l)) {
      flush(i)
      out.push(
        <h3 key={`h${i}`} style={{ margin: '26px 0 12px', fontSize: 17, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ink)' }}>
          {l.replace(/^#{1,6}\s/, '')}
        </h3>
      )
      return
    }
    if (/^([-*•]|\d+[.)])\s/.test(l)) {
      flush(i)
      const body = l.replace(/^([-*•]|\d+[.)])\s/, '')
      out.push(
        <div key={`b${i}`} style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 10, padding: '7px 0', fontSize: 15.5, lineHeight: 1.55, color: 'var(--ink-muted)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 9 }} />
          <div>{inline(body, i)}</div>
        </div>
      )
      return
    }
    para.push(l)
  })
  flush(9999)
  return <div>{out}</div>
}

export function AskClient() {
  const router = useRouter()
  const params = useSearchParams()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)
  const fired = useRef(false)

  // rotate the thinking line so it never looks frozen
  useEffect(() => {
    if (!busy) { setPhase(0); return }
    const t = setInterval(() => setPhase(p => (p + 1) % THINKING.length), 1800)
    return () => clearInterval(t)
  }, [busy])

  async function send(q?: string) {
    const question = (q ?? input).trim()
    if (!question || busy) return
    const next: Msg[] = [...msgs, { role: 'user', content: question }]
    setMsgs(next); setInput(''); setBusy(true)
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next }) })
      const j = await r.json().catch(() => ({}))
      setMsgs([...next, { role: 'assistant', content: j.content || j.error || 'No answer came back. Try rephrasing the question.' }])
    } catch {
      setMsgs([...next, { role: 'assistant', content: 'Could not reach the co-pilot. Try again in a moment.' }])
    }
    setBusy(false)
  }

  useEffect(() => {
    const q = params.get('q')
    if (q && !fired.current) { fired.current = true; send(q) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])
  useEffect(() => {
    if (msgs.length === 0) return
    const el = endRef.current
    if (!el) return
    // nearest keeps the shared content column from being yanked around, and
    // leaves no leftover offset behind when navigating away.
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [msgs, busy])

  const lastQuestion = [...msgs].reverse().find(m => m.role === 'user')?.content
  const label = { fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase' as const, color: 'var(--ink-faint)' }

  return (
    <div className="dsk-screen on" style={{ maxWidth: 820 }}>
      <PageHead
        eyebrow="Ask AI"
        crumb="grounded in your data"
        title={<>Ask anything. <span style={{ color: 'var(--ink-muted)' }}>Answers come from your signals, accounts and correspondence.</span></>}
      />

      {msgs.length === 0 && !busy && (
        <div>
          <div style={{ ...label, marginBottom: 6 }}>Try asking</div>
          {SUGGESTIONS.map(sg => (
            <div key={sg} onClick={() => send(sg)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '18px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer', fontSize: 16, color: 'var(--ink)' }}>
              <span>{sg}</span><span style={{ color: 'var(--accent)' }}>→</span>
            </div>
          ))}
        </div>
      )}

      {msgs.map((m, i) => m.role === 'user' ? (
        <div key={i} style={{ marginTop: i === 0 ? 0 : 46 }}>
          <div style={label}>You asked</div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(22px,2.6vw,30px)', letterSpacing: '-.035em', lineHeight: 1.18, marginTop: 10, color: 'var(--ink)' }}>{m.content}</div>
        </div>
      ) : (
        <div key={i} style={{ marginTop: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 12, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.02em', display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />Popsicle AI
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>grounded in your workspace</span>
          </div>
          <div style={{ marginTop: 22 }}><Answer text={m.content} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 22, fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>
            <span>Generated by Popsicle AI · signals, accounts, correspondence</span>
            <button onClick={() => { setMsgs([]); setInput('') }}
              style={{ font: 'inherit', fontSize: 13, fontWeight: 500, padding: '7px 16px', borderRadius: 999, border: 0, background: 'var(--accent-tint, #FFF1EA)', color: 'var(--accent)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>New question</button>
          </div>
        </div>
      ))}

      {busy && (
        <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px', background: 'rgba(14,13,11,.035)', maxWidth: 460, marginTop: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14.5, color: 'var(--ink-muted)' }}>
            <span style={{ display: 'inline-flex', gap: 5 }}>
              {[0, 1, 2].map(i => (
                <span key={i} className="ask-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animationDelay: `${i * 0.18}s` }} />
              ))}
            </span>
            {THINKING[phase]}
            {lastQuestion ? '' : ''}
          </div>
        </div>
      )}
      <div ref={endRef} />

      <div style={{ display: 'flex', gap: 10, marginTop: 34 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Ask about any deal, risk or signal"
          style={{ flex: 1, padding: '14px 0', border: 0, borderBottom: '1px solid var(--ink, #0E0D0B)', fontSize: 15.5, background: 'transparent', color: 'var(--ink)', outline: 'none', fontFamily: "'Outfit',sans-serif" }}
        />
        <button onClick={() => send()} disabled={busy || !input.trim()}
          style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', border: 0, borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", opacity: busy || !input.trim() ? .55 : 1, boxShadow: '0 6px 18px -6px rgba(255,107,53,.5)' }}>
          {busy ? 'Thinking' : 'Ask'}
        </button>
      </div>
    </div>
  )
}
