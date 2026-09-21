'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AGENT_NAME } from '@/lib/agent/config'
import type { AgentBrief, AgentMessage } from '@/lib/agent/compose'
import { AgentNote } from './AgentNote'

// The agent's home at the top of Ask: the day's notes, already written, in order.
export function AgentFeed({ onAsk }: { onAsk: (q: string) => void }) {
  const router = useRouter()
  const params = useSearchParams()
  const focusKey = params.get('agent')
  const [brief, setBrief] = useState<AgentBrief | null>(null)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    let dead = false
    fetch('/api/agent').then(r => r.ok ? r.json() : null).then((b: AgentBrief | null) => { if (!dead && b) setBrief(b) }).catch(() => {})
    return () => { dead = true }
  }, [])
  useEffect(() => {
    if (!brief || !focusKey || focusKey === 'brief') return
    const t = setTimeout(() => refs.current[focusKey]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)
    return () => clearTimeout(t)
  }, [brief, focusKey])

  if (!brief) return null
  const act = (a: AgentMessage['actions'][number]) => { if (a.href) router.push(a.href); else if (a.ask) onAsk(a.ask) }
  const now = new Date()
  const hour = now.getHours()
  const hello = `${hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'}, ${brief.greeting.split(', ')[1] ?? ''}`.replace(/\.?$/, '.')
  const actionNotes = brief.messages.filter(m => m.lane !== 'followup')
  const follow = brief.messages.filter(m => m.lane === 'followup')

  return (
    <div className="agent-desk">
      <div className="desk-head">
        <div className="note-dateline"><span className="agent-mark" /><span className="note-dl-strong">{AGENT_NAME.toUpperCase()}</span><span>· {now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}</span><span>· {brief.read} SIGNALS READ</span></div>
        <div className="desk-title">{hello} {brief.summary}</div>
      </div>

      {actionNotes.map((m, i) => (
        <div key={m.key} ref={el => { refs.current[m.key] = el }} className={`desk-item${focusKey === m.key ? ' focused' : ''}`} style={{ animationDelay: `${i * 60}ms` }}>
          <AgentNote m={m} onAction={act} onReceipt={href => router.push(href)} />
        </div>
      ))}

      {follow.length > 0 && (
        <>
          <div className="desk-sub">Following up on what you did</div>
          {follow.map(m => (
            <div key={m.key} ref={el => { refs.current[m.key] = el }} className={`desk-item${focusKey === m.key ? ' focused' : ''}`}>
              <AgentNote m={m} onAction={act} onReceipt={href => router.push(href)} />
            </div>
          ))}
        </>
      )}

      <div className="desk-foot">{brief.watching > 0 ? `${brief.watching} more I'm watching. I'll bring them to you if they move.` : 'Nothing else is moving.'}</div>
    </div>
  )
}
