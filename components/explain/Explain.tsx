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
const PALETTE = ['#E85A25', '#F2994A', '#F6C28B', '#C8B6A3', '#9D8F82', '#6F665E', '#B5533C', '#D9A066']
const SRC_COLOR: Record<string, string> = { gmail: '#EA4335', outlook: '#0A64AD', slack: '#611F69', zoom: '#2D8CFF', whatsapp: '#25D366', hubspot: '#FF7A59', gcal: '#1A73E8', fireflies: '#7C5CFC' }
const money = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`)

function Node({ n, total, depth, go, color }: { n: XNode; total: number; depth: number; go: (href: string) => void; color?: string }) {
  const [openKids, setOpenKids] = useState<boolean>(false)
  const hasKids = !!n.children?.length
  const val = n.valueText ?? (n.value != null ? money(n.value) : '')
  const share = n.value != null && total > 0 ? Math.max(2, Math.round(n.value / total * 100)) : null
  if (n.evidence && !hasKids) {
    const ev = n.evidence
    return (
      <div className="xp-ev" style={{ marginLeft: depth ? 12 : 0 }}>
        <div className="xp-ev-top">
          {ev.source && <span className="xp-src" style={{ background: SRC_COLOR[ev.source] ?? '#8E8983' }} title={SRC[ev.source] ?? ev.source}>{(SRC[ev.source] ?? ev.source).charAt(0)}</span>}
          <div className="xp-ev-title" onClick={() => n.href && go(n.href)}>{ev.title}{val ? <span className="xp-ev-val">{val}</span> : null}</div>
        </div>
        {ev.quote && <div className="xp-ev-quote">“{ev.quote}”</div>}
        <div className="xp-ev-meta">
          {ev.source && <span className="xp-pill">{SRC[ev.source] ?? ev.source}</span>}
          {ev.when && <span className="xp-meta-t">{formatWhen(ev.when)}</span>}
          {n.note && <span className="xp-meta-t">{n.note}</span>}
          {n.href && <span className="xp-ev-open" onClick={() => go(n.href!)}>Open →</span>}
        </div>
      </div>
    )
  }
  return (
    <div className="xp-node" style={{ marginLeft: depth ? 12 : 0 }}>
      <div className={`xp-row${hasKids ? ' has-kids' : ''}`} onClick={() => hasKids ? setOpenKids(o => !o) : n.href && go(n.href)}>
        <span className="xp-row-label">{color && <span className="xp-swatch" style={{ background: color }} />}{hasKids && <svg className={`xp-chev${openKids ? ' open' : ''}`} width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M3.5 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}{n.label}</span>
        <span className="xp-row-val">{val}{share != null && depth === 0 && total > 0 && <span className="xp-share">{share}%</span>}</span>
      </div>
      {share != null && depth > 0 && <div className="xp-bar"><span style={{ width: `${share}%` }} /></div>}
      {n.note && <div className="xp-row-note">{n.note}</div>}
      {hasKids && openKids && <div className="xp-kids">{n.children!.map(c => <Node key={c.id} n={c} total={n.value ?? 0} depth={depth + 1} go={go} />)}</div>}
    </div>
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
  const W = Math.min(440, window.innerWidth - 24)
  const left = Math.min(Math.max(12, req.rect.left), window.innerWidth - W - 12)
  const below = req.rect.bottom + 10, room = window.innerHeight - below
  const top = room > 320 ? below : Math.max(12, req.rect.top - Math.min(520, window.innerHeight * 0.7) - 10)
  const go = (href: string) => { setReq(null); router.push(href) }
  const total = x?.value ?? 0

  return createPortal(
    <div ref={panel} className="xp-panel" style={{ left, top, width: W }} role="dialog" aria-label="Where this number comes from">
      {!x && !err && <div className="xp-loading"><span /><span /><span /></div>}
      {err && <div className="xp-err">{err}</div>}
      {x && (
        <>
          <div className="xp-top">
            <div className="xp-eyebrow"><span className="xp-dot" />How this is calculated</div>
          </div>
          <div className="xp-title">{x.label}</div>
          <div className="xp-value">{x.valueText}</div>
          {(() => {
            const segs = x.parts.filter(p => (p.value ?? 0) > 0)
            const sum = segs.reduce((t, p) => t + (p.value ?? 0), 0)
            if (segs.length < 2 || sum <= 0) return null
            return <div className="xp-comp" aria-hidden>{segs.map((p, i) => <span key={p.id} style={{ flexGrow: p.value ?? 0, background: PALETTE[i % PALETTE.length] }} />)}</div>
          })()}
          <div className="xp-def"><svg width="13" height="13" viewBox="0 0 16 16" aria-hidden><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M8 7v4M8 4.8v.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg><span>{x.definition}</span></div>
          {x.n != null && (
            <div className="xp-stat">{x.collecting ? `Collecting · ${x.n} ratings so far, shown from 30` : `${x.n} ratings · 95% range ${Math.round((x.interval?.[0] ?? 0) * 100)}\u2013${Math.round((x.interval?.[1] ?? 0) * 100)}%`}</div>
          )}
          <div className="xp-parts">
            {x.parts.length === 0 && <div className="xp-empty">Nothing contributes to this yet.</div>}
            {(() => { let k = 0; return x.parts.map(p => <Node key={p.id} n={p} total={total} depth={0} go={go} color={(p.value ?? 0) > 0 && x.parts.filter(q => (q.value ?? 0) > 0).length > 1 ? PALETTE[k++ % PALETTE.length] : undefined} />) })()}
          </div>
          {x.parts.some(p => p.value != null) && x.parts.length > 1 && (
            <div className="xp-sum"><span>Total</span><span>{x.valueText}</span></div>
          )}
          {x.footnote && <div className="xp-foot">{x.footnote}</div>}
        </>
      )}
    </div>, document.body)
}
