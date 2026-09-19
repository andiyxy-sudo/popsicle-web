'use client'

// Ask AI, in the design's answer layout: the question as a headline, a live
// thinking state, then the answer set in readable prose with headings, lead-in
// bullets and a recommended play. The renderer is markdown-lite so whatever
// shape the model returns still reads cleanly.

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Msg { role: 'user' | 'assistant'; content: string }

// Quick actions answer "what do I do now". Deep dive answers "what is going on".
const QUICK = [
  { label: 'Top risks', sub: "This week's critical signals", q: 'What are my top risks this week and what should I do about each?' },
  { label: 'Interventions', sub: 'Accounts needing help now', q: 'Which accounts need intervention right now, ranked by exposure?' },
  { label: "Today's actions", sub: 'Priority queue, ranked', q: 'What should I do today, in priority order?' },
  { label: 'Gone quiet', sub: 'Accounts past their cadence', q: 'Which accounts have gone quiet past their normal reply cadence?' },
]

// built once, only when the empty state first renders
const deepCatalogue = (): Array<{ group: string; items: string[] }> => [
  { group: 'Risk analysis', items: [
    'Where is executive engagement declining?',
    'Which deals show accelerating churn signals?',
    'How much revenue is exposed to delays right now?',
    'Which accounts are at risk of losing to do-nothing?',
  ] },
  { group: 'Revenue intelligence', items: [
    'Forecast versus actual, month to date',
    'Where does the risk sit by stage?',
    'Which competitor keeps appearing in my deals?',
    'What is my win rate trend this quarter?',
  ] },
  { group: 'Actions and follow-ups', items: [
    'Which commitments have I not kept?',
    'What is unactioned by rep?',
    'Who is waiting on something from me?',
    'Which drafts should I send before the week closes?',
  ] },
]
let DEEP_CACHE: Array<{ group: string; items: string[] }> | null = null
const DEEP = () => (DEEP_CACHE ??= deepCatalogue())
const THINKING = ['Reading your signals', 'Cross-referencing context', 'Checking the correspondence', 'Drafting response']

