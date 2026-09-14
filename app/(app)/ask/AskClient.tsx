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
const THINKING = ['Reading your signals', 'Cross-referencing context', 'Checking the correspondence', 'Drafting response']

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



// Small source marks for the answer footer, matching the activity feed set.
const SRC_MARK: Record<string, React.ReactNode> = {
  gmail: <svg width="17" height="13" viewBox="0 0 24 18"><rect width="24" height="18" rx="2" fill="#fff"/><rect x=".5" y=".5" width="23" height="17" rx="1.5" fill="none" stroke="#ddd" strokeWidth=".5"/><path d="M2 2l10 7.5L22 2" stroke="#EA4335" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 2v14h20V2" stroke="#EA4335" strokeWidth="1.2" fill="none" strokeLinejoin="round" opacity=".25"/></svg>,
  slack: <svg width="14" height="14" viewBox="0 0 24 24"><path d="M9.5 2a2 2 0 100 4h2V4a2 2 0 00-2-2zM9.5 7h-5a2 2 0 100 4h5a2 2 0 100-4z" fill="#36C5F0"/><path d="M22 9.5a2 2 0 10-4 0v2h2a2 2 0 002-2zM17 9.5v-5a2 2 0 10-4 0v5a2 2 0 104 0z" fill="#2EB67D"/><path d="M14.5 22a2 2 0 100-4h-2v2a2 2 0 002 2zM14.5 17h5a2 2 0 100-4h-5a2 2 0 100 4z" fill="#ECB22E"/><path d="M2 14.5a2 2 0 104 0v-2H4a2 2 0 00-2 2zM7 14.5v5a2 2 0 104 0v-5a2 2 0 10-4 0z" fill="#E01E5A"/></svg>,
  zoom: <svg width="15" height="15" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#2D8CFF"/><path d="M5 9.4c0-.8.6-1.4 1.4-1.4h6.2c.8 0 1.4.6 1.4 1.4v5.2c0 .8-.6 1.4-1.4 1.4H6.4c-.8 0-1.4-.6-1.4-1.4V9.4z" fill="#fff"/><path d="M15 11l3.6-2.4c.4-.3 1-.1 1 .5v5.8c0 .6-.6.8-1 .5L15 13v-2z" fill="#fff"/></svg>,
  gcal: <svg width="14" height="14" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="18" rx="2.5" fill="#fff" stroke="#ddd" strokeWidth=".6"/><rect x="2" y="4" width="20" height="5" rx="2.5" fill="#4285F4"/><rect x="2" y="7" width="20" height="2" fill="#4285F4"/><path d="M7 2v4M17 2v4" stroke="#4285F4" strokeWidth="2" strokeLinecap="round"/></svg>,
  meet: <svg width="15" height="15" viewBox="0 0 24 24"><rect x="2" y="6" width="14" height="12" rx="2" fill="#00832D"/><path d="M16 10l5-3v10l-5-3v-4z" fill="#00AC47"/></svg>,
  hubspot: <svg width="14" height="14" viewBox="0 0 24 24"><circle cx="15" cy="14" r="5.2" fill="none" stroke="#FF7A59" strokeWidth="2.6"/><path d="M15 8.8V4.5M15 4.5a1.6 1.6 0 10-.01 0zM10.6 11.2L5.5 6.9M5.9 19.6l3.4-3.1" stroke="#FF7A59" strokeWidth="2.2" strokeLinecap="round"/></svg>,
  fireflies: <svg width="13" height="13" viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3" fill="#7C5CFC"/><path d="M5 11a7 7 0 0014 0M12 18v4M8.5 22h7" stroke="#7C5CFC" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>,
}
const SRC_NAME: Record<string, string> = { gmail: 'Gmail', slack: 'Slack', zoom: 'Zoom', gcal: 'Calendar', meet: 'Meet', hubspot: 'HubSpot', fireflies: 'Fireflies' }

