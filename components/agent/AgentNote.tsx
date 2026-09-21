'use client'

import type { AgentMessage } from '@/lib/agent/compose'
import { money } from '@/lib/agent/compose'
import { formatWhen } from '@/lib/utils'

// One note from the agent, in the portal's editorial language: a mono dateline, the fact
// as a headline, their words, the agent's view, one recommended action, the receipts.
const SRC: Record<string, string> = { gmail: 'Gmail', outlook: 'Outlook', whatsapp: 'WhatsApp', slack: 'Slack', zoom: 'Zoom', hubspot: 'HubSpot', gcal: 'Calendar', fireflies: 'Fireflies' }
const LANE_COLOR: Record<string, string> = { commitments: '#d38b1d', risk: '#c43d2b', quiet: '#7C5CFC', followup: '#5C5855', renewals: '#2f8f5b' }

export function Dateline({ m }: { m: Pick<AgentMessage, 'account' | 'amount' | 'source' | 'when' | 'tag' | 'lane' | 'priority'> }) {
  const bits = [m.account?.toUpperCase(), m.amount ? money(m.amount) : null, m.tag, m.source ? (SRC[m.source] ?? m.source).toUpperCase() : null, m.when ? formatWhen(m.when).toUpperCase() : null].filter(Boolean)
  return (
    <div className="note-dateline">
      <span className="note-rule" style={{ background: m.priority === 'critical' ? '#c43d2b' : (LANE_COLOR[m.lane] ?? '#A09C97') }} />
      {bits.map((b, i) => <span key={i} className={i === 0 ? 'note-dl-strong' : ''}>{i ? '· ' : ''}{b}</span>)}
    </div>
  )
}

export function AgentNote({ m, onAction, onReceipt, compact = false }: { m: AgentMessage; onAction: (a: AgentMessage['actions'][number]) => void; onReceipt: (href: string) => void; compact?: boolean }) {
  const [primary, ...rest] = m.actions
  return (
    <div className={`note${compact ? ' compact' : ''}`}>
      <Dateline m={m} />
      <div className="note-head">{m.headline}</div>
      {m.quote && (
        <blockquote className="note-quote">
          “{m.quote}”
          {m.quoteBy && <cite>{m.quoteBy}{m.source ? ` · ${SRC[m.source] ?? m.source}` : ''}</cite>}
        </blockquote>
      )}
      {m.judgment && <div className="note-view">{m.judgment}</div>}
      <div className="note-foot">
        {primary && <button className="note-act" onClick={() => onAction(primary)}>{primary.label}</button>}
        {rest.map(a => <span key={a.label} className="note-link" onClick={() => onAction(a)}>{a.label}</span>)}
        {m.receipts[0] && <span className="note-link" onClick={() => onReceipt(m.receipts[0].href)}>Source</span>}
      </div>
    </div>
  )
}