// ---- markdown-lite renderer -------------------------------------------------
// Emoji status markers the model sometimes adds become quiet coloured dots.
const EMOJI_DOT: Record<string, string> = { '🔴': 'var(--critical, #c43d2b)', '🟠': 'var(--warn, #d38b1d)', '🟡': 'var(--warn, #d38b1d)', '🟢': 'var(--good, #2f8f5b)', '🔵': 'var(--blue, #2f6f9f)', '⚪': 'var(--ink-faint)' }
function inline(text: string, key: number) {
  // **bold**, *italic* / _italic_, `code`, and status emoji
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|[🔴🟠🟡🟢🔵⚪])/g).filter(Boolean)
  return (
    <span key={key}>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.slice(2, -2)}</strong>
        if ((p.startsWith('*') && p.endsWith('*') && p.length > 2) || (p.startsWith('_') && p.endsWith('_') && p.length > 2)) return <em key={i} style={{ fontStyle: 'italic', color: 'var(--ink)' }}>{p.slice(1, -1)}</em>
        if (p.startsWith('`') && p.endsWith('`')) return <code key={i} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.92em', background: 'var(--inset, #F4F0E8)', padding: '1px 6px', borderRadius: 5 }}>{p.slice(1, -1)}</code>
        if (EMOJI_DOT[p]) return <span key={i} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: EMOJI_DOT[p], marginLeft: 6, verticalAlign: 'middle', position: 'relative', top: -1 }} />
        return <span key={i}>{p}</span>
      })}
    </span>
  )
}
// Numbered items ("1. Acme Corp - CFO silent 8 days ($480K)") become titled rows.
function splitNumbered(t: string): { n: string; title: string; figure: string | null } | null {
  const m = t.match(/^(\d+)[.)]\s+(.*)$/)
  if (!m) return null
  let title = m[2].replace(/\*\*/g, '').trim()
  const fig = title.match(/\(([^)]*[$\d][^)]*)\)\s*([🔴🟠🟡🟢🔵⚪])?\s*$/)
  let figure: string | null = null
  if (fig) { figure = fig[1]; title = title.slice(0, fig.index).trim() + (fig[2] ? ` ${fig[2]}` : '') }
  return { n: m[1], title, figure }
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
        <div key={`b${i}`} className="ans-in" style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 10, padding: '7px 0', fontSize: 15.5, lineHeight: 1.55, color: 'var(--ink-muted)' }}>
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
  let stats: Array<{ v: string; k: string }> = []
  let sources: string[] = []
  let inPlay = false
  lines.forEach((raw, i) => {
    const l = raw.trim()
    if (!l) { if (!inPlay) body.push(''); return }
    if (i === 0 && l.length < 70 && !/^[-*•]/.test(l) && !/[.!?]$/.test(l)) { title = l.replace(/\*\*/g, '').replace(/[.:]$/, ''); return }
    if (/^tags:/i.test(l)) { tags = l.replace(/^tags:/i, '').split('|').map(t => t.trim()).filter(Boolean); return }
    if (/^stats:/i.test(l)) {
      stats = l.replace(/^stats:/i, '').split(',').map(pair => {
        const [v, k] = pair.split('|').map(x => x.trim())
        return v && k ? { v, k } : null
      }).filter(Boolean) as Array<{ v: string; k: string }>
      return
    }
    if (/^sources:/i.test(l)) { sources = l.replace(/^sources:/i, '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean); inPlay = false; return }
    if (/^(recommended play|recommended move|recommended|counter-play|next move|the move)\s*:?/i.test(l)) {
      inPlay = true
      play = l.replace(/^(recommended play|recommended move|recommended|counter-play|next move|the move)\s*:?/i, '').trim()
      return
    }
    if (inPlay) { play = (play + ' ' + l).trim(); return }
    body.push(l)
  })
  // Fallbacks: if the model ignored the shape, derive what we can from the text.
  const flat = [title, ...body].join(' ')
  if (!title && body.length) {
    const first = (body.find(Boolean) || '').trim()
    // Only promote a genuinely short opening line to the title, and never
    // slice a sentence: a cut-off headline reads worse than no headline.
    if (first && first.length <= 64 && !/[.!?]$/.test(first)) {
      title = first
      body.splice(body.indexOf(first), 1)
    }
  }
  title = title.replace(/\*\*/g, '').replace(/^#+\s*/, '').replace(/[:.]$/, '').trim()
  if (!tags.length) {
    const t: string[] = []
    if (/\bcritical\b/i.test(flat)) t.push('Critical')
    else if (/\bat risk\b|\brisk\b/i.test(flat)) t.push('At risk')
    else if (/\bwatch\b|\bquiet\b|\bstall/i.test(flat)) t.push('Watch')
    else if (/\bhealthy\b|\bpositive\b|\bmomentum\b/i.test(flat)) t.push('Healthy')
    const money = flat.match(/\$[\d.,]+[KMB]?/)
    if (money) t.push(`${money[0]} in play`)
    tags = t
  }
  return { title, tags, body, play, sources, stats }
}

// Follow-ups drawn from what the answer actually mentions, so they are useful
// rather than decorative.
// Pull the account an answer is about, used by the draft and source actions.
function accountOf(text: string): string | null {
  const m = text.replace(/\*\*/g, '').match(/\b([A-Z][a-zA-Z0-9.&-]+(?: [A-Z][a-zA-Z0-9.&-]+){0,2})\b/g) || []
  const stop = new Set(['Today', 'Tomorrow', 'Recommended', 'Play', 'Critical', 'Backup', 'The', 'This', 'Your', 'No', 'Email', 'Slack', 'Gmail', 'Sources', 'Stats', 'Tags'])
  return m.map(x => x.trim()).find(x => x.includes(' ') && !stop.has(x.split(' ')[0])) ?? null
}

function followUps(text: string): string[] {
  // Pull a likely account name straight out of the answer: two or three
  // capitalised words, which is how accounts are written throughout.
  const acct = accountOf(text)
  const out: string[] = []
  if (acct) {
    out.push(`Draft a follow-up to ${acct}`)
    out.push(`Why is ${acct} at risk?`)
    out.push(`Who should I contact at ${acct}?`)
  } else {
    out.push('What should I do first today?')
    out.push('Which accounts have gone quiet?')
    out.push('Where is my biggest exposure?')
  }
  return out.slice(0, 3)
}

// A clarifying question renders as its own compact card with pickable options.
function ClarifyCard({ line, onAsk }: { line: string; onAsk: (q: string) => void }) {
  const parts = line.replace(/^clarify:\s*/i, '').split('|').map(x => x.trim()).filter(Boolean)
  const question = parts[0] || 'Which did you mean?'
  const options = parts.slice(1)
  return (
    <div style={{ maxWidth: 700, background: 'var(--raised, #FFFDFA)', border: '1px solid rgba(232,90,37,.22)', borderRadius: 16, padding: '18px 22px 20px', boxShadow: '0 4px 20px -8px rgba(14,13,11,.1)' }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 9 }}>One quick thing</div>
      <div style={{ fontSize: 16.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45, marginBottom: 14 }}>{question}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {options.map(o => (
          <button key={o} onClick={() => onAsk(o)} className="ask-chip"
            style={{ font: 'inherit', fontSize: 13.5, fontWeight: 500, padding: '9px 16px', borderRadius: 999, border: '1px solid var(--hairline, #EFEAE1)', background: 'var(--paper, #FBF8F3)', color: 'var(--ink-muted)', cursor: 'pointer' }}>{o}</button>
        ))}
      </div>
    </div>
  )
}


// Any quoted passage the answer offers as something to send - a draft email,
// an opening line, a message - is lifted into its own block with its own copy
// action, so the words can be taken without the commentary around them.
function Quotable({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="ans-in" style={{ position: 'relative', margin: '14px 0 16px', padding: '16px 18px 16px 20px', background: 'var(--paper, #FBF8F3)', border: '1px solid var(--hairline, #EFEAE1)', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 9 }}>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Ready to send</span>
        <button onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600) }}
          className="ask-ghost"
          style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '1.4px', textTransform: 'uppercase', background: 'none', border: 0, color: done ? 'var(--good, #2f8f5b)' : 'var(--accent)', cursor: 'pointer', padding: 0 }}>
          {done ? 'copied' : 'copy'}
        </button>
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  )
}

