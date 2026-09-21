'use client'

import { useEffect, useState } from 'react'
import type { Decision } from '@/lib/decisions'

// The decision trail for one account: what was decided, by whom, and what was true at the time.
const money = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`)

export function Decisions({ account }: { account: string }) {
  const [list, setList] = useState<Decision[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  useEffect(() => {
    let dead = false
    fetch(`/api/decisions?account=${encodeURIComponent(account)}`).then(r => r.ok ? r.json() : null).then(j => {
      if (dead) return
      let local: Decision[] = []
      try { local = (JSON.parse(localStorage.getItem('demo:decisions') || '[]') as Decision[]).filter(d => d.account_name === account) } catch { /* ignore */ }
      const all = [...local, ...((j?.decisions ?? []) as Decision[])]
      setList(all.filter((d, i) => all.findIndex(x => x.id === d.id) === i).sort((a, b) => b.created_at.localeCompare(a.created_at)))
    }).catch(() => setList([]))
    return () => { dead = true }
  }, [account])
  if (!list || list.length === 0) return null
  return (
    <section className="dt">
      <div className="dt-h"><span className="rv-kicker"><span className="rv-dot" />Decision trail</span><span className="dt-n">{list.length} decision{list.length === 1 ? '' : 's'}, each with the evidence at the time</span></div>
      {list.map(d => {
        const f = d.evidence?.figures ?? {}, open = openId === d.id
        return (
          <div key={d.id} className={`dt-row${open ? ' open' : ''}`}>
            <button className="dt-top" onClick={() => setOpenId(open ? null : d.id)} aria-expanded={open}>
              <span className="dt-date">{new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span className="dt-text">{d.decision}</span>
              <span className={`rv-status st-${d.status}`}>{d.status}</span>
            </button>
            <div className="dt-meta">{[d.by && `decided by ${d.by}`, d.owner && `owner ${d.owner}`, d.due_at && `due ${new Date(d.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, d.source === 'review' && 'in pipeline review'].filter(Boolean).join(' · ')}</div>
            {open && (
              <div className="dt-then">
                <div className="dt-then-h">What was true on {new Date(d.evidence?.capturedAt ?? d.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                <div className="dt-figs">
                  {f.value ? <span><b>{money(f.value)}</b> annual value</span> : null}
                  {f.stage ? <span><b>{f.stage}</b> stage</span> : null}
                  {f.health != null ? <span><b>{f.health}</b> health</span> : null}
                  {f.atRisk ? <span><b>{money(f.atRisk)}</b> at risk</span> : null}
                  {f.openSignals != null ? <span><b>{f.openSignals}</b> open signals</span> : null}
                </div>
                {(d.evidence?.signals ?? []).map(s => (
                  <a key={s.id} className="dt-sig" href={`/signals?signal=${s.id}`}>
                    <span className="dt-sig-t">{s.title}</span>
                    {s.quote && <span className="dt-sig-q">“{s.quote.replace(/^["“]|["”]$/g, '')}”</span>}
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
