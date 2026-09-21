'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Answer } from '@/components/ask/AnswerText'
import { X } from '@/components/explain/Explain'
import { formatWhen, healthTone } from '@/lib/utils'
import type { ChangeEvent } from '@/lib/replay'
import type { Decision } from '@/lib/decisions'

export type ReviewDeal = {
  account: string; why: 'critical' | 'commit'; value: number; stage: string | null; health: number | null; contact: string | null; close: string | null; atRisk: number
  evidence: Array<{ id: string; title: string; quote: string | null; source: string | null; at: string | null; severity: string }>
  week: ChangeEvent[]; past: Decision[]
}
const money = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`)
const SRC: Record<string, string> = { gmail: 'Gmail', outlook: 'Outlook', slack: 'Slack', zoom: 'Zoom', whatsapp: 'WhatsApp', hubspot: 'HubSpot', gcal: 'Calendar', fireflies: 'Fireflies' }
const SRC_COLOR: Record<string, string> = { gmail: '#EA4335', outlook: '#0A64AD', slack: '#611F69', zoom: '#2D8CFF', whatsapp: '#25D366', hubspot: '#FF7A59', gcal: '#1A73E8', fireflies: '#7C5CFC' }

export function ReviewClient({ deals, team, demo, now }: { deals: ReviewDeal[]; team: string[]; demo: boolean; now: number }) {
  const router = useRouter()
  const [i, setI] = useState(0)
  const [made, setMade] = useState<Decision[]>([])
  const [ending, setEnding] = useState(false)
  const reviewId = useMemo(() => `review-${new Date(now).toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`, [now])
  const deal = deals[i]

  // ← → move between deals (not while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowRight') setI(x => Math.min(deals.length - 1, x + 1))
      if (e.key === 'ArrowLeft') setI(x => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [deals.length])

  const record = async (text: string, owner: string, due: string) => {
    const r = await fetch('/api/decisions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: deal.account, decision: text, owner, due, review_id: reviewId, source: 'review' }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j.decision) return j.error ?? 'Couldn\u2019t record that decision.'
    setMade(m => [j.decision, ...m])
    if (demo) { try { const k = 'demo:decisions'; const cur = JSON.parse(localStorage.getItem(k) || '[]'); localStorage.setItem(k, JSON.stringify([j.decision, ...cur].slice(0, 50))) } catch { /* ignore */ } }
    return null
  }

  if (!deals.length) return (
    <div className="dsk-screen on rv-empty"><h1>Nothing to review</h1><p>No deals are critical or in the commit right now.</p></div>
  )
  const mine = made.filter(d => d.account_name === deal.account)
  return (
    <div className="rv">
      <header className="rv-top">
        <div className="rv-title">
          <span className="rv-kicker"><span className="rv-dot" />Pipeline review</span>
          <span className="rv-date">{new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </div>
        <nav className="rv-agenda" aria-label="Agenda">
          {deals.map((d, k) => (
            <button key={d.account} className={`rv-chip${k === i ? ' on' : ''}${made.some(m => m.account_name === d.account) ? ' done' : ''} w-${d.why}`} onClick={() => setI(k)}>
              <span className="rv-chip-n">{k + 1}</span>{d.account}
            </button>
          ))}
        </nav>
        <button className="rv-end" onClick={() => setEnding(true)}>End review{made.length ? ` · ${made.length} decision${made.length === 1 ? '' : 's'}` : ''}</button>
      </header>

      <main className="rv-slide" key={deal.account}>
        <section className="rv-main">
          <div className={`rv-why w-${deal.why}`}>{deal.why === 'critical' ? 'Critical · on the agenda first' : 'In the commit'}</div>
          <h1 className="rv-acct">{deal.account}</h1>
          <div className="rv-meta">
            <span><X m="account_arr" account={deal.account}><b>{money(deal.value)}</b></X> annual value</span>
            {deal.stage && <span>{deal.stage}</span>}
            {deal.health != null && <span>health <X m="account_health" account={deal.account}><b style={{ color: healthTone(deal.health) }}>{deal.health}</b></X></span>}
            {deal.atRisk > 0 && <span className="rv-risk"><b>{money(deal.atRisk)}</b> at risk</span>}
            {deal.contact && <span>{deal.contact}</span>}
          </div>

          <h3 className="rv-h">This week</h3>
          {deal.week.length === 0 ? <p className="rv-quiet">Nothing new this week.</p> : (
            <div className="rv-week">
              {deal.week.map(e => (
                <button key={e.id + e.kind} className="rv-wk" onClick={() => router.push(`/signals?signal=${e.id}`)}>
                  <span className={`rv-node n-${e.kind === 'handled' ? 'done' : e.severity}`} />
                  <span className="rv-wk-t">{e.kind === 'handled' ? `${e.action ?? 'Acted on'} · ${e.title}` : e.title}</span>
                  <span className="rv-wk-when">{formatWhen(e.t)}</span>
                </button>
              ))}
            </div>
          )}

          <h3 className="rv-h">The evidence</h3>
          <div className="rv-evs">
            {deal.evidence.map(ev => (
              <button key={ev.id} className={`rv-ev s-${ev.severity}`} onClick={() => router.push(`/signals?signal=${ev.id}`)}>
                <div className="rv-ev-top">
                  {ev.source && <span className="xp-src" style={{ background: SRC_COLOR[ev.source] ?? '#8E8983' }}>{(SRC[ev.source] ?? ev.source).charAt(0)}</span>}
                  <span className="rv-ev-title">{ev.title}</span>
                  {ev.at && <span className="rv-ev-when">{formatWhen(ev.at)}</span>}
                </div>
                {ev.quote && <div className="rv-ev-q">“{ev.quote.replace(/^["\u201c]|["\u201d]$/g, '')}”</div>}
              </button>
            ))}
          </div>

          {deal.past.length > 0 && (
            <>
              <h3 className="rv-h">Decided before</h3>
              {deal.past.map(d => <PastDecision key={d.id} d={d} />)}
            </>
          )}
        </section>

        <aside className="rv-side">
          <AskBox account={deal.account} />
          <DecisionForm key={deal.account} team={team} contact={deal.contact} onRecord={record} />
          {mine.length > 0 && (
            <div className="rv-made">
              <div className="rv-side-h">Decided in this review</div>
              {mine.map(d => (
                <div key={d.id} className="rv-made-row">
                  <span className="rv-check">✓</span>
                  <span><b>{d.decision}</b>{(d.owner || d.due_at) && <em>{d.owner ?? ''}{d.owner && d.due_at ? ' · ' : ''}{d.due_at ? `by ${new Date(d.due_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}</em>}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </main>

      <footer className="rv-foot">
        <button className="rv-nav" disabled={i === 0} onClick={() => setI(x => x - 1)}>← {i > 0 ? deals[i - 1].account : 'Start'}</button>
        <span className="rv-count">Deal {i + 1} of {deals.length} · use ← → to move</span>
        {i < deals.length - 1
          ? <button className="rv-nav rv-next" onClick={() => setI(x => x + 1)}>{deals[i + 1].account} →</button>
          : <button className="rv-nav rv-next" onClick={() => setEnding(true)}>Wrap up →</button>}
      </footer>

      {ending && <Summary made={made} deals={deals} demo={demo} onClose={() => setEnding(false)} onDone={() => router.push('/pulse')} />}
    </div>
  )
}