function AnswerCard({ text, streaming = false, onAsk, onInspect, onDraft }: { text: string; streaming?: boolean; onAsk: (q: string) => void; onInspect: (src: string) => void; onDraft: (acct: string | null, play: string) => void }) {
  const [copied, setCopied] = useState(false)
  // While the answer is still arriving, drop the final partial line and any
  // control line that has not finished yet. Structure appears as it settles,
  // so the reader never sees raw markup or a half-typed word.
  const safeText = streaming
    ? (() => {
        const lines = text.split('\n')
        if (lines.length > 1) lines.pop()
        else if (!/[.!?:]\s*$/.test(lines[0] || '')) return ''
        return lines.filter(l => !/^(tags|stats|sources|clarify):/i.test(l.trim()) || /\n/.test(l)).join('\n')
      })()
    : text
  const { title, tags, body, play, sources, stats } = parseAnswer(safeText)
  const sev = (tags[0] || '').toLowerCase()
  const sevColor = sev.includes('critical') || sev.includes('risk') ? 'var(--critical, #c43d2b)'
    : sev.includes('watch') ? 'var(--warn, #d38b1d)'
    : sev.includes('health') ? 'var(--good, #2f8f5b)' : 'var(--ink-muted)'
  const paras: React.ReactNode[] = []
  let buf: string[] = []
  const flush = (k: number) => {
    if (!buf.length) return
    paras.push(<p key={`p${k}`} style={{ margin: '0 0 15px', fontSize: 15.5, lineHeight: 1.72, letterSpacing: '-.004em', color: 'var(--ink)', maxWidth: 620 }}>{inline(buf.join(' '), k)}</p>)
    buf = []
  }
  body.forEach((l, i) => {
    if (!l) { flush(i); return }
    // section heading ("# Not yours, but flag to reps" or "Not yours:") → quiet mono label
    if (/^#{1,6}\s/.test(l)) {
      flush(i)
      paras.push(<div key={`h${i}`} className="ans-in" style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)', margin: '26px 0 6px', paddingBottom: 8, borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>{l.replace(/^#{1,6}\s/, '').replace(/[*_:]+$/, '')}</div>)
      return
    }
    // numbered item → titled row with the figure as a chip
    const num = splitNumbered(l)
    if (num) {
      flush(i)
      paras.push(
        <div key={`n${i}`} className="ans-in" style={{ display: 'grid', gridTemplateColumns: '26px minmax(0,1fr)', gap: 12, alignItems: 'baseline', margin: '22px 0 6px', paddingTop: 16, borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--accent)' }}>{num.n.padStart(2, '0')}</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: '-.02em', color: 'var(--ink)', lineHeight: 1.3 }}>{inline(num.title, i)}</span>
            {num.figure && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: 'var(--accent)', background: 'rgba(232,90,37,.07)', padding: '2px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>{num.figure}</span>}
          </span>
        </div>
      )
      return
    }
    // a line that is mostly a quotation, or is marked as a draft, is content
    // to be sent rather than prose to be read
    const q = l.match(/^(?:draft|subject|send|message|say)?\s*:?\s*["“](.+)["”]\.?$/i)
    if (q && q[1].length > 24) {
      flush(i)
      paras.push(<Quotable key={`q${i}`} text={q[1]} />)
      return
    }
    if (/^([-*•]|\d+[.)])\s/.test(l)) {
      flush(i)
      const t = l.replace(/^([-*•]|\d+[.)])\s/, '')
      const clean = t.replace(/\*\*/g, '')
      // "Account | $850K | detail" becomes a titled row: name, figure, detail.
      const piped = clean.split('|').map(x => x.trim())
      if (piped.length >= 3 && piped[0].length <= 34 && /[$\d]/.test(piped[1])) {
        paras.push(
          <div key={`b${i}`} className="ans-in" style={{ padding: '16px 0', borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 5 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-.015em' }}>{piped[0]}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: 'var(--accent)', background: 'rgba(232,90,37,.07)', padding: '2px 9px', borderRadius: 999 }}>{piped[1]}</span>
            </div>
            <div style={{ fontSize: 14.5, lineHeight: 1.68, color: 'var(--ink-muted)' }}>{inline(piped.slice(2).join(' · '), i)}</div>
          </div>
        )
        return
      }
      // otherwise a normal bullet, with any "Label:" lead-in set in ink
      const m2 = t.match(/^([^:*]{2,28}):\s+(.*)$/)
      paras.push(
        <div key={`b${i}`} className="ans-in" style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 13, padding: '7px 0 7px 38px', fontSize: 15, lineHeight: 1.7, letterSpacing: '-.002em', color: 'var(--ink-muted)' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', marginTop: 9 }} />
          <div>{m2 && !t.startsWith('**')
            ? <><strong style={{ fontWeight: 600, color: 'var(--ink)' }}>{m2[1]}:</strong> {inline(m2[2], i)}</>
            : inline(t, i)}</div>
        </div>
      )
      return
    }
    buf.push(l)
  })
  flush(999)

  return (
    <div className="ask-answer" style={{ position: 'relative', maxWidth: 700, background: 'var(--raised, #FFFDFA)', border: '1px solid var(--hairline, #EFEAE1)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px -8px rgba(14,13,11,.12)' }}>
      {streaming && <div className="ans-rail" aria-hidden />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 21.5 12 18 5.5 21.5 7 14.5 2 9.5 9 9 12 2"/></svg>
          Popsicle AI
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <button className="ask-copy" onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
            style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', background: 'none', border: 0, color: 'var(--ink-faint)', cursor: 'pointer' }}>
            {copied ? 'copied' : 'copy'}
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
            <span className={streaming ? 'live-dot writing' : 'live-dot'} />
            {streaming ? 'writing' : 'live'}
          </span>
        </span>
      </div>
      <div style={{ padding: '22px 26px 24px', fontVariantNumeric: 'tabular-nums' }}>
        {title && <div className="ans-in" style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 21, letterSpacing: '-.03em', color: 'var(--ink)', marginBottom: 10, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{title}</div>}
        {tags.length > 0 && (
          <div className="ans-in" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {tags.map((t, i) => (
              <span key={i} style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 999,
                color: i === 0 ? sevColor : 'var(--ink-muted)',
                background: i === 0 ? (sevColor === 'var(--critical, #c43d2b)' ? 'rgba(196,61,43,.08)' : sevColor === 'var(--warn, #d38b1d)' ? 'rgba(211,139,29,.1)' : 'rgba(47,143,91,.08)') : 'var(--inset, #F0EDE7)' }}>{t}</span>
            ))}
          </div>
        )}
        {stats.length > 0 && (
          <div className="ans-in" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, 1fr)`, gap: 10, margin: '4px 0 16px' }}>
            {stats.slice(0, 3).map((st, i) => (
              <div key={i} style={{ background: 'var(--inset, #F0EDE7)', borderRadius: 12, padding: '14px 10px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-.03em', color: i === 0 ? sevColor : 'var(--good, #2f8f5b)' }}>{st.v}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 3 }}>{st.k}</div>
              </div>
            ))}
          </div>
        )}
        {paras}
        {streaming && paras.length === 0 && (
          <div className="ans-skeleton" aria-hidden>
            <span style={{ width: '54%' }} /><span style={{ width: '92%' }} /><span style={{ width: '78%' }} />
          </div>
        )}
        {streaming && paras.length > 0 && <span className="ans-caret" aria-hidden />}
        {play && (
          <div className="ans-play" style={{ marginTop: 18 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.8px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 9 }}>Recommended play</div>
            {(() => {
              const parts = play.split(/(?<=[.!?])\s+(?=[A-Z"'])/).map(x => x.trim()).filter(Boolean)
              const [action, ...notes] = parts
              return (
                <>
                  <div style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.55, letterSpacing: '-.01em' }}>{inline(action, 0)}</div>
                  {notes.filter(n => /^["“].+["”]\.?$/.test(n)).map((n, i) => (
                    <Quotable key={`pq${i}`} text={n.replace(/^["“]|["”]\.?$/g, '')} />
                  ))}
                  {notes.filter(n => !/^["“].+["”]\.?$/.test(n)).length > 0 && (
                    <div style={{ marginTop: 10, display: 'grid', gap: 7 }}>
                      {notes.filter(n => !/^["“].+["”]\.?$/.test(n)).map((n, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '11px 1fr', gap: 10, alignItems: 'baseline' }}>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(232,90,37,.5)', marginTop: 8 }} />
                          <span style={{ fontSize: 14.5, color: 'var(--ink-muted)', lineHeight: 1.62 }}>{inline(n, i + 1)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )
            })()}
            <button onClick={() => onDraft(accountOf(text), play)}
              style={{ marginTop: 13, font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '10px 20px', borderRadius: 999, border: 0, background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', cursor: 'pointer', boxShadow: '0 6px 18px -8px rgba(255,107,53,.6)' }}>
              Draft this email
            </button>
          </div>
        )}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 9 }}>Ask next</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {followUps(text).map(q => (
              <button key={q} onClick={() => onAsk(q)} className="ask-chip"
                style={{ font: 'inherit', fontSize: 13, fontWeight: 500, padding: '8px 14px', borderRadius: 999, border: '1px solid var(--hairline, #EFEAE1)', background: 'var(--paper, #FBF8F3)', color: 'var(--ink-muted)', cursor: 'pointer' }}>{q}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--hairline, #EFEAE1)', fontSize: 12.5, color: 'var(--ink-faint)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--good, #2f8f5b)', fontWeight: 700 }}>✓</span> Generated by Popsicle AI
          </span>
          {sources.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase' }}>from</span>
              {sources.filter(x => SRC_MARK[x]).map(x => (
                <button key={x} title={`See what was read from ${SRC_NAME[x]}`} onClick={() => onInspect(x)} className="ask-ghost"
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>{SRC_MARK[x]}</button>
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
  const [atBottom, setAtBottom] = useState(true)
  const [deepGroup, setDeepGroup] = useState(0)
  type Hist = { id: string; question: string; answer: string; pinned: boolean; created_at: string }
  const [history, setHistory] = useState<Hist[]>([])
  const [sourceCount, setSourceCount] = useState<number | null>(null)
  const [streamingIdx, setStreamingIdx] = useState<number | null>(null)
  const [opener, setOpener] = useState<{ q: string; line: string } | null>(null)
  const [inspect, setInspect] = useState<string | null>(null)
  const [inspectRows, setInspectRows] = useState<Array<{ id: string; title: string; sub: string; at: string | null }> | null>(null)

  // (1) turn a recommended play into a real draft: open the composer on the
  // account's live signal, which is where the send pipeline already lives.
  async function draftFromPlay(acct: string | null, _play: string) {
    if (!acct) { router.push('/signals'); return }
    const supa = createClient()
    const { data: { user } } = await supa.auth.getUser()
    if (!user) { router.push('/signals'); return }
    const { data } = await supa.from('signals').select('id, severity')
      .eq('user_id', user.id).eq('account_name', acct).eq('is_dismissed', false)
      .or('status.is.null,status.eq.open').order('created_at', { ascending: false }).limit(10)
    const rows = (data ?? []) as Array<{ id: string; severity: string | null }>
    const top = rows.find(r => r.severity === 'high') ?? rows[0]
    if (top) router.push(`/signals?signal=${top.id}&action=reply`)
    else router.push(`/accounts/${encodeURIComponent(acct)}`)
  }

  // (2) show what was actually read from a source, for the account in question
  useEffect(() => {
    if (!inspect) { setInspectRows(null); return }
    let dead = false
    const acct = accountOf([...msgs].reverse().find(m => m.role === 'assistant')?.content || '')
    ;(async () => {
      const supa = createClient()
      const { data: { user } } = await supa.auth.getUser()
      if (!user) { if (!dead) setInspectRows([]); return }
      const msgQ = supa.from('messages').select('id, sender, subject, content, received_at')
        .eq('user_id', user.id).eq('integration', inspect)
        .order('received_at', { ascending: false }).limit(6)
      if (acct) msgQ.eq('account_name', acct)
      const sigQ = supa.from('signals').select('id, title, description, created_at')
        .eq('user_id', user.id).eq('source_integration', inspect)
        .order('created_at', { ascending: false }).limit(6)
      if (acct) sigQ.eq('account_name', acct)
      const [m1, s1] = await Promise.all([msgQ, sigQ])
      if (dead) return
      const rows = [
        ...((m1.data ?? []) as Array<{ id: string; sender: string | null; subject: string | null; content: string | null; received_at: string | null }>)
          .map(m => ({ id: `m${m.id}`, title: m.subject || (m.sender || 'Message'), sub: String(m.content || '').slice(0, 160), at: m.received_at })),
        ...((s1.data ?? []) as Array<{ id: string; title: string | null; description: string | null; created_at: string | null }>)
          .map(x => ({ id: `s${x.id}`, title: x.title || 'Signal', sub: String(x.description || '').slice(0, 160), at: x.created_at })),
      ].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 8)
      setInspectRows(rows)
    })()
    return () => { dead = true }
  }, [inspect, msgs])
  const [mountedHist, setMountedHist] = useState(false)
  useEffect(() => {
    setMountedHist(true)
    if (typeof document !== 'undefined' && document.body.dataset.demo === '1') { setSourceCount(4); return }
    const supa = createClient()
    supa.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supa.from('integrations').select('provider', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_active', true)
        .then(({ count }) => setSourceCount(count ?? 0))
    })
  }, [])

  async function loadHistory() {
    if (typeof document !== 'undefined' && document.body.dataset.demo === '1') return
    const supa = createClient()
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return
    const { data } = await supa.from('ask_history')
      .select('id, question, answer, pinned, created_at')
      .eq('user_id', user.id)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(12)
    setHistory((data as Hist[]) ?? [])
  }
  useEffect(() => { loadHistory() }, [])

  // (5) open with the thing that actually changed, not a generic prompt
  useEffect(() => {
    let dead = false
    ;(async () => {
      const supa = createClient()
      const { data: { user } } = await supa.auth.getUser()
      if (!user || dead) return
      const { data } = await supa.from('signals')
        .select('account_name, title, severity, created_at')
        .eq('user_id', user.id).eq('is_dismissed', false).eq('severity', 'high')
        .or('status.is.null,status.eq.open')
        .order('created_at', { ascending: false }).limit(1)
      const top = (data ?? [])[0] as { account_name: string | null; title: string | null } | undefined
      if (!top?.account_name || dead) return
      setOpener({
        q: `What should I do about ${top.account_name}?`,
        line: `${top.account_name}: ${top.title}`,
      })
    })()
    return () => { dead = true }
  }, [])

  async function togglePin(h: Hist) {
    setHistory(prev => prev.map(x => x.id === h.id ? { ...x, pinned: !x.pinned } : x))
    await createClient().from('ask_history').update({ pinned: !h.pinned }).eq('id', h.id)
    loadHistory()
  }
  function reopen(h: Hist) {
    setMsgs([{ role: 'user', content: h.question }, { role: 'assistant', content: h.answer }])
  }
  const started = msgs.length > 0 || busy

  const endRef = useRef<HTMLDivElement>(null)
  const paneRef = useRef<HTMLDivElement>(null)
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
      const r = await fetch('/api/ask', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next, stream: true }),
      })
      let answer = ''
      const ct = r.headers.get('content-type') || ''
      if (r.body && ct.includes('text/plain')) {
        // append deltas as they arrive so reading can start immediately
        const reader = r.body.getReader()
        const dec = new TextDecoder()
        setMsgs([...next, { role: 'assistant', content: '' }])
        setStreamingIdx(next.length)
        setBusy(false)
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          answer += dec.decode(value, { stream: true })
          setMsgs([...next, { role: 'assistant', content: answer }])
        }
      } else {
        const j = await r.json().catch(() => ({}))
        answer = j.content || j.error || 'No answer came back. Try rephrasing the question.'
        setMsgs([...next, { role: 'assistant', content: answer }])
      }
      setStreamingIdx(null)
      const j = { content: answer }
      // keep the exchange so it can be found again later
      if (j.content && !(typeof document !== 'undefined' && document.body.dataset.demo === '1')) {
        const supa = createClient()
        supa.auth.getUser().then(({ data: { user } }) => {
          if (!user) return
          supa.from('ask_history').insert({ user_id: user.id, question, answer }).then(() => loadHistory(), () => {})
        })
      }
    } catch {
      setStreamingIdx(null)
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
    // scroll only the conversation pane, and only if the reader is already
    // following along - never yank them away from something they scrolled to
    const pane = paneRef.current
    if (pane && atBottom) pane.scrollTo({ top: pane.scrollHeight, behavior: 'smooth' })
  }, [msgs, busy])

  const lastQuestion = [...msgs].reverse().find(m => m.role === 'user')?.content
  const label = { fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase' as const, color: 'var(--ink-faint)' }

  return (
    <div className="dsk-screen on ask-screen" style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flexShrink: 0 }}>
        {/* the page header holds the top until a question is asked, then the
            conversation takes over and the utility row moves under the input */}
        {!started && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, minHeight: 36 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
              Ask AI <span style={{ margin: '0 8px' }}>/</span> grounded in your data
            </div>
          </div>
        )}
        {/* the headline earns its space only before the first question */}
        <div style={{
          maxHeight: started ? 0 : 260, opacity: started ? 0 : 1, overflow: 'hidden',
          transition: 'max-height .45s cubic-bezier(.22,.61,.36,1), opacity .25s ease',
        }}>
          <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.4vw,44px)', letterSpacing: '-.035em', margin: '18px 0 0', lineHeight: 1.14, maxWidth: 920, color: 'var(--ink)' }}>
            Ask anything. <span style={{ color: 'var(--ink-muted)' }}>Answers come from your <span style={{ color: 'var(--accent)' }}>signals</span>, accounts and correspondence.</span>
          </h1>
          <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '32px 0 0' }} />
        </div>
      </div>

      <div ref={paneRef}
        onScroll={e => {
          const el = e.currentTarget
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60)
        }}
        style={{
          flex: started ? 1 : '0 0 auto', minHeight: 0, overflowY: started ? 'auto' : 'visible', paddingRight: 4,
          paddingTop: started ? 12 : 18, marginTop: started ? -34 : 0,
          // content dissolves at the edges instead of being cut by the boundary
          ...(started ? {
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 18px), transparent 100%)',
            maskImage: 'linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 18px), transparent 100%)',
          } : {}),
        }}>
      {msgs.length === 0 && !busy && (
        <div>
          {opener && (
            <div onClick={() => send(opener.q)} className="ask-suggest"
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', marginBottom: 26, cursor: 'pointer',
                background: 'rgba(232,90,37,.05)', border: '1px solid rgba(232,90,37,.18)', borderRadius: 14 }}>
              <span className="sig-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>Since you were last here</div>
                <div style={{ fontSize: 15.5, color: 'var(--ink)', lineHeight: 1.45 }}>{opener.line}</div>
              </div>
              <span className="ask-suggest-arrow" style={{ color: 'var(--accent)', fontSize: 15, flex: 'none' }}>→</span>
            </div>
          )}

          {history.length > 0 && (
            <div style={{ marginBottom: 34 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 10 }}>
                {history.some(h => h.pinned) ? 'Saved and recent' : 'Recent questions'}
              </div>
              {history.map(h => (
                <div key={h.id} className="ask-suggest"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer' }}
                  onClick={() => reopen(h)}>
                  <button onClick={e => { e.stopPropagation(); togglePin(h) }} title={h.pinned ? 'Unsave' : 'Save this answer'}
                    className="ask-ghost"
                    style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, lineHeight: 1, color: h.pinned ? 'var(--accent)' : 'var(--ink-faint)', flex: 'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={h.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                      <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" />
                    </svg>
                  </button>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.question}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: 'var(--ink-faint)', flex: 'none' }}>
                    {mountedHist ? new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* start here: four quick actions as a quiet 2x2 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
            {QUICK.map(a => (
              <div key={a.label} onClick={() => send(a.q)} className="ask-quick"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '18px 20px', borderRadius: 14, cursor: 'pointer',
                  background: 'var(--inset, #F4F0E8)', transition: 'background .15s ease, transform .15s ease' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{a.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 3 }}>{a.sub}</div>
                </div>
                <span className="ask-suggest-arrow" style={{ color: 'var(--accent)', flex: 'none', fontSize: 15 }}>→</span>
              </div>
            ))}
          </div>

          {/* explore: one group at a time, chosen with pills */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 40, paddingBottom: 12, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 17, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ink)' }}>Or explore</div>
            <div style={{ display: 'inline-flex', background: 'var(--inset, #F4F0E8)', borderRadius: 999, padding: 3 }}>
              {DEEP().map((sec, i) => (
                <button key={sec.group} onClick={() => setDeepGroup(i)}
                  style={{ font: 'inherit', fontSize: 12.5, fontWeight: deepGroup === i ? 600 : 500, padding: '6px 14px', borderRadius: 999, border: 0, cursor: 'pointer',
                    background: deepGroup === i ? 'var(--ink)' : 'transparent', color: deepGroup === i ? '#fff' : 'var(--ink-muted)', transition: 'background .15s ease, color .15s ease' }}>
                  {sec.group}
                </button>
              ))}
            </div>
          </div>
          <div key={deepGroup} className="fade-in">
            {DEEP()[deepGroup].items.map(q => (
              <div key={q} onClick={() => send(q)} className="ask-suggest"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '15px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer', fontSize: 15, color: 'var(--ink)' }}>
                <span style={{ minWidth: 0 }}>{q}</span>
                <span className="ask-suggest-arrow" style={{ color: 'var(--ink-faint)', flex: 'none' }}>›</span>
              </div>
            ))}
          </div>
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
          {/^clarify:/i.test(m.content.trim())
            ? <ClarifyCard line={m.content.trim()} onAsk={send} />
            : <AnswerCard text={m.content} streaming={streamingIdx === i} onAsk={send} onInspect={setInspect} onDraft={draftFromPlay} />}
        </div>
      ))}

      {busy && (
        <div style={{ marginTop: 16, background: 'var(--raised, #FFFDFA)', border: '1px solid var(--hairline, #EFEAE1)', borderRadius: 16, padding: '16px 20px', maxWidth: 430, boxShadow: '0 4px 20px -8px rgba(14,13,11,.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="bolt-mark" aria-hidden>
              <span className="bolt-halo" />
              <svg width="30" height="30" viewBox="0 0 48 60" fill="none">
                {/* popsicle silhouette, breathing quietly behind the bolt */}
                <path className="bolt-body" d="M4 18C4 8.6 12.1 1 22 1h4c9.9 0 18 7.6 18 17v24c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4V18z" fill="var(--accent, #E85A25)" />
                <path className="bolt-body" d="M18 46h12v9a4 4 0 01-4 4h-4a4 4 0 01-4-4v-9z" fill="var(--accent, #E85A25)" />
                {/* the bolt: drawn, then filled */}
                <path className="bolt-fill" d="M26 12L16 30h7l-3 13 12-18h-7l3-13z" fill="url(#boltGrad)" transform="translate(24 27.5) scale(.82) translate(-24 -27.5)" />
                <path className="bolt-stroke" d="M26 12L16 30h7l-3 13 12-18h-7l3-13z"
                  stroke="url(#boltGrad)" strokeWidth="2.7" strokeLinejoin="round" strokeLinecap="round" fill="none"
                  transform="translate(24 27.5) scale(.82) translate(-24 -27.5)" />
                <defs>
                  <linearGradient id="boltGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FF8A50" />
                    <stop offset="100%" stopColor="#E85A25" />
                  </linearGradient>
                </defs>
              </svg>
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
      </div>

      {started && !atBottom && (
        <div style={{ position: 'relative', height: 0 }}>
          <button onClick={() => { const pane = paneRef.current; pane?.scrollTo({ top: pane.scrollHeight, behavior: 'smooth' }); setAtBottom(true) }}
            style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', font: 'inherit', fontSize: 12.5, fontWeight: 600,
              padding: '8px 16px', borderRadius: 999, border: '1px solid var(--hairline, #EFEAE1)', background: 'var(--raised, #FFFDFA)', color: 'var(--ink-muted)',
              cursor: 'pointer', boxShadow: '0 8px 22px -10px rgba(14,13,11,.3)', whiteSpace: 'nowrap', zIndex: 5 }}>
            ↓ Latest answer
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: started ? 0 : 26, paddingTop: 18, borderTop: started ? '1px solid var(--hairline, #EFEAE1)' : 'none', flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Ask about any deal, risk or signal"
          style={{ flex: 1, padding: '14px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', fontSize: 15.5, background: 'transparent', color: 'var(--ink)', outline: 'none', fontFamily: "'Outfit',sans-serif" }}
        />
        <button onClick={() => send()} disabled={busy || !input.trim()}
          style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', border: 0, borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", opacity: busy || !input.trim() ? .55 : 1, boxShadow: '0 6px 18px -6px rgba(255,107,53,.5)' }}>
          {busy ? 'Thinking' : 'Ask'}
        </button>
      </div>

      {inspect && (
        <div onClick={() => setInspect(null)} style={{ position: 'fixed', inset: 0, zIndex: 820, background: 'rgba(14,13,11,.42)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(520px,100%)', maxHeight: '80vh', overflowY: 'auto', background: 'var(--paper, #FBF8F3)', padding: '26px 28px 28px', boxShadow: '0 40px 90px -30px rgba(14,13,11,.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)' }}>read from {inspect}</span>
              <button onClick={() => setInspect(null)} style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', background: 'none', border: 0, color: 'var(--ink-faint)', cursor: 'pointer' }}>close</button>
            </div>
            <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 21, letterSpacing: '-.03em', margin: '10px 0 0', color: 'var(--ink)' }}>What this answer drew on</h2>
            <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '18px 0 4px' }} />
            {inspectRows === null && <div style={{ padding: '22px 0', fontSize: 14, color: 'var(--ink-faint)' }}>Looking…</div>}
            {inspectRows?.length === 0 && <div style={{ padding: '22px 0', fontSize: 14, color: 'var(--ink-faint)' }}>Nothing recorded from this source for that account.</div>}
            {inspectRows?.map(r => (
              <div key={r.id} style={{ padding: '13px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{r.title}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: 'var(--ink-faint)', flex: 'none' }}>
                    {mountedHist && r.at ? new Date(r.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
                {r.sub && <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.6, marginTop: 4 }}>{r.sub}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* once a conversation exists the chat owns the top, so this row moves here */}
      {started && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingTop: 12, flexShrink: 0,
        fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
        <button onClick={() => router.back()} className="ask-ghost"
          style={{ font: 'inherit', background: 'none', border: 0, color: 'var(--ink-faint)', cursor: 'pointer', padding: 0 }}>← back</button>
        <span style={{ opacity: .8, display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--good, #2f8f5b)', display: 'inline-block' }} />
          {sourceCount != null ? `${sourceCount} sources live` : 'grounded in your data'}
        </span>
        {started ? (
          <button onClick={() => { setMsgs([]); setInput('') }} className="ask-ghost"
            style={{ font: 'inherit', background: 'none', border: 0, color: 'var(--ink-faint)', cursor: 'pointer', padding: 0 }}>new question</button>
        ) : <span style={{ opacity: 0 }}>new question</span>}
      </div>}
    </div>
  )
}
