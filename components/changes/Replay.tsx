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

function Chart({ pts, idx, onPick }: { pts: Point[]; idx: number; onPick: (i: number) => void }) {
  const W = 800, H = 200, P = { l: 8, r: 8, t: 18, b: 26 }
  const maxV = Math.max(1, ...pts.map(p => Math.max(p.atRisk, p.protectedValue)))
  const x = (i: number) => P.l + (i / Math.max(1, pts.length - 1)) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - v / maxV) * (H - P.t - P.b)
  const path = (vals: number[], upto: number) => vals.slice(0, upto + 1).map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const risk = pts.map(p => p.atRisk), prot = pts.map(p => p.protectedValue)
  const area = `${path(risk, idx)}L${x(idx).toFixed(1)},${(H - P.b).toFixed(1)}L${x(0).toFixed(1)},${(H - P.b).toFixed(1)}Z`
  const ref = useRef<SVGSVGElement>(null)
  const pick = (clientX: number) => { const r = ref.current?.getBoundingClientRect(); if (!r) return; const f = (clientX - r.left) / r.width; onPick(Math.round(Math.min(1, Math.max(0, (f * W - P.l) / (W - P.l - P.r))) * (pts.length - 1))) }
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="rp2-chart" preserveAspectRatio="none"
      onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); pick(e.clientX) }} onPointerMove={e => { if (e.buttons) pick(e.clientX) }}>
      <defs>
        <linearGradient id="rp2Risk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E0533D" stopOpacity=".28" /><stop offset="1" stopColor="#E0533D" stopOpacity="0" /></linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(f => <line key={f} x1={P.l} x2={W - P.r} y1={P.t + f * (H - P.t - P.b)} y2={P.t + f * (H - P.t - P.b)} stroke="rgba(14,13,11,.06)" />)}
      {pts.map((p, i) => i % 7 === 0 ? <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : 'middle'} className="rp2-tick">{new Date(p.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text> : null)}
      <path d={path(risk, pts.length - 1)} fill="none" stroke="rgba(224,83,61,.14)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="3 4" />
      <path d={path(prot, pts.length - 1)} fill="none" stroke="rgba(47,143,91,.14)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="3 4" />
      <path d={area} fill="url(#rp2Risk)" />
      <path d={path(risk, idx)} fill="none" stroke="#E0533D" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <path d={path(prot, idx)} fill="none" stroke="#2f8f5b" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {pts.map((p, i) => p.events.some(e => e.kind === 'new' && e.severity === 'high') ? <circle key={`c${i}`} cx={x(i)} cy={H - P.b + 1} r="2.6" fill={i <= idx ? '#E0533D' : 'rgba(224,83,61,.3)'} /> : null)}
      <line x1={x(idx)} x2={x(idx)} y1={P.t - 8} y2={H - P.b} stroke="#17150F" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="2 3" />
      <circle cx={x(idx)} cy={y(risk[idx])} r="5" fill="#fff" stroke="#E0533D" strokeWidth="2.5" />
      <circle cx={x(idx)} cy={y(prot[idx])} r="5" fill="#fff" stroke="#2f8f5b" strokeWidth="2.5" />
    </svg>
  )
}

