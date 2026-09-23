'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Decision } from '@/lib/decisions'
import { LOGOS } from '@/app/(app)/integrations/IntegrationsShowcase'

// One timeline for a deal: what happened (events) and what we decided (decisions), in date order,
// newest first. A decision shows the events it responded to, and what was true when it was made.
type Sig = { id: string; title?: string | null; severity?: string | null; created_at?: string | null; status?: string | null; is_dismissed?: boolean | null; source_integration?: string | null; handled_action?: string | null; ai_analysis?: { quote?: string } | null }
const money = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`)
const healthTone = (h: number) => (h >= 70 ? 'var(--good, #2f8f5b)' : h >= 40 ? 'var(--warn, #d38b1d)' : 'var(--critical, #c43d2b)')
const SRC: Record<string, [string, string]> = { gmail: ['#EA4335', 'Gmail'], outlook: ['#0A64AD', 'Outlook'], slack: ['#611F69', 'Slack'], zoom: ['#2D8CFF', 'Zoom'], whatsapp: ['#25D366', 'WhatsApp'], hubspot: ['#FF7A59', 'HubSpot'], gcal: ['#1A73E8', 'Calendar'], fireflies: ['#7C5CFC', 'Fireflies'] }
const DOT: Record<string, string> = { high: 'var(--critical, #c43d2b)', watch: 'var(--warn, #d38b1d)', positive: 'var(--good, #2f8f5b)', done: 'var(--good, #2f8f5b)' }
const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }
const STATUS: Record<string, string> = { open: 'Open', done: 'Done', reversed: 'Reversed' }

type Item = { kind: 'event'; t: string; s: Sig } | { kind: 'decision'; t: string; d: Decision }

export function MergedTimeline({ account, signals, initialDecisions }: { account: string; signals: Sig[]; initialDecisions?: Decision[] }) {
  const router = useRouter()
  const [decisions, setDecisions] = useState<Decision[]>(initialDecisions ?? [])
  const [filter, setFilter] = useState<'all' | 'events' | 'decisions'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [statusErr, setStatusErr] = useState('')
  useEffect(() => {
    if (!menuFor) return
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest?.('.tl2-st-wrap')) setMenuFor(null) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuFor(null) }
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [menuFor])
  const setStatus = async (d: Decision, status: Decision['status']) => {
    setMenuFor(null); setStatusErr('')
    const prev = d.status
    setDecisions(list => list.map(x => (x.id === d.id ? { ...x, status } : x)))
    const r = await fetch('/api/decisions', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: d.id, status }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setDecisions(list => list.map(x => (x.id === d.id ? { ...x, status: prev } : x))); setStatusErr(j.error ?? 'Couldn\u2019t update the decision.'); return }
    if (j.demo) { try { const k = 'demo:decision-status'; const m = JSON.parse(localStorage.getItem(k) || '{}'); m[d.id] = status; localStorage.setItem(k, JSON.stringify(m)) } catch { /* ignore */ } }
  }
  useEffect(() => {
    if (initialDecisions) return
    let dead = false
    fetch(`/api/decisions?account=${encodeURIComponent(account)}`).then(r => r.ok ? r.json() : null).then(j => {
      if (dead) return
      let local: Decision[] = []
      try { local = (JSON.parse(localStorage.getItem('demo:decisions') || '[]') as Decision[]).filter(d => d.account_name === account) } catch { /* ignore */ }
      const all = [...local, ...((j?.decisions ?? []) as Decision[])]
      let over: Record<string, Decision['status']> = {}
      try { over = JSON.parse(localStorage.getItem('demo:decision-status') || '{}') } catch { /* ignore */ }
      setDecisions(all.filter((d, i) => all.findIndex(x => x.id === d.id) === i).map(d => (over[d.id] ? { ...d, status: over[d.id] } : d)))
    }).catch(() => {})
    return () => { dead = true }
  }, [account, initialDecisions])

  const events = useMemo(() => signals.filter(s => !s.is_dismissed && s.created_at), [signals])
  const items = useMemo<Item[]>(() => [
    ...(filter !== 'decisions' ? events.map(s => ({ kind: 'event' as const, t: s.created_at!, s })) : []),
    ...(filter !== 'events' ? decisions.map(d => ({ kind: 'decision' as const, t: d.created_at, d })) : []),
  ].sort((a, b) => b.t.localeCompare(a.t)), [events, decisions, filter])

  const jumpTo = (id: string) => {
    const go = () => { const el = document.getElementById(`tl-sig-${id}`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setFlash(id); setTimeout(() => setFlash(null), 1600) } }
    if (filter === 'decisions') { setFilter('all'); setTimeout(go, 60) } else go()
  }

  // work out up front which rows start a new day, so nothing is reassigned while rendering
  const firstOfDay = items.map((it, i) => i === 0 || dayKey(it.t) !== dayKey(items[i - 1].t))
  if (!events.length && !decisions.length) return <div className="tl2-empty">No timeline yet. Every signal and decision on this account lands here in order.</div>
  return (
    <section className="tl2">
      <div className="tl2-head">
        <h2>Timeline</h2>
        <div className="tl2-filter" role="group" aria-label="Show">
          {([['all', `All · ${events.length + decisions.length}`], ['events', `Events · ${events.length}`], ['decisions', `Decisions · ${decisions.length}`]] as const).map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      {items.length === 0 && <div className="tl2-empty">{filter === 'decisions' ? 'No decisions recorded on this account yet. Record one in a pipeline review.' : 'No events yet.'}</div>}
      <div className="tl2-list">
        {items.map((it, idx) => {
          const showDate = firstOfDay[idx]
          const date = new Date(it.t)
          const dateCell = <div className="tl2-date">{showDate && <><span>{date.toLocaleDateString('en-US', { month: 'short' })}</span> <b>{date.getDate()}</b></>}</div>
          if (it.kind === 'event') {
            const s = it.s, sev = s.status === 'handled' ? 'done' : (s.severity ?? 'watch'), src = s.source_integration ? SRC[s.source_integration] : null
            const q = s.ai_analysis?.quote?.replace(/^["“]|["”]$/g, '')
            return (
              <div key={`e-${s.id}`} id={`tl-sig-${s.id}`} className={`tl2-row${showDate ? ' first' : ''}${flash === s.id ? ' flash' : ''}`}>
                {dateCell}
                <div className="tl2-node"><i style={{ background: DOT[sev] ?? DOT.watch }} /></div>
                <a className="tl2-ev" href={`/signals?signal=${s.id}`} onClick={e => { e.preventDefault(); router.push(`/signals?signal=${s.id}`) }}>
                  <span className="tl2-ev-h">
                    {s.status === 'handled' && <span className="tl2-acted">{s.handled_action ? `${s.handled_action.replace(/^\w/, c => c.toUpperCase())}` : 'Acted on'}</span>}
                    {s.title ?? 'Signal'}
                    {src && <em title={src[1]}>{s.source_integration && LOGOS[s.source_integration] ? <span className="tl2-logo">{LOGOS[s.source_integration]}</span> : <b style={{ background: src[0] }} />}{src[1]}</em>}
                  </span>
                  {q && <span className="tl2-ev-q">{q}</span>}
                </a>
              </div>
            )
          }
          const d = it.d, f = d.evidence?.figures ?? {}, open = openId === d.id
          const causes = [...(d.evidence?.signals ?? [])].sort((a, b) => Number(!!b.quote) - Number(!!a.quote)).slice(0, 2)
          return (
            <div key={`d-${d.id}`} className={`tl2-row tl2-dec${showDate ? ' first' : ''}`}>
              {dateCell}
              <div className="tl2-node"><i className="diamond" /></div>
              <div className="tl2-card">
                <div className="tl2-card-k">Decision{d.source === 'review' ? ' · in pipeline review' : ''}</div>
                <div className="tl2-card-top"><p>{d.decision}</p>
                  <span className="tl2-st-wrap">
                    <button className={`dt2-status st-${d.status} tl2-st-btn`} onClick={() => setMenuFor(menuFor === d.id ? null : d.id)} aria-haspopup="menu" aria-expanded={menuFor === d.id}>
                      {STATUS[d.status] ?? d.status}<svg width="8" height="8" viewBox="0 0 10 10" aria-hidden><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                    </button>
                    {menuFor === d.id && (
                      <span className="tl2-st-menu" role="menu">
                        {(['open', 'done', 'reversed'] as const).map(st => (
                          <button key={st} role="menuitem" onClick={() => setStatus(d, st)} className={d.status === st ? 'on' : ''}>
                            <i className={`dot st-${st}`} />{st === 'open' ? 'Open' : st === 'done' ? 'Mark done' : 'Reversed'}{d.status === st && <b>✓</b>}
                          </button>
                        ))}
                      </span>
                    )}
                  </span>
                </div>
                {statusErr && <div className="tl2-err">{statusErr}</div>}
                <div className="tl2-card-meta">{[d.by && `Decided by ${d.by}`, d.owner && `owner ${d.owner}`, d.due_at && `due ${new Date(d.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`].filter(Boolean).join(' · ')}</div>
                {causes.length > 0 && (
                  <div className="tl2-why"><span>In response to</span>{causes.map(c => <button key={c.id} onClick={() => jumpTo(c.id)}>{c.title}</button>)}</div>
                )}
                <button className="dt2-toggle" onClick={() => setOpenId(open ? null : d.id)} aria-expanded={open}>
                  {open ? 'Hide what was true then' : 'What was true then'}
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                </button>
                {open && (
                  <div className="dt2-then">
                    <div className="dt2-then-k">On {new Date(d.evidence?.capturedAt ?? d.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                    <div className="dt2-figs">
                      {f.value ? <div><span>Annual value</span><b>{money(f.value)}</b></div> : null}
                      {f.atRisk ? <div><span>At risk</span><b style={{ color: 'var(--critical, #c43d2b)' }}>{money(f.atRisk)}</b></div> : null}
                      {f.health != null ? <div><span>Health</span><b style={{ color: healthTone(f.health) }}>{f.health}</b></div> : null}
                      {f.stage ? <div><span>Stage</span><b>{f.stage}</b></div> : null}
                      {f.openSignals != null ? <div><span>Open signals</span><b>{f.openSignals}</b></div> : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
