'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { Explanation, XNode } from '@/lib/metrics'
import { formatWhen } from '@/lib/utils'
import { useEscape } from '@/components/ui/useEscape'

// ─────────────────────────────────────────────────────────────────────────────
// Every number can explain itself. Wrap a figure in <X m="at_risk">…</X> and it stays exactly as
// it looks; hovering gives a faint warm tint, clicking opens its derivation: the accounts behind
// it, the signals behind each account, and the buyer's own words behind each signal.
// ─────────────────────────────────────────────────────────────────────────────
type Req = { m: string; account?: string; signal?: string; days?: number; scope?: 'me' }

export function X({ m, account, signal, days, scope, children }: Req & { children: React.ReactNode }) {
  const open = (el: HTMLElement) => window.dispatchEvent(new CustomEvent('explain:open', { detail: { m, account, signal, days, scope, rect: el.getBoundingClientRect().toJSON() } }))
  return (
    <span className="xp" role="button" tabIndex={0} aria-label="Where this number comes from"
      onClick={e => { e.stopPropagation(); e.preventDefault(); open(e.currentTarget) }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); open(e.currentTarget) } }}>
      {children}
    </span>
  )
}

const SRC: Record<string, string> = { gmail: 'Gmail', outlook: 'Outlook', slack: 'Slack', zoom: 'Zoom', whatsapp: 'WhatsApp', hubspot: 'HubSpot', gcal: 'Calendar', fireflies: 'Fireflies' }
const PALETTE = ['#E0582F', '#F2A677', '#8FB39A', '#C7B6A3', '#9DA7C4', '#D9A066', '#B78E8E', '#7F9A8C']
const SRC_COLOR: Record<string, string> = { gmail: '#EA4335', outlook: '#0A64AD', slack: '#611F69', zoom: '#2D8CFF', whatsapp: '#25D366', hubspot: '#FF7A59', gcal: '#1A73E8', fireflies: '#7C5CFC' }
const money = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`)

const Chev = () => <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M3.5 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>

function Ev({ n, go }: { n: XNode; go: (href: string) => void }) {
  const ev = n.evidence!
  const val = n.valueText ?? (n.value != null ? money(n.value) : '')
  return (
    <div className="xpp-ev" onClick={() => n.href && go(n.href)} role="link" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' && n.href) go(n.href) }}>
      <div className="xpp-ev-h">
        {ev.source && <span className="xpp-src"><i style={{ background: SRC_COLOR[ev.source] ?? '#A7A098' }} />{SRC[ev.source] ?? ev.source}</span>}
        {ev.when && <span>· {formatWhen(ev.when)}</span>}
        {n.note && <span>· {n.note}</span>}
        {val && <span className="xpp-ev-val">{val}</span>}
        <span className="xpp-ev-open">Open →</span>
      </div>
      <div className="xpp-ev-t">{ev.title}</div>
      {ev.quote && <div className="xpp-ev-q">“{ev.quote}”</div>}
    </div>
  )
}

function Node({ n, total, depth, go, color }: { n: XNode; total: number; depth: number; go: (href: string) => void; color?: string }) {
  const [open, setOpen] = useState(false)
  if (n.evidence && !n.children?.length) return <Ev n={n} go={go} />
  const kids = n.children ?? []
  const val = n.valueText ?? (n.value != null ? money(n.value) : '')
  const pct = n.value != null && total > 0 && depth === 0 ? Math.round(n.value / total * 100) : null
  return (
    <li className={`xpp-item${open ? ' open' : ''}${depth ? ' nested' : ''}`}>
      <button className="xpp-row" onClick={() => kids.length ? setOpen(o => !o) : n.href && go(n.href)}>
        <span className="xpp-dot" style={{ background: color ?? 'transparent' }} />
        <span className="xpp-name">{n.label}{kids.length > 0 && <Chev />}</span>
        <span className="xpp-right"><span className="xpp-val">{val}</span>{pct != null && <span className="xpp-pct">{pct}%</span>}</span>
        {n.note && <span className="xpp-sub">{n.note}</span>}
      </button>
      {open && kids.length > 0 && (
        kids.some(k => k.evidence && !k.children?.length)
          ? <div className="xpp-evs">{kids.map(k => <Node key={k.id} n={k} total={n.value ?? 0} depth={depth + 1} go={go} />)}</div>
          : <ul className="xpp-list xpp-sub-list">{kids.map(k => <Node key={k.id} n={k} total={n.value ?? 0} depth={depth + 1} go={go} />)}</ul>
      )}
    </li>
  )
}

export function ExplainHost() {
  const router = useRouter()
  const [req, setReq] = useState<(Req & { rect: DOMRect }) | null>(null)
  const [x, setX] = useState<Explanation | null>(null)
  const [err, setErr] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  useEscape(!!req, () => setReq(null))

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<Req & { rect: DOMRect }>).detail
      setX(null); setErr(''); setReq(d)
      const qs = new URLSearchParams({ metric: d.m }); if (d.account) qs.set(d.m === 'rep_exposure' ? 'rep' : 'account', d.account); if (d.signal) qs.set('signal', d.signal); if (d.days) qs.set('days', String(d.days)); if (d.scope) qs.set('scope', d.scope)
      fetch(`/api/explain?${qs}`).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(setX).catch(() => setErr('Couldn\u2019t load where this number comes from.'))
    }
    window.addEventListener('explain:open', onOpen)
    return () => window.removeEventListener('explain:open', onOpen)
  }, [])
  useEffect(() => {
    if (!req) return
    const onDown = (e: PointerEvent) => { if (panel.current && !panel.current.contains(e.target as Node)) setReq(null) }
    const t = setTimeout(() => document.addEventListener('pointerdown', onDown), 0)
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', onDown) }
  }, [req])

  if (!req || typeof document === 'undefined') return null
  // place under the number, kept on screen
  const W = Math.min(400, window.innerWidth - 24)
  const left = Math.min(Math.max(12, req.rect.left), window.innerWidth - W - 12)
  const below = req.rect.bottom + 10, room = window.innerHeight - below
  const top = room > 320 ? below : Math.max(12, req.rect.top - Math.min(520, window.innerHeight * 0.7) - 10)
  const go = (href: string) => { setReq(null); router.push(href) }
  const total = x?.value ?? 0

  return createPortal(
    <div ref={panel} className="xpp" style={{ left, top, width: W }} role="dialog" aria-label="Where this number comes from">
      {!x && !err && <div className="xpp-loading"><span /><span /><span /></div>}
      {err && <div className="xpp-def">{err}</div>}
      {x && (() => {
        const segs = x.parts.filter(p => (p.value ?? 0) > 0)
        const showBar = segs.length > 1
        let k = 0
        return (
          <>
            <div className="xpp-label">{x.label}</div>
            <div className="xpp-num">{x.valueText}</div>
            <p className="xpp-def">{x.definition}</p>
            {x.n != null && <p className="xpp-stat">{x.collecting ? `Collecting · ${x.n} so far, shown from 30` : `Based on ${x.n} · 95% range ${Math.round((x.interval?.[0] ?? 0) * 100)}–${Math.round((x.interval?.[1] ?? 0) * 100)}%`}</p>}
            {showBar && <div className="xpp-bar" aria-hidden>{segs.map((p, i) => <span key={p.id} style={{ flexGrow: p.value ?? 0, background: PALETTE[i % PALETTE.length] }} />)}</div>}
            {x.parts.length === 0
              ? <p className="xpp-def">Nothing contributes to this yet.</p>
              : <ul className="xpp-list">{x.parts.map(p => <Node key={p.id} n={p} total={total} depth={0} go={go} color={showBar && (p.value ?? 0) > 0 ? PALETTE[k++ % PALETTE.length] : undefined} />)}</ul>}
            {showBar && <div className="xpp-foot">Total<b>{x.valueText}</b></div>}
            {x.footnote && <p className="xpp-note">{x.footnote}</p>}
          </>
        )
      })()}
    </div>, document.body)
}