function PastDecision({ d }: { d: Decision }) {
  const f = d.evidence?.figures ?? {}
  return (
    <div className="rv-past">
      <div className="rv-past-top"><b>{d.decision}</b><span className={`rv-status st-${d.status}`}>{d.status}</span></div>
      <div className="rv-past-meta">{new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{d.by ? ` · ${d.by}` : ''}{d.owner ? ` · owner ${d.owner}` : ''}</div>
      <div className="rv-past-then">
        <span className="rv-then-l">At the time</span>
        {f.health != null && <span>health {f.health}</span>}
        {f.atRisk ? <span>{money(f.atRisk)} at risk</span> : null}
        {f.openSignals != null && <span>{f.openSignals} open signals</span>}
        {d.evidence?.signals?.[0] && <span className="rv-then-s">“{d.evidence.signals[0].quote ?? d.evidence.signals[0].title}”</span>}
      </div>
    </div>
  )
}

function AskBox({ account }: { account: string }) {
  const [q, setQ] = useState(''), [asked, setAsked] = useState(''), [ans, setAns] = useState(''), [busy, setBusy] = useState(false)
  const gen = useRef(0)
  const ask = useCallback(async (question: string) => {
    const my = ++gen.current; setAsked(question); setAns(''); setBusy(true); setQ('')
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: question }], stream: true, focus: { account } }) })
      if (r.body && (r.headers.get('content-type') || '').includes('text/plain')) {
        const reader = r.body.getReader(), dec = new TextDecoder(); let t = ''
        for (;;) { const { done, value } = await reader.read(); if (done || my !== gen.current) break; t += dec.decode(value, { stream: true }); setAns(t) }
      } else { const j = await r.json().catch(() => ({})); if (my === gen.current) setAns(j.content || j.error || 'No answer came back.') }
    } catch { if (my === gen.current) setAns('Couldn\u2019t reach Popsicle. Try again.') }
    if (my === gen.current) setBusy(false)
  }, [account])
  const presets = [`Will ${account} close this quarter?`, 'What should we do this week?', 'What would change the outcome?']
  return (
    <div className="rv-ask">
      <div className="rv-side-h">Ask Popsicle, for the room</div>
      {!asked && <div className="rv-presets">{presets.map(p => <button key={p} onClick={() => ask(p)}>{p}</button>)}</div>}
      {asked && <div className="rv-q">{asked}</div>}
      {asked && <div className="rv-a">{ans ? <Answer text={ans} /> : <span className="rv-thinking"><span /><span /><span /></span>}</div>}
      <div className="rv-ask-bar">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && q.trim() && !busy) ask(q.trim()) }} placeholder={`Ask anything about ${account}`} />
        <button disabled={!q.trim() || busy} onClick={() => ask(q.trim())}>Ask</button>
      </div>
    </div>
  )
}

