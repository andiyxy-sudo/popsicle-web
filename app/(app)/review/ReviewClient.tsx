'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Answer } from '@/components/ask/AnswerText'
import { X } from '@/components/explain/Explain'
import { DateField } from '@/components/ui/DateField'
import { ReplayView } from '@/components/changes/Replay'
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
  const [replayOpen, setReplayOpen] = useState(false)   // "Replay this week", opened on request in its own window
  const reviewId = useMemo(() => `review-${new Date(now).toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`, [now])
  const deal = deals[i]
  // the date comes from the viewer's own clock and time zone, never the server's
  const [today, setToday] = useState('')
  useEffect(() => { setToday(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })) }, [])

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
  const closeTxt = deal.close ? new Date(deal.close).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null
  const openCount = deal.evidence.length
  return (
    <div className="dsk-screen on rv2">
      {/* first row on the logo's line, like every page: mono breadcrumb left, actions right (36px row) */}
      <div className="rv2-head">
        <div className="rv2-crumb">Pipeline review <span style={{ margin: '0 8px' }}>/</span> {today || '\u00a0'} <span style={{ margin: '0 8px' }}>/</span> {deals.length} deal{deals.length === 1 ? '' : 's'}</div>
        <div className="rv2-head-actions">
        <button className="rv2-replay" onClick={() => setReplayOpen(true)}>
          <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden><path d="M1.5 1v10l8.5-5z" fill="currentColor" /></svg>
          Replay this week
        </button>
        <button className="rv2-end" onClick={() => setEnding(true)}>End review{made.length ? <> · <b>{made.length} decision{made.length === 1 ? '' : 's'}</b></> : null}</button>
        </div>
      </div>
      <nav className="rv2-steps" aria-label="Agenda">
        {deals.map((d, k) => (
          <button key={d.account} className={`rv2-step${k === i ? ' on' : ''}${made.some(m => m.account_name === d.account) ? ' done' : ''}${d.why === 'critical' ? ' crit' : ''}`} onClick={() => setI(k)}>
            <div className="rv2-step-bar" />
            <div className="rv2-step-l"><span className="rv2-step-dot" />{d.account}</div>
          </button>
        ))}
      </nav>

      <div className="rv2-grid" key={deal.account}>
        <div className="rv2-main">
          <span className={`rv2-tag${deal.why === 'critical' ? '' : ' commit'}`}><i />{deal.why === 'critical' ? (i === 0 ? 'Critical · first on the agenda' : 'Critical') : 'In the commit'}</span>
          <h1 className="rv2-name">{deal.account}</h1>
          <div className="rv2-contact">{[deal.contact, deal.stage, closeTxt && `closes ${closeTxt}`].filter(Boolean).join(' · ')}</div>
          <div className="rv2-kpis">
            <div className="rv2-kpi"><div className="rv2-kpi-l">Annual value</div><div className="rv2-kpi-v" style={{ color: 'var(--good, #2f8f5b)' }}><X m="account_arr" account={deal.account}>{money(deal.value)}</X></div></div>
            <div className="rv2-kpi"><div className="rv2-kpi-l">At risk</div><div className="rv2-kpi-v" style={{ color: deal.atRisk > 0 ? '#D0442F' : undefined }}>{money(deal.atRisk)}</div></div>
            <div className="rv2-kpi"><div className="rv2-kpi-l">Health</div><div className="rv2-kpi-v" style={{ color: deal.health != null ? healthTone(deal.health) : undefined }}>{deal.health != null ? <X m="account_health" account={deal.account}>{deal.health}</X> : '--'}</div></div>
            <div className="rv2-kpi"><div className="rv2-kpi-l">This week</div><div className="rv2-kpi-v" style={{ color: 'var(--ink, #0E0D0B)' }}>{deal.week.length}<span className="rv2-kpi-u"> changes</span></div></div>
          </div>

          <section className="rv2-sec">
            <div className="rv2-sec-h"><h3>This week</h3><span>{deal.week.length ? `${deal.week.length} change${deal.week.length === 1 ? '' : 's'}` : 'quiet'}</span></div>
            {deal.week.length === 0 ? <div className="rv2-week rv2-quiet">Nothing new on this deal this week.</div> : (
              <div className="rv2-week">
                {deal.week.map(e => (
                  <button key={e.id + e.kind} className="rv2-wk" onClick={() => router.push(`/signals?signal=${e.id}`)}>
                    <i className={e.kind === 'handled' || e.severity === 'positive' ? 'g' : e.severity === 'high' ? 'h' : ''} />
                    <span>{e.kind === 'handled' ? `${e.action ?? 'Acted on'} · ${e.title}` : e.title}</span>
                    <em>{formatWhen(e.t)}</em>
                  </button>
                ))}
              </div>
            )}
          </section>

          {openCount > 0 && (
            <section className="rv2-sec">
              <div className="rv2-sec-h"><h3>The evidence</h3><span>in their words</span></div>
              <div className="rv2-evs">
                {deal.evidence.map(ev => (
                  <button key={ev.id} className="rv2-ev" onClick={() => router.push(`/signals?signal=${ev.id}`)}>
                    <div className="rv2-ev-h">{ev.source && <b><i style={{ background: SRC_COLOR[ev.source] ?? '#A7A098' }} />{SRC[ev.source] ?? ev.source}</b>}{ev.at && <span>· {formatWhen(ev.at)}</span>}</div>
                    <div className="rv2-ev-t">{ev.title}</div>
                    {ev.quote && <div className="rv2-ev-q">{ev.quote.replace(/^["\u201c]|["\u201d]$/g, '')}</div>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {deal.past.length > 0 && (
            <section className="rv2-sec">
              <div className="rv2-sec-h"><h3>Decided before</h3><span>with what was true then</span></div>
              <div className="rv2-evs">{deal.past.map(d => <PastDecision key={d.id} d={d} />)}</div>
            </section>
          )}
        </div>

        <aside className="rv2-side">
          <AskBox account={deal.account} />
          <DecisionForm key={deal.account} team={team} contact={deal.contact} onRecord={record} />
          {mine.length > 0 && (
            <div className="rv2-card">
              <h4>Decided in this review</h4>
              {mine.map(d => (
                <div key={d.id} className="rv2-made"><span className="rv2-check">✓</span>
                  <span><b>{d.decision}</b>{(d.owner || d.due_at) && <em>{d.owner ?? ''}{d.owner && d.due_at ? ' · ' : ''}{d.due_at ? `by ${new Date(d.due_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}</em>}</span></div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <nav className="rv2-nav" aria-label="Move between deals">
        <button className="rv2-prev" disabled={i === 0} onClick={() => setI(x => x - 1)}>
          <span className="rv2-nav-k">Previous</span><span className="rv2-nav-v">← {i > 0 ? deals[i - 1].account : 'Start of the agenda'}</span>
        </button>
        <span className="rv2-nav-c">Deal {i + 1} of {deals.length} · ← → to move</span>
        {i < deals.length - 1
          ? <button className="rv2-next" onClick={() => setI(x => x + 1)}><span className="rv2-nav-k">Next</span><span className="rv2-nav-v">{deals[i + 1].account} →</span></button>
          : <button className="rv2-next" onClick={() => setEnding(true)}><span className="rv2-nav-k">Last deal</span><span className="rv2-nav-v">Wrap up the review →</span></button>}
      </nav>

      {replayOpen && <ReplayView days={7} msPerDay={2600} title="This week, replayed" onClose={() => setReplayOpen(false)} />}
      {ending && <Summary made={made} deals={deals} demo={demo} onClose={() => setEnding(false)} onDone={() => router.push('/pulse')} />}
    </div>
  )
}

function PastDecision({ d }: { d: Decision }) {
  const f = d.evidence?.figures ?? {}
  const lead = d.evidence?.signals?.[0]
  return (
    <div className="rv2-past">
      <div className="rv2-past-t">{d.decision}<span className={`rv2-pill st-${d.status}`}>{d.status}</span></div>
      <div className="rv2-past-m">{new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{d.by ? ` · ${d.by}` : ''}{d.owner ? ` · owner ${d.owner}` : ''}</div>
      <div className="rv2-then"><b>At the time:</b> {[f.health != null && `health ${f.health}`, f.atRisk ? `${money(f.atRisk)} at risk` : null, f.openSignals != null && `${f.openSignals} open signal${f.openSignals === 1 ? '' : 's'}`].filter(Boolean).join(', ')}.{lead ? <> Lead signal “{lead.quote ?? lead.title}”.</> : null}</div>
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
    <div className="rv2-card">
      <h4>Ask Popsicle</h4>
      <p className="s">The answer is shown to the room, with its sources.</p>
      {!asked && presets.map(p => <button key={p} className="rv2-q" onClick={() => ask(p)}>{p}</button>)}
      {asked && <div className="rv2-asked">{asked}</div>}
      {asked && <div className="rv2-ans">{ans ? <Answer text={ans} /> : <span className="rv2-thinking"><span /><span /><span /></span>}</div>}
      {asked && !busy && <div className="rv2-more">{presets.filter(p => p !== asked).map(p => <button key={p} onClick={() => ask(p)}>{p}</button>)}</div>}
      <div className="rv2-input">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && q.trim() && !busy) ask(q.trim()) }} placeholder={`Ask anything about ${account}`} />
        <button className="rv2-go" disabled={!q.trim() || busy} onClick={() => ask(q.trim())}>Ask</button>
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
    <div className="rv2-card">
      <h4>Record a decision</h4>
      <p className="s">Saved with today’s evidence. An owner or a date makes it a tracked commitment.</p>
      <textarea className="rv2-field" value={text} onChange={e => setText(e.target.value)} rows={3} placeholder={`e.g. Andy calls ${contact ?? 'the CFO'} by Thursday with the multi-year offer`} />
      <div className="rv2-row2">
        <input className="rv2-field" list="rv-team" value={owner} onChange={e => setOwner(e.target.value)} placeholder="Owner" />
        <datalist id="rv-team">{team.map(t => <option key={t} value={t} />)}</datalist>
        <div className="rv2-date"><DateField value={due} onChange={setDue} placeholder="Due date" min={new Date().toISOString().slice(0, 10)} /></div>
      </div>
      <button className="rv2-rec" disabled={!text.trim() || busy} onClick={submit}>{busy ? 'Recording…' : 'Record decision'}</button>
      {err && <p className="rv2-err">{err}</p>}
    </div>
  )
}

function Summary({ made, deals, demo, onClose, onDone }: { made: Decision[]; deals: ReviewDeal[]; demo: boolean; onClose: () => void; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = [`Pipeline review, ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`, `${deals.length} deals reviewed, ${made.length} decisions.`, '',
    ...made.map(d => `• ${d.account_name}: ${d.decision}${d.owner ? ` (owner ${d.owner}` : ''}${d.due_at ? `${d.owner ? ', ' : ' ('}by ${new Date(d.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}${d.owner || d.due_at ? ')' : ''}`)].join('\n')
  return (
    typeof document === 'undefined' ? null : createPortal(
    <div className="rp2-back" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rv2-sum" role="dialog" aria-label="Review summary">
        <div className="rv2-eyebrow">Review wrapped</div>
        <h2>{made.length ? `${made.length} decision${made.length === 1 ? '' : 's'}, each with its evidence` : 'No decisions recorded'}</h2>
        <p className="rv2-sum-sub">{deals.length} deals reviewed. {made.length ? 'Owners and dates are now tracked; anything that slips shows up on Pulse.' : 'You can still record decisions from any account page.'}{demo ? ' (Demo: kept for this session.)' : ''}</p>
        <div className="rv2-sum-list">
          {made.map(d => <div key={d.id} className="rv2-made"><span className="rv2-check">✓</span><span><b>{d.account_name}</b> · {d.decision}{d.owner && <em>{d.owner}{d.due_at ? ` · by ${new Date(d.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</em>}</span></div>)}
        </div>
        <div className="rv2-sum-actions">
          <button className="sb-btn" onClick={() => { navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => {}) }}>{copied ? 'Copied' : 'Copy summary'}</button>
          <button className="sb-btn" onClick={onClose}>Back to the review</button>
          <button className="sb-btn sb-btn-primary" onClick={onDone}>Finish</button>
        </div>
      </div>
    </div>, document.body)
  )
}
