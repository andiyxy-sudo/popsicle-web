'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { Snapshot, ChangeEvent } from '@/lib/replay'
import { useEscape } from '@/components/ui/useEscape'

// The last eight weeks, replayed day by day from the real data, and narrated: each day reads as
// a sentence, the chart draws itself up to that day, and that day's events sit underneath.
type Point = Snapshot & { events: ChangeEvent[] }
const money = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`)

function narrate(p: Point, prev: Point | undefined): { lead: string; rest: string } {
  const crit = p.events.filter(e => e.kind === 'new' && e.severity === 'high')
  const acted = p.events.filter(e => e.kind === 'handled')
  const watch = p.events.filter(e => e.kind === 'new' && e.severity === 'watch')
  const good = p.events.filter(e => e.kind === 'new' && e.severity === 'positive')
  const dRisk = prev ? p.atRisk - prev.atRisk : 0, dProt = prev ? p.protectedValue - prev.protectedValue : 0
  const tail = (skip: ChangeEvent[]) => {
    const n = p.events.length - skip.length
    const parts: string[] = []
    if (dRisk > 0) parts.push(`Revenue at risk rose to ${money(p.atRisk)}.`)
    if (dRisk < 0) parts.push(`Revenue at risk fell to ${money(p.atRisk)}.`)
    if (n > 0) parts.push(`${n} more change${n === 1 ? '' : 's'} below.`)
    return parts.join(' ')
  }
  if (crit.length) {
    const accts = [...new Set(crit.map(e => e.account))]
    return { lead: `${accts.join(' and ')} ${crit.length === 1 ? 'raised a critical signal' : `raised ${crit.length} critical signals`}: “${crit[0].title}.”`, rest: tail([crit[0]]) }
  }
  if (dProt > 0 && acted.length) return { lead: `A save. ${acted[0].account} is out of danger, ${money(dProt)} protected.`, rest: tail([acted[0]]) }
  if (acted.length) return { lead: `${acted[0].account}: ${(acted[0].action ?? 'action taken').toLowerCase()} on “${acted[0].title}.”`, rest: tail([acted[0]]) }
  if (watch.length) return { lead: `Worth watching at ${watch[0].account}: “${watch[0].title}.”`, rest: tail([watch[0]]) }
  if (good.length) return { lead: `Good news from ${good[0].account}: “${good[0].title}.”`, rest: tail([good[0]]) }
  return { lead: 'A quiet day.', rest: 'Nothing new came in, and nothing moved.' }
}

// quotation marks in the accent colour, for a little flair
function Q({ text }: { text: string }) {
  return <>{text.split(/([\u201c\u201d"])/).map((part, i) => /^[\u201c\u201d"]$/.test(part) ? <span key={i} className="rp3-q">{part}</span> : part)}</>
}

function Chart({ pts, idx, onPick }: { pts: Point[]; idx: number; onPick: (i: number) => void }) {
  const W = 1000, H = 230, P = { l: 8, r: 16, t: 16, b: 30 }
  const maxV = Math.max(1, ...pts.map(p => Math.max(p.atRisk, p.protectedValue))) * 1.08
  const x = (i: number) => P.l + (i / Math.max(1, pts.length - 1)) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - v / maxV) * (H - P.t - P.b)
  const line = (vals: number[], upto: number) => vals.slice(0, upto + 1).map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const risk = pts.map(p => p.atRisk), prot = pts.map(p => p.protectedValue)
  const base = (H - P.b).toFixed(1)
  const area = (vals: number[], upto: number) => `${line(vals, upto)}L${x(upto).toFixed(1)},${base}L${x(0).toFixed(1)},${base}Z`
  const ref = useRef<SVGSVGElement>(null)
  const pick = (cx: number) => { const r = ref.current?.getBoundingClientRect(); if (!r) return; onPick(Math.round(Math.min(1, Math.max(0, (cx - r.left) / r.width)) * (pts.length - 1))) }
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="rp3-chart" preserveAspectRatio="none"
      onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); pick(e.clientX) }} onPointerMove={e => { if (e.buttons) pick(e.clientX) }}>
      {[0, 0.25, 0.5, 0.75].map(f => <line key={f} x1={0} x2={W} y1={P.t + f * (H - P.t - P.b)} y2={P.t + f * (H - P.t - P.b)} stroke="#EFEAE1" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
      <line x1={0} x2={W} y1={H - P.b} y2={H - P.b} stroke="#0E0D0B" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {pts.map((p, i) => (i % 7 === 0 && pts.length - 1 - i > 4) || i === pts.length - 1 ? <text key={i} x={x(i)} y={H - 9} textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'} className="rp3-tick">{new Date(p.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}</text> : null)}
      <path d={area(risk, pts.length - 1)} fill="rgba(196,61,43,.05)" />
      <path d={line(risk, pts.length - 1)} fill="none" stroke="rgba(196,61,43,.22)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <path d={line(prot, pts.length - 1)} fill="none" stroke="rgba(47,143,91,.22)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <path d={area(risk, idx)} fill="rgba(196,61,43,.14)" />
      <path d={line(risk, idx)} fill="none" stroke="#c43d2b" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <path d={line(prot, idx)} fill="none" stroke="#2f8f5b" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {pts.map((p, i) => p.events.some(e => e.kind === 'new' && e.severity === 'high') ? <rect key={`c${i}`} x={x(i) - 3} y={H - P.b + 4} width="6" height="6" fill={i <= idx ? '#c43d2b' : 'rgba(196,61,43,.25)'} /> : null)}
      <line x1={x(idx)} x2={x(idx)} y1={P.t - 6} y2={H - P.b} stroke="#E85A25" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <rect x={x(idx) - 5} y={y(risk[idx]) - 5} width="10" height="10" fill="#fff" stroke="#c43d2b" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      <rect x={x(idx) - 5} y={y(prot[idx]) - 5} width="10" height="10" fill="#fff" stroke="#2f8f5b" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function Replay({ onClose, initial }: { onClose: () => void; initial?: Point[] }) {
  const [pts, setPts] = useState<Point[] | null>(initial ?? null)
  const [idx, setIdx] = useState(initial ? initial.length - 1 : 0)
  const [playing, setPlaying] = useState(false)
  const [fast, setFast] = useState(false)
  const router = useRouter()
  useEscape(true, onClose)

  useEffect(() => {
    if (initial) return
    fetch('/api/timeline?days=56').then(r => r.ok ? r.json() : null).then(j => { if (j?.points) { setPts(j.points); setIdx(0); setTimeout(() => setPlaying(true), 700) } }).catch(() => {})
  }, [initial])
  useEffect(() => {
    if (!playing || !pts) return
    // slow by default: about 0.7s a day, long enough to read each day's sentence
    const t = setInterval(() => setIdx(i => { if (i >= pts.length - 1) { setPlaying(false); return i } return i + 1 }), fast ? 280 : 720)
    return () => clearInterval(t)
  }, [playing, pts, fast])

  const p = pts?.[idx], prev = idx > 0 ? pts?.[idx - 1] : undefined, first = pts?.[0]
  const story = useMemo(() => (p ? narrate(p, prev) : null), [p, prev])
  if (typeof document === 'undefined' && !initial) return null
  const atEnd = !!pts && idx === pts.length - 1
  const since = first ? new Date(first.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  const figs = p && first ? [
    { k: 'Revenue at risk', v: money(p.atRisk), d: p.atRisk - first.atRisk, fmt: money, c: 'var(--critical, #c43d2b)', bad: true },
    { k: 'Revenue protected', v: money(p.protectedValue), d: p.protectedValue - first.protectedValue, fmt: money, c: 'var(--good, #2f8f5b)', bad: false },
    { k: 'Open signals', v: String(p.active), d: p.active - first.active, fmt: (n: number) => String(n), c: 'var(--accent, #E85A25)', bad: true },
    { k: 'Critical', v: String(p.critical), d: p.critical - first.critical, fmt: (n: number) => String(n), c: 'var(--critical, #c43d2b)', bad: true },
  ] : []

  const body = (
    <div className="rp3-back" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rp3" role="dialog" aria-label="Replay the last eight weeks">
        <header className="rp3-top">
          <span className="rp3-k">Replay{pts ? ` · week ${Math.floor(idx / 7) + 1} of ${Math.ceil(pts.length / 7)} · day ${idx + 1} of ${pts.length}` : ''}</span>
          <button className="rp3-x" onClick={onClose} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </header>
        {!pts && <div className="rp3-loading"><span /><span /><span /></div>}
        {pts && p && story && (
          <>
            <h2 className="rp3-date">{new Date(p.t).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}{atEnd && <span className="rp3-today">Today</span>}</h2>
            <p className="rp3-story" key={idx}><strong><Q text={story.lead} /></strong> <Q text={story.rest} /></p>

            <div className="rp3-figs">
              {figs.map(f => (
                <div key={f.k} className="rp3-fig">
                  <div className="rp3-fig-k">{f.k}</div>
                  <div className="rp3-fig-v" style={{ color: f.c }}>{f.v}</div>
                  <div className="rp3-fig-d">{f.d === 0 ? `no change since ${since}` : `${f.d > 0 ? '+' : '\u2212'}${f.fmt(Math.abs(f.d))} since ${since}`}</div>
                </div>
              ))}
            </div>

            <div className="rp3-chart-wrap">
              <div className="rp3-legend"><span><i style={{ background: '#c43d2b' }} />Revenue at risk</span><span><i style={{ background: '#2f8f5b' }} />Revenue protected</span><span><i className="sq" />A critical signal arrived</span></div>
              <Chart pts={pts} idx={idx} onPick={i => { setPlaying(false); setIdx(i) }} />
            </div>

            <div className="rp3-controls">
              <button className="rp3-play" onClick={() => { if (atEnd) setIdx(0); setPlaying(v => !v) }}>
                {playing
                  ? <><svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="1.5" width="3" height="9" fill="currentColor" /><rect x="7" y="1.5" width="3" height="9" fill="currentColor" /></svg>Pause</>
                  : <><svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor" /></svg>{atEnd ? 'Play from the start' : 'Play'}</>}
              </button>
              <div className="rp3-seg" role="group" aria-label="Speed">
                <button className={!fast ? 'on' : ''} onClick={() => setFast(false)}>Slow</button>
                <button className={fast ? 'on' : ''} onClick={() => setFast(true)}>Faster</button>
              </div>
              <span className="rp3-hint">Drag across the chart to any day</span>
              <button className="rp3-ghost" onClick={() => { setPlaying(false); setIdx(pts.length - 1) }}>Jump to today</button>
            </div>

            <section className="rp3-day">
              <div className="rp3-sec-h"><h3>That day</h3><span>{p.events.length ? `${p.events.length} change${p.events.length === 1 ? '' : 's'}` : 'quiet'}</span></div>
              <div className="rp3-day-list">
              {p.events.length === 0 && <div className="rp3-quiet">Nothing came in, and nothing moved.</div>}
              {p.events.map(e => (
                <button key={e.id + e.kind} className="rp3-ev" onClick={() => { onClose(); router.push(`/signals?signal=${e.id}`) }}>
                  <i className={`sev-${e.kind === 'handled' ? 'done' : e.severity}`} />
                  <span className="rp3-ev-a">{e.account}</span>
                  <span className="rp3-ev-t">{e.kind === 'handled' ? `${e.action ?? 'Acted on'} · ${e.title}` : e.title}</span>
                  <span className="rp3-ev-m">{e.amount ? money(e.amount) : ''}</span>
                </button>
              ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
  return typeof document === 'undefined' ? body : createPortal(body, document.body)
}
