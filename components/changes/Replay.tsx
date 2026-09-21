'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { Snapshot, ChangeEvent } from '@/lib/replay'
import { useEscape } from '@/components/ui/useEscape'

// Drag back through the last eight weeks and watch the pipeline replay into today. Every point
// is the real data as it stood that day, computed the same way as today's figures.
type Point = Snapshot & { events: ChangeEvent[] }
const money = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`)

function Spark({ pts, idx, pick, color }: { pts: Point[]; idx: number; pick: (p: Point) => number; color: string }) {
  const W = 220, H = 44, vals = pts.map(pick), max = Math.max(1, ...vals)
  const x = (i: number) => (i / Math.max(1, pts.length - 1)) * W, y = (v: number) => H - 4 - (v / max) * (H - 10)
  const d = vals.slice(0, idx + 1).map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const ghost = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden>
      <path d={ghost} fill="none" stroke="rgba(14,13,11,.1)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={x(idx)} cy={y(vals[idx] ?? 0)} r="3.5" fill={color} />
    </svg>
  )
}

export function Replay({ onClose }: { onClose: () => void }) {
  const [pts, setPts] = useState<Point[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()
  useEscape(true, onClose)

  useEffect(() => {
    fetch('/api/timeline?days=56').then(r => r.ok ? r.json() : null).then(j => { if (j?.points) { setPts(j.points); setIdx(0); setPlaying(true) } }).catch(() => {})
  }, [])
  useEffect(() => {
    if (!playing || !pts) return
    timer.current = setInterval(() => setIdx(i => { if (i >= pts.length - 1) { setPlaying(false); return i } return i + 1 }), 110)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [playing, pts])

  if (typeof document === 'undefined') return null
  const p = pts?.[idx], first = pts?.[0]
  const day = p ? new Date(p.t) : null
  const isToday = !!pts && idx === pts.length - 1
  const cards: Array<{ k: string; v: (x: Point) => number; fmt: (n: number) => string; color: string }> = [
    { k: 'Revenue at risk', v: x => x.atRisk, fmt: money, color: '#c43d2b' },
    { k: 'Open signals', v: x => x.active, fmt: n => String(n), color: '#17150F' },
    { k: 'Critical', v: x => x.critical, fmt: n => String(n), color: '#d38b1d' },
    { k: 'Revenue protected', v: x => x.protectedValue, fmt: money, color: '#2f8f5b' },
  ]
  return createPortal(
    <div className="rp-back" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rp" role="dialog" aria-label="Replay the last eight weeks">
        <div className="rp-head">
          <div>
            <div className="xp-eyebrow"><span className="xp-dot" />Replay</div>
            <div className="rp-date">{day ? day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Loading…'}{isToday ? <span className="rp-today">today</span> : null}</div>
          </div>
          <button className="rp-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        {pts && p && first && (
          <>
            <div className="rp-cards">
              {cards.map(c => {
                const d = c.v(p) - c.v(first)
                return (
                  <div key={c.k} className="rp-card">
                    <div className="rp-k">{c.k}</div>
                    <div className="rp-v" style={{ color: c.color }}>{c.fmt(c.v(p))}</div>
                    <div className="rp-d">{d === 0 ? 'no change' : `${d > 0 ? '+' : '\u2212'}${c.fmt(Math.abs(d))} in 8 weeks`}</div>
                    <Spark pts={pts} idx={idx} pick={c.v} color={c.color} />
                  </div>
                )
              })}
            </div>
            <div className="rp-controls">
              <button className="rp-play" onClick={() => { if (isToday) setIdx(0); setPlaying(v => !v) }}>{playing ? 'Pause' : isToday ? 'Replay again' : 'Play'}</button>
              <input className="rp-slider" type="range" min={0} max={pts.length - 1} value={idx} onChange={e => { setPlaying(false); setIdx(Number(e.target.value)) }} aria-label="Day" />
              <span className="rp-range">{new Date(pts[0].t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → today</span>
            </div>
            <div className="rp-events">
              <div className="rp-k">What happened that day</div>
              {p.events.length === 0 && <div className="rp-none">A quiet day.</div>}
              {p.events.map(e => (
                <div key={e.id + e.kind} className="since-ev" onClick={() => { onClose(); router.push(`/signals?signal=${e.id}`) }}>
                  <span className={`since-ev-dot sev-${e.kind === 'handled' ? 'done' : e.severity}`} />
                  <span className="since-ev-acct">{e.account}</span>
                  <span className="since-ev-title">{e.kind === 'handled' ? `${e.action ?? 'Acted on'}: ${e.title}` : e.title}</span>
                  {e.amount ? <span className="since-ev-t">{money(e.amount)}</span> : null}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>, document.body)
}
