'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { Explanation, XNode } from '@/lib/metrics'
import { formatWhen } from '@/lib/utils'
import { useEscape } from '@/components/ui/useEscape'
import { track } from '@/lib/analytics'

// ─────────────────────────────────────────────────────────────────────────────
// Every number can explain itself. Wrap a figure in <X m="at_risk">…</X> and it stays exactly as
// it looks; hovering gives a faint warm tint, clicking opens its derivation: the accounts behind
// it, the signals behind each account, and the buyer's own words behind each signal.
// ─────────────────────────────────────────────────────────────────────────────
type Req = { m: string; account?: string; signal?: string; days?: number; scope?: 'me' }

export function X({ m, account, signal, days, scope, children }: Req & { children: React.ReactNode }) {
  const open = (el: HTMLElement) => { track('number_explained', { metric: m }); window.dispatchEvent(new CustomEvent('explain:open', { detail: { m, account, signal, days, scope, el, rect: el.getBoundingClientRect().toJSON() } })) }
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
  const pct = n.value != null && total > 0 && depth === 0 ? Math.min(100, Math.round((n.value / total) * 100)) : null
  return (
    <li className={`xpp-item${open ? ' open' : ''}${depth ? ' nested' : ''}`}>
      <button className="xpp-row" onClick={() => kids.length ? setOpen(o => !o) : n.href && go(n.href)}>
        <span className="xpp-dot" style={{ background: color ?? n.color ?? 'transparent' }} />
        <span className="xpp-name">{n.label}{kids.length > 0 && <Chev />}</span>
        <span className="xpp-right"><span className="xpp-val" style={n.color ? { color: n.color } : undefined}>{val}</span>{pct != null && <span className="xpp-pct">{pct}%</span>}</span>
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
  const [req, setReq] = useState<(Req & { rect: DOMRect; el?: HTMLElement }) | null>(null)
  const [x, setX] = useState<Explanation | null>(null)
  const [err, setErr] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  useEscape(!!req, () => setReq(null))

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<Req & { rect: DOMRect; el?: HTMLElement }>).detail
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
  // Attach the popup to the page that scrolls, just under the number. It then moves with the page
  // like any other content, and a long popup simply runs down the page: scroll to read the rest.
  const scroller = (() => {
    let n: HTMLElement | null = req.el?.parentElement ?? null
    while (n && n !== document.body) {
      const oy = getComputedStyle(n).overflowY
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n
      n = n.parentElement
    }
    return document.scrollingElement as HTMLElement ?? document.documentElement
  })()
  const host = scroller === document.scrollingElement || scroller === document.documentElement ? document.body : scroller
  if (host !== document.body && getComputedStyle(host).position === 'static') host.style.position = 'relative'
  const hostRect = host === document.body ? { top: -window.scrollY, left: -window.scrollX } as DOMRect : host.getBoundingClientRect()
  const anchor = req.el?.getBoundingClientRect() ?? req.rect
  const W = Math.min(400, (host === document.body ? window.innerWidth : host.clientWidth) - 24)
  const maxLeft = (host === document.body ? window.innerWidth : host.clientWidth) - W - 12
  const left = Math.min(Math.max(12, anchor.left - hostRect.left + (host === document.body ? 0 : host.scrollLeft)), Math.max(12, maxLeft))
  const top = anchor.bottom - hostRect.top + (host === document.body ? 0 : host.scrollTop) + 10
  // the popup's top rule (and figure) take the colour of the number that was clicked
  const tone = (() => {
    let n: Element | null = req.el ?? null
    while (n && n.firstElementChild) n = n.firstElementChild
    const c = n ? getComputedStyle(n).color : ''
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c)
    if (!m) return null
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
    return r < 70 && g < 70 && b < 70 ? null : c   // near-black numbers keep the ink rule
  })()
  const go = (href: string) => { setReq(null); router.push(href) }
  const partsSum = (x?.parts ?? []).reduce((a, p) => a + (Number(p.value) || 0), 0)
  const headline = x?.value ?? 0
  // the rows add up to the headline (47 signals by severity) → share of the headline;
  // otherwise (2 accounts, rows in money) → share of what the rows themselves add up to
  const total = partsSum > 0 && (headline <= 0 || Math.abs(partsSum - headline) / Math.max(partsSum, headline) > 0.02) ? partsSum : headline

  return createPortal(
    <div ref={panel} className="xpp" style={{ left, top, width: W, ...(tone ? { borderTopColor: tone } : {}) }} role="dialog" aria-label="Where this number comes from">
      {!x && !err && <div className="xpp-loading"><span /><span /><span /></div>}
      {err && <div className="xpp-def">{err}</div>}
      {x && (() => {
        const segs = x.parts.filter(p => (p.value ?? 0) > 0)
        const showBar = segs.length > 1
        let k = 0
        return (
          <>
            <div className="xpp-label">{x.label}</div>
            <div className="xpp-num" style={x.color ? { color: x.color } : tone ? { color: tone } : undefined}>{x.valueText}</div>
            <p className="xpp-def">{x.definition}</p>
            {x.n != null && <p className="xpp-stat">{x.collecting ? `Collecting · ${x.n} so far, shown from 30` : `Based on ${x.n} · 95% range ${Math.round((x.interval?.[0] ?? 0) * 100)}–${Math.round((x.interval?.[1] ?? 0) * 100)}%`}</p>}
            {showBar && <div className="xpp-bar" aria-hidden>{segs.map((p, i) => <span key={p.id} style={{ flexGrow: p.value ?? 0, background: p.color ?? PALETTE[i % PALETTE.length] }} />)}</div>}
            {x.parts.length === 0
              ? <p className="xpp-def">Nothing contributes to this yet.</p>
              : <ul className="xpp-list">{x.parts.map(p => <Node key={p.id} n={p} total={total} depth={0} go={go} color={p.color ?? (showBar && (p.value ?? 0) > 0 ? PALETTE[k++ % PALETTE.length] : undefined)} />)}</ul>}
            {showBar && <div className="xpp-foot">Total<b>{x.valueText}</b></div>}
            {x.footnote && <p className="xpp-note">{x.footnote}</p>}
          </>
        )
      })()}
    </div>, host)
}