export function Replay({ onClose }: { onClose: () => void }) {
  const [pts, setPts] = useState<Point[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<1 | 2>(1)
  const router = useRouter()
  useEscape(true, onClose)

  useEffect(() => {
    fetch('/api/timeline?days=56').then(r => r.ok ? r.json() : null).then(j => { if (j?.points) { setPts(j.points); setIdx(0); setTimeout(() => setPlaying(true), 450) } }).catch(() => {})
  }, [])
  useEffect(() => {
    if (!playing || !pts) return
    const t = setInterval(() => setIdx(i => { if (i >= pts.length - 1) { setPlaying(false); return i } return i + 1 }), speed === 1 ? 220 : 110)
    return () => clearInterval(t)
  }, [playing, pts, speed])

  const p = pts?.[idx], prev = idx > 0 ? pts?.[idx - 1] : undefined, first = pts?.[0]
  const story = useMemo(() => (p ? narrate(p, prev) : null), [p, prev])
  if (typeof document === 'undefined') return null
  const atEnd = !!pts && idx === pts.length - 1
  const tiles = p && first ? [
    { k: 'Revenue at risk', v: money(p.atRisk), d: p.atRisk - first.atRisk, fmt: money, c: '#E0533D' },
    { k: 'Revenue protected', v: money(p.protectedValue), d: p.protectedValue - first.protectedValue, fmt: money, c: '#2f8f5b' },
    { k: 'Open signals', v: String(p.active), d: p.active - first.active, fmt: (n: number) => String(n), c: '#17150F' },
    { k: 'Critical', v: String(p.critical), d: p.critical - first.critical, fmt: (n: number) => String(n), c: '#C98A1E' },
  ] : []
  const week = pts && p ? Math.floor(idx / 7) + 1 : 0

  return createPortal(
    <div className="rp2-back" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rp2" role="dialog" aria-label="Replay the last eight weeks">
        <header className="rp2-head">
          <div className="rp2-kicker"><span className="rp2-live" />Replay · Week {week} of 8</div>
          <button className="rp2-x" onClick={onClose} aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></button>
        </header>
        {!pts && <div className="rp2-loading"><span /><span /><span /></div>}
        {pts && p && story && (
          <>
            <div className="rp2-date">
              {new Date(p.t).toLocaleDateString('en-US', { weekday: 'long' })}
              <span>{new Date(p.t).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}{atEnd ? ' · today' : ''}</span>
            </div>
            <p className="rp2-story" key={idx}><b>{story.lead}</b> {story.rest}</p>

            <div className="rp2-legend"><span><i style={{ background: '#E0533D' }} />Revenue at risk</span><span><i style={{ background: '#2f8f5b' }} />Revenue protected</span><span><i className="dot" />A critical signal arrived</span></div>
            <Chart pts={pts} idx={idx} onPick={i => { setPlaying(false); setIdx(i) }} />

            <div className="rp2-controls">
              <button className="rp2-play" onClick={() => { if (atEnd) setIdx(0); setPlaying(v => !v) }} aria-label={playing ? 'Pause' : 'Play'}>
                {playing
                  ? <svg width="14" height="14" viewBox="0 0 14 14"><rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor" /><rect x="8" y="2" width="3" height="10" rx="1" fill="currentColor" /></svg>
                  : <svg width="14" height="14" viewBox="0 0 14 14"><path d="M4 2.2v9.6c0 .5.5.8 1 .5l7-4.8c.4-.3.4-.8 0-1.1l-7-4.7c-.5-.3-1 0-1 .5z" fill="currentColor" /></svg>}
              </button>
              <span className="rp2-ctl-l">{playing ? 'Playing' : atEnd ? 'Replay again' : 'Paused'} · drag the chart to any day</span>
              <button className="rp2-chip" onClick={() => setSpeed(s => (s === 1 ? 2 : 1))}>{speed}×</button>
              <button className="rp2-chip" onClick={() => { setPlaying(false); setIdx(pts.length - 1) }}>Today</button>
            </div>

            <div className="rp2-tiles">
              {tiles.map(t => (
                <div key={t.k} className="rp2-tile">
                  <span className="rp2-tk">{t.k}</span>
                  <span className="rp2-tv" style={{ color: t.c }}>{t.v}</span>
                  <span className="rp2-td">{t.d === 0 ? 'unchanged since the start' : `${t.d > 0 ? '+' : '\u2212'}${t.fmt(Math.abs(t.d))} since the start`}</span>
                </div>
              ))}
            </div>

            <div className="rp2-feed">
              <div className="rp2-feed-h">That day</div>
              {p.events.length === 0 && <div className="rp2-quiet">Nothing came in. A good day to get ahead.</div>}
              {p.events.map(e => (
                <button key={e.id + e.kind} className={`rp2-ev s-${e.kind === 'handled' ? 'done' : e.severity}`} onClick={() => { onClose(); router.push(`/signals?signal=${e.id}`) }}>
                  <span className="rp2-ev-acct">{e.account}</span>
                  <span className="rp2-ev-title">{e.kind === 'handled' ? `${e.action ?? 'Acted on'} · ${e.title}` : e.title}</span>
                  {e.amount ? <span className="rp2-ev-amt">{money(e.amount)}</span> : <span />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>, document.body)
}
