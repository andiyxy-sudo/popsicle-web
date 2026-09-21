'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChanges } from './useChanges'
import { Replay } from './Replay'
import { formatWhen } from '@/lib/utils'

// One line at the top of a screen: what moved since you last looked. Expand for the events,
// or replay the last eight weeks.
export function SinceBar({ screen }: { screen: string }) {
  const s = useChanges(screen)
  const [open, setOpen] = useState(false)
  const [replay, setReplay] = useState(false)
  const router = useRouter()
  if (!s) return <div className="since since-skel" aria-hidden />
  const { changes: c, label } = s
  const quiet = c.lines.length === 0
  return (
    <div className="since">
      <div className="since-line">
        <span className="since-dot" />
        <span className="since-label">{label}</span>
        <span className="since-text">{quiet ? 'Nothing has moved. Every figure is where you left it.' : c.lines.join(' · ')}</span>
        <span className="since-actions">
          {!quiet && <button onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Hide' : 'What changed'}</button>}
          <button onClick={() => setReplay(true)}>Replay ▸</button>
        </span>
      </div>
      {open && (
        <div className="since-events">
          {c.events.slice(0, 12).map(e => (
            <div key={e.id + e.kind} className="since-ev" onClick={() => router.push(`/signals?signal=${e.id}`)}>
              <span className={`since-ev-dot sev-${e.kind === 'handled' ? 'done' : e.severity}`} />
              <span className="since-ev-acct">{e.account}</span>
              <span className="since-ev-title">{e.kind === 'handled' ? `${e.action ?? 'Acted on'}: ${e.title}` : e.title}</span>
              <span className="since-ev-t">{formatWhen(e.t)}</span>
            </div>
          ))}
          {c.events.length > 12 && <div className="since-more">and {c.events.length - 12} more on Signals</div>}
        </div>
      )}
      {replay && <Replay onClose={() => setReplay(false)} />}
    </div>
  )
}
