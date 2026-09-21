'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AGENT_NAME } from '@/lib/agent/config'
import type { AgentBrief, AgentMessage } from '@/lib/agent/compose'
import { AgentAvatar } from './AgentAvatar'

// the server composes in UTC; greet in the viewer's own time
const localGreeting = (g: string) => { const h = new Date().getHours(); return g.replace(/^(Morning|Afternoon|Evening)/, h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening') }

// The agent's home on the Ask page: what it has to tell you today, as a short run of
// messages from a colleague. Every message carries its receipts and a couple of replies.
const LANE: Record<string, string> = { commitments: 'Your promises', risk: 'Deal risk', quiet: 'Gone quiet', renewals: 'Renewals', brief: 'Brief' }

export function AgentFeed({ onAsk }: { onAsk: (q: string) => void }) {
  const router = useRouter()
  const params = useSearchParams()
  const focusKey = params.get('agent')
  const [brief, setBrief] = useState<AgentBrief | null>(null)
  const [shown, setShown] = useState(0)          // messages revealed so far (a colleague talks in turns)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    let dead = false
    fetch('/api/agent').then(r => r.ok ? r.json() : null).then((b: AgentBrief | null) => { if (!dead && b) setBrief(b) }).catch(() => {})
    return () => { dead = true }
  }, [])

  // reveal one message at a time, quickly
  useEffect(() => {
    if (!brief) return
    const total = brief.messages.length + 1
    if (shown >= total) return
    const t = setTimeout(() => setShown(s => s + 1), shown === 0 ? 350 : 420)
    return () => clearTimeout(t)
  }, [brief, shown])

  // arriving from the pop-up: bring that message into view
  useEffect(() => {
    if (!brief || !focusKey || focusKey === 'brief') return
    const el = refs.current[focusKey]
    if (el && shown > brief.messages.length) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [brief, focusKey, shown])

  if (!brief) return null
  const act = (m: AgentMessage, a: AgentMessage['actions'][number]) => { if (a.href) router.push(a.href); else if (a.ask) onAsk(a.ask) }

  return (
    <div className="agent-feed">
      <div className="agent-feed-head">
        <AgentAvatar size={44} />
        <div>
          <div className="agent-feed-name">{AGENT_NAME}</div>
          <div className="agent-feed-sub">your revenue colleague · read everything since yesterday</div>
        </div>
      </div>

      {shown >= 1 && (
        <div className="agent-msg agent-in">
          <div className="agent-msg-bubble">
            <div className="agent-lead" style={{ fontSize: 17 }}>{localGreeting(brief.greeting)}</div>
            <div className="agent-text">{brief.summary}</div>
          </div>
        </div>
      )}

      {brief.messages.map((m, i) => shown >= i + 2 && (
        <div key={m.key} ref={el => { refs.current[m.key] = el }} className={`agent-msg agent-in${focusKey === m.key ? ' focused' : ''}`}>
          <div className="agent-msg-bubble">
            <div className="agent-msg-lane"><span className={`agent-lane-dot lane-${m.lane}`} />{LANE[m.lane] ?? m.lane}{m.priority === 'critical' ? ' · needs you today' : ''}</div>
            <div className="agent-lead">{m.headline}</div>
            <div className="agent-text">{m.body}</div>
            <div className="agent-receipts">
              {m.receipts.map(r => (
                <span key={`${r.type}-${r.id}`} className="agent-receipt" onClick={() => router.push(r.href)} title="Open the source">
                  {r.type === 'signal' ? 'Signal' : r.type === 'commitment' ? 'Commitment' : 'Account'} · {r.label}
                </span>
              ))}
            </div>
          </div>
          <div className="agent-replies">
            {m.actions.map(a => <button key={a.label} className="agent-chip" onClick={() => act(m, a)}>{a.label}</button>)}
          </div>
        </div>
      ))}

      {shown > brief.messages.length && !brief.quiet && (
        <div className="agent-feed-foot">That's everything for now. Ask me anything below, or I'll tap you on the shoulder if something changes.</div>
      )}
    </div>
  )
}
