'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChanges } from './useChanges'
import { Replay } from './Replay'
import { CountUp } from '@/components/ui/CountUp'
import type { ChangeEvent } from '@/lib/replay'

// "Since you last looked", written like the top of a briefing: one headline that tells the
// story, the four movements as figures, and the events as a dated timeline.
const money = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`)

function dayLabel(t: string, now: number) {
  const d = new Date(t), n = new Date(now)
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), b = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()
  const diff = Math.round((b - a) / 864e5)
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}
const timeOf = (t: string) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export function SinceBar({ screen }: { screen: string }) {
  const s = useChanges(screen)
  const [open, setOpen] = useState(false)
  const [replay, setReplay] = useState(false)
  const router = useRouter()

  const view = useMemo(() => {
    if (!s) return null
    const c = s.changes
    const turned = c.lines.filter(l => l.includes('turned critical')).map(l => l.replace(/ turned critical.*$/, ''))
    const dRisk = c.after.atRisk - c.before.atRisk, dProt = c.after.protectedValue - c.before.protectedValue
    const fresh = c.events.filter(e => e.kind === 'new'), crit = fresh.filter(e => e.severity === 'high').length, acted = c.events.filter(e => e.kind === 'handled').length
    const headline = turned.length ? `${turned.length === 1 ? turned[0] : `${turned.slice(0, -1).join(', ')} and ${turned.at(-1)}`} turned critical.`
      : dRisk > 0 ? `Risk grew by ${money(dRisk)}.` : dRisk < 0 ? `Risk fell by ${money(-dRisk)}.` : fresh.length ? 'Nothing turned critical.' : 'A quiet stretch.'
    const deck = turned.length ? `${money(dRisk)} of new risk arrived with it. Here\u2019s everything that moved.` : fresh.length || acted ? 'Here\u2019s everything that moved.' : 'Every figure is where you left it.'
    const groups: Array<{ day: string; items: ChangeEvent[] }> = []
    for (const e of c.events) { const d = dayLabel(e.t, c.now); const g = groups.find(x => x.day === d); if (g) g.items.push(e); else groups.push({ day: d, items: [e] }) }
    return { c, headline, deck, dRisk, dProt, fresh: fresh.length, crit, acted, groups }
  }, [s])

  if (!s || !view) return <div className="sb sb-skel" aria-hidden><span className="sk" style={{ width: '38%', height: 22 }} /><span className="sk" style={{ width: '62%', height: 14, marginTop: 12 }} /></div>
  const stats = [
    { v: view.dRisk === 0 ? '$0' : `${view.dRisk > 0 ? '+' : '\u2212'}${money(Math.abs(view.dRisk))}`, k: 'revenue at risk', tone: view.dRisk > 0 ? 'bad' : view.dRisk < 0 ? 'good' : 'flat' },
    { v: String(view.fresh), k: view.crit ? `new signals · ${view.crit} critical` : 'new signals', tone: view.crit ? 'warn' : 'flat' },
    { v: String(view.acted), k: 'acted on', tone: 'flat' },
    { v: view.dProt > 0 ? `+${money(view.dProt)}` : '$0', k: 'protected', tone: view.dProt > 0 ? 'good' : 'flat' },
  ]
  return (
    <section className="sb">
      <div className="sb-head">
        <div className="sb-copy">
          <div className="sb-eyebrow"><span className="sb-pulse" />{s.label}</div>
          <h2 className="sb-headline">{view.headline}</h2>
          <p className="sb-deck">{view.deck}</p>
        </div>
        <div className="sb-cta">
          <button className="sb-btn sb-btn-primary" onClick={() => setReplay(true)}>
            <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden><path d="M1.5 1.2v9.6c0 .5.5.8 1 .5l7.6-4.8c.4-.3.4-.8 0-1.1L2.5.7c-.5-.3-1 0-1 .5z" fill="currentColor" /></svg>
            Replay the last 8 weeks
          </button>
          {view.c.events.length > 0 && <button className="sb-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Hide timeline' : `See all ${view.c.events.length} changes`}</button>}
        </div>
      </div>
      <div className="sb-stats">
        {stats.map(st => (
          <div key={st.k} className={`sb-stat tone-${st.tone}`}>
            <CountUp value={st.v} className="sb-stat-v" />
            <span className="sb-stat-k">{st.k}</span>
          </div>
        ))}
      </div>
      {open && (
        <div className="sb-tl">
          {view.groups.map(g => (
            <div key={g.day} className="sb-day">
              <div className="sb-day-h">{g.day}<span>{g.items.length} change{g.items.length === 1 ? '' : 's'}</span></div>
              {g.items.map(e => (
                <button key={e.id + e.kind} className="sb-ev" onClick={() => router.push(`/signals?signal=${e.id}`)}>
                  <span className={`sb-node n-${e.kind === 'handled' ? 'done' : e.severity}`} />
                  <span className="sb-ev-body">
                    <span className="sb-ev-top"><b>{e.account}</b><span className="sb-ev-t">{timeOf(e.t)}</span></span>
                    <span className="sb-ev-title">{e.kind === 'handled' ? <><em>{e.action ?? 'Acted on'}</em> · {e.title}</> : e.title}</span>
                  </span>
                  {e.amount ? <span className="sb-ev-amt">{money(e.amount)}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {replay && <Replay onClose={() => setReplay(false)} />}
    </section>
  )
}
