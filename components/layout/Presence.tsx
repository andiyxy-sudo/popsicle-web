'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Who else in your organisation is here, and what they are looking at. Uses Supabase
// Realtime presence (no table, no writes): each client broadcasts its name and current
// screen, and everyone in the same channel sees the roster. Demo mode shows a scripted
// teammate so the feature is visible in a walkthrough.
type Peer = { id: string; name: string; screen: string; account?: string }
const LABEL: Record<string, string> = { pulse: 'Pulse', portfolio: 'Portfolio', signals: 'Signals', forecast: 'Forecast', intelligence: 'Intelligence', team: 'Team', integrations: 'Integrations', settings: 'Settings', ask: 'Ask AI', accounts: 'an account' }

export function Presence({ userId, name, demo }: { userId: string; name: string; demo: boolean }) {
  const [peers, setPeers] = useState<Peer[]>([])
  const pathname = usePathname()

  useEffect(() => {
    if (demo) {
      const t = setTimeout(() => setPeers([
        { id: 'demo-mike', name: 'Mike Ross', screen: 'accounts', account: 'Meridian Labs' },
        { id: 'demo-jamie', name: 'Jamie Torres', screen: 'signals' },
      ]), 3500)
      return () => clearTimeout(t)
    }
    const supabase = createClient()
    const seg = pathname.split('/').filter(Boolean)
    const channel = supabase.channel('org-presence', { config: { presence: { key: userId } } })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, Array<{ name?: string; screen?: string; account?: string }>>
        const list: Peer[] = []
        for (const [id, metas] of Object.entries(state)) {
          if (id === userId) continue
          const m = metas[metas.length - 1]
          list.push({ id, name: m?.name || 'Teammate', screen: m?.screen || 'pulse', account: m?.account })
        }
        setPeers(list)
      })
      .subscribe(status => { if (status === 'SUBSCRIBED') channel.track({ name, screen: seg[0] ?? 'pulse', account: seg[0] === 'accounts' ? decodeURIComponent(seg[1] ?? '') : undefined }) })
    return () => { supabase.removeChannel(channel) }
  }, [userId, name, demo, pathname])

  if (peers.length === 0) return null
  const initials = (n: string) => n.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()
  const where = (p: Peer) => p.account ? p.account : (LABEL[p.screen] ?? p.screen)

  // v11.91: lives in the ink sidebar, just above your own profile, instead of floating over content
  return (
    <div className="sb-presence" aria-label="Teammates online">
      <div className="sb-presence-label"><span className="sb-presence-live" />Online now</div>
      {peers.slice(0, 4).map(p => (
        <div key={p.id} className="sb-presence-row" title={`${p.name} · ${where(p)}`}>
          <span className="sb-presence-av">{initials(p.name)}</span>
          <span className="sb-presence-txt">
            <span className="sb-presence-name">{p.name}</span>
            <span className="sb-presence-where">{where(p)}</span>
          </span>
        </div>
      ))}
      {peers.length > 4 && <div className="sb-presence-more">+{peers.length - 4} more</div>}
    </div>
  )
}