// Parse the model's answer into the card shape the mobile app uses:
// title, tag chips, lead paragraph, evidence bullets, recommended play.
function parseAnswer(text: string) {
  const lines = text.split('\n')
  let title = ''
  let tags: string[] = []
  const body: string[] = []
  let play = ''
  let sources: string[] = []
  let inPlay = false
  lines.forEach((raw, i) => {
    const l = raw.trim()
    if (!l) { if (!inPlay) body.push(''); return }
    if (i === 0 && l.length < 70 && !/^[-*•]/.test(l)) { title = l.replace(/[.:]$/, ''); return }
    if (/^tags:/i.test(l)) { tags = l.replace(/^tags:/i, '').split('|').map(t => t.trim()).filter(Boolean); return }
    if (/^sources:/i.test(l)) { sources = l.replace(/^sources:/i, '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean); inPlay = false; return }
    if (/^(recommended play|counter-play|next move)\s*:?/i.test(l)) {
      inPlay = true
      play = l.replace(/^(recommended play|counter-play|next move)\s*:?/i, '').trim()
      return
    }
    if (inPlay) { play = (play + ' ' + l).trim(); return }
    body.push(l)
  })
  return { title, tags, body, play, sources }
}

function AnswerCard({ text }: { text: string }) {
  const { title, tags, body, play, sources } = parseAnswer(text)
  const sev = (tags[0] || '').toLowerCase()
  const sevColor = sev.includes('critical') || sev.includes('risk') ? 'var(--critical, #c43d2b)'
    : sev.includes('watch') ? 'var(--warn, #d38b1d)'
    : sev.includes('health') ? 'var(--good, #2f8f5b)' : 'var(--ink-muted)'
  const paras: React.ReactNode[] = []
  let buf: string[] = []
  const flush = (k: number) => {
    if (!buf.length) return
    paras.push(<p key={`p${k}`} style={{ margin: '0 0 14px', fontSize: 15.5, lineHeight: 1.65, color: 'var(--ink)' }}>{inline(buf.join(' '), k)}</p>)
    buf = []
  }
  body.forEach((l, i) => {
    if (!l) { flush(i); return }
    if (/^([-*•]|\d+[.)])\s/.test(l)) {
      flush(i)
      paras.push(
        <div key={`b${i}`} style={{ display: 'grid', gridTemplateColumns: '12px 1fr', gap: 11, padding: '6px 0', fontSize: 15, lineHeight: 1.6, color: 'var(--ink-muted)' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', marginTop: 9 }} />
          <div>{inline(l.replace(/^([-*•]|\d+[.)])\s/, ''), i)}</div>
        </div>
      )
      return
    }
    buf.push(l)
  })
  flush(999)

  return (
    <div style={{ background: 'var(--raised, #FFFDFA)', border: '1px solid var(--hairline, #EFEAE1)', boxShadow: '0 2px 12px rgba(14,13,11,.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 21.5 12 18 5.5 21.5 7 14.5 2 9.5 9 9 12 2"/></svg>
          Popsicle AI
        </span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.2px', color: 'var(--good, #2f8f5b)', border: '1px solid rgba(47,143,91,.3)', borderRadius: 999, padding: '2px 10px' }}>live</span>
      </div>
      <div style={{ padding: '18px 20px 20px' }}>
        {title && <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: '-.02em', color: 'var(--ink)', marginBottom: 10 }}>{title}</div>}
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {tags.map((t, i) => (
              <span key={i} style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 999,
                color: i === 0 ? sevColor : 'var(--ink-muted)',
                background: i === 0 ? (sevColor === 'var(--critical, #c43d2b)' ? 'rgba(196,61,43,.08)' : sevColor === 'var(--warn, #d38b1d)' ? 'rgba(211,139,29,.1)' : 'rgba(47,143,91,.08)') : 'var(--inset, #F0EDE7)' }}>{t}</span>
            ))}
          </div>
        )}
        {paras}
        {play && (
          <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(232,90,37,.05)', border: '1px solid rgba(232,90,37,.16)' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 7 }}>Recommended play</div>
            <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.6 }}>{inline(play, 0)}</div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--hairline, #EFEAE1)', fontSize: 12.5, color: 'var(--ink-faint)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--good, #2f8f5b)', fontWeight: 700 }}>✓</span> Generated by Popsicle AI
          </span>
          {sources.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase' }}>from</span>
              {sources.filter(x => SRC_MARK[x]).map(x => (
                <span key={x} title={SRC_NAME[x]} style={{ display: 'inline-flex', alignItems: 'center' }}>{SRC_MARK[x]}</span>
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  )
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
        <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginTop: i === 0 ? 8 : 26 }}>
          <div style={{ maxWidth: '78%', padding: '12px 18px', borderRadius: '18px 18px 4px 18px', background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', fontSize: 15.5, fontWeight: 500, lineHeight: 1.5, boxShadow: '0 6px 18px -8px rgba(255,107,53,.6)' }}>
            {m.content}
          </div>
        </div>
      ) : (
        <div key={i} style={{ marginTop: 16 }}>
          <AnswerCard text={m.content} />
        </div>
      ))}

      {busy && (
        <div style={{ marginTop: 16, background: 'var(--raised, #FFFDFA)', border: '1px solid var(--hairline, #EFEAE1)', padding: '16px 20px', maxWidth: 430 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ display: 'inline-flex', gap: 6, padding: '8px 14px', borderRadius: 999, background: 'var(--inset, #F0EDE7)' }}>
              {[0, 1, 2].map(i => (
                <span key={i} className="ask-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animationDelay: `${i * 0.18}s` }} />
              ))}
            </span>
            <span style={{ fontSize: 15, color: 'var(--ink-muted)' }}>{THINKING[phase]}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {['Signals', 'Accounts', 'Email', 'Calls'].map(x => (
              <span key={x} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink-faint)', border: '1px solid var(--hairline, #EFEAE1)', borderRadius: 999, padding: '4px 12px' }}>{x}</span>
            ))}
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
