'use client'

import { useEffect, useState } from 'react'
import type { Decision } from '@/lib/decisions'

// The decision trail for one account: what was decided, by whom, and what was true at the time.
// Set in the house style of Pulse's "Today": Outfit, a section head over a strong rule, hairline rows.
const money = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`)
const day = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-US', opts)
const healthTone = (h: number) => (h >= 70 ? 'var(--good, #2f8f5b)' : h >= 40 ? 'var(--warn, #d38b1d)' : 'var(--critical, #c43d2b)')
const SRC: Record<string, string> = { gmail: 'Gmail', outlook: 'Outlook', slack: 'Slack', zoom: 'Zoom', whatsapp: 'WhatsApp', hubspot: 'HubSpot', gcal: 'Calendar', fireflies: 'Fireflies' }
const SRC_COLOR: Record<string, string> = { gmail: '#EA4335', outlook: '#0A64AD', slack: '#611F69', zoom: '#2D8CFF', whatsapp: '#25D366', hubspot: '#FF7A59', gcal: '#1A73E8', fireflies: '#7C5CFC' }
const STATUS: Record<string, string> = { open: 'Open', done: 'Done', reversed: 'Reversed' }

export function Decisions({ account, initial }: { account: string; initial?: Decision[] }) {
  const [list, setList] = useState<Decision[] | null>(initial ?? null)
  const [openId, setOpenId] = useState<string | null>(initial?.[0]?.id ?? null)
  useEffect(() => {
    if (initial) return
    let dead = false
    fetch(`/api/decisions?account=${encodeURIComponent(account)}`).then(r => r.ok ? r.json() : null).then(j => {
      if (dead) return
      let local: Decision[] = []
      try { local = (JSON.parse(localStorage.getItem('demo:decisions') || '[]') as Decision[]).filter(d => d.account_name === account) } catch { /* ignore */ }
      const all = [...local, ...((j?.decisions ?? []) as Decision[])]
      const sorted = all.filter((d, i) => all.findIndex(x => x.id === d.id) === i).sort((a, b) => b.created_at.localeCompare(a.created_at))
      setList(sorted); setOpenId(o => o ?? sorted[0]?.id ?? null)   // the latest decision opens by default
    }).catch(() => setList([]))
    return () => { dead = true }
  }, [account, initial])
  if (!list || list.length === 0) return null

  return (
    <section className="dt2">
      <div className="dt2-head">
        <h2>Decision trail</h2>
        <span>{list.length} decision{list.length === 1 ? '' : 's'} · with the evidence at the time</span>
      </div>
      {list.map(d => {
        const f = d.evidence?.figures ?? {}, open = openId === d.id
        const meta = [d.by && `Decided by ${d.by}`, d.owner && `owner ${d.owner}`, d.due_at && `due ${day(d.due_at, { month: 'short', day: 'numeric' })}`, d.source === 'review' ? 'in pipeline review' : null].filter(Boolean).join(' · ')
        const figs: Array<[string, string, string?]> = [
          ...(f.value ? [['Annual value', money(f.value)] as [string, string]] : []),
          ...(f.atRisk ? [['At risk', money(f.atRisk), 'var(--critical, #c43d2b)'] as [string, string, string]] : []),
          ...(f.health != null ? [['Health', String(f.health), healthTone(f.health)] as [string, string, string]] : []),
          ...(f.stage ? [['Stage', f.stage] as [string, string]] : []),
          ...(f.openSignals != null ? [['Open signals', String(f.openSignals)] as [string, string]] : []),
        ]
        return (
          <article key={d.id} className={`dt2-row${open ? ' open' : ''}`}>
            <div className="dt2-date"><span>{day(d.created_at, { month: 'short' })}</span><b>{day(d.created_at, { day: 'numeric' })}</b></div>
            <div className="dt2-body">
              <div className="dt2-top">
                <p className="dt2-text">{d.decision}</p>
                <span className={`dt2-status st-${d.status}`}>{STATUS[d.status] ?? d.status}</span>
              </div>
              {meta && <div className="dt2-meta">{meta}</div>}
              <button className="dt2-toggle" onClick={() => setOpenId(open ? null : d.id)} aria-expanded={open}>
                {open ? 'Hide what was true then' : 'What was true then'}
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
              {open && (
                <div className="dt2-then">
                  <div className="dt2-then-k">On {day(d.evidence?.capturedAt ?? d.created_at, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                  {figs.length > 0 && (
                    <div className="dt2-figs">
                      {figs.map(([k, v, c]) => <div key={k}><span>{k}</span><b style={c ? { color: c } : undefined}>{v}</b></div>)}
                    </div>
                  )}
                  {(d.evidence?.signals ?? []).length > 0 && (
                    <div className="dt2-sigs">
                      <div className="dt2-then-k">The signals behind it</div>
                      {(d.evidence?.signals ?? []).map(s => (
                        <a key={s.id} className="dt2-sig" href={`/signals?signal=${s.id}`}>
                          <span className="dt2-sig-h">
                            <i style={{ background: s.severity === 'high' ? 'var(--critical, #c43d2b)' : s.severity === 'positive' ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)' }} />
                            {s.title}
                            {s.source && <em><b style={{ background: SRC_COLOR[s.source] ?? '#A09C97' }} />{SRC[s.source] ?? s.source}</em>}
                          </span>
                          {s.quote && <span className="dt2-sig-q">{s.quote.replace(/^["“]|["”]$/g, '')}</span>}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </article>
        )
      })}
    </section>
  )
}