function DecisionForm({ team, contact, onRecord }: { team: string[]; contact: string | null; onRecord: (t: string, o: string, d: string) => Promise<string | null> }) {
  const [text, setText] = useState(''), [owner, setOwner] = useState(''), [due, setDue] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!text.trim()) return
    setBusy(true); setErr('')
    const e = await onRecord(text.trim(), owner.trim(), due)
    setBusy(false)
    if (e) setErr(e); else { setText(''); setOwner(''); setDue('') }
  }
  return (
    <div className="rv-dec">
      <div className="rv-side-h">Record a decision</div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder={`e.g. Andy calls ${contact ?? 'the CFO'} by Thursday with the multi-year offer`} />
      <div className="rv-dec-row">
        <input list="rv-team" value={owner} onChange={e => setOwner(e.target.value)} placeholder="Owner" />
        <datalist id="rv-team">{team.map(t => <option key={t} value={t} />)}</datalist>
        <input type="date" value={due} onChange={e => setDue(e.target.value)} aria-label="Due" />
      </div>
      <button className="rv-dec-btn" disabled={!text.trim() || busy} onClick={submit}>{busy ? 'Recording…' : 'Record decision'}</button>
      <p className="rv-dec-note">Saved with the evidence as it stands right now. With an owner or date, it’s tracked as a commitment.</p>
      {err && <p className="rv-err">{err}</p>}
    </div>
  )
}

function Summary({ made, deals, demo, onClose, onDone }: { made: Decision[]; deals: ReviewDeal[]; demo: boolean; onClose: () => void; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = [`Pipeline review, ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`, `${deals.length} deals reviewed, ${made.length} decisions.`, '',
    ...made.map(d => `• ${d.account_name}: ${d.decision}${d.owner ? ` (owner ${d.owner}` : ''}${d.due_at ? `${d.owner ? ', ' : ' ('}by ${new Date(d.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}${d.owner || d.due_at ? ')' : ''}`)].join('\n')
  return (
    <div className="rp2-back" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rv-sum" role="dialog" aria-label="Review summary">
        <div className="rv-kicker"><span className="rv-dot" />Review wrapped</div>
        <h2>{made.length ? `${made.length} decision${made.length === 1 ? '' : 's'}, each with its evidence` : 'No decisions recorded'}</h2>
        <p className="rv-sum-sub">{deals.length} deals reviewed. {made.length ? 'Owners and dates are now tracked; anything that slips shows up on Pulse.' : 'You can still record decisions from any account page.'}{demo ? ' (Demo: kept for this session.)' : ''}</p>
        <div className="rv-sum-list">
          {made.map(d => <div key={d.id} className="rv-made-row"><span className="rv-check">✓</span><span><b>{d.account_name}</b> · {d.decision}{d.owner && <em>{d.owner}{d.due_at ? ` · by ${new Date(d.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</em>}</span></div>)}
        </div>
        <div className="rv-sum-actions">
          <button className="sb-btn" onClick={() => { navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => {}) }}>{copied ? 'Copied' : 'Copy summary'}</button>
          <button className="sb-btn" onClick={onClose}>Back to the review</button>
          <button className="sb-btn sb-btn-primary" onClick={onDone}>Finish</button>
        </div>
      </div>
    </div>
  )
}
