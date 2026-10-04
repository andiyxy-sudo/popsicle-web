'use client'

import { useEntitlements, resetsOn } from '@/lib/plan'

// Free workspaces only: the plan, what is left, and where to go if it runs out. Paid and internal
// orgs get nothing at all, not an empty row, because a counter they can never spend is just noise.
export function UnlockCounter({ isDemo = false }: { isDemo?: boolean }) {
  const { ent, loaded } = useEntitlements()
  if (isDemo || !loaded || !ent || ent.paid) return null

  const left = ent.unlocks_left ?? 0
  const reset = resetsOn(ent)

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.6px', textTransform: 'uppercase' }}>
      <span style={{ color: 'var(--accent)' }}>Free</span>
      <span aria-hidden style={{ color: 'var(--ink-faint)' }}>·</span>
      <span style={{ color: left === 0 ? 'var(--critical, #c43d2b)' : 'var(--ink-muted)' }}>
        {left === 0 ? `0 unlocks left. Resets ${reset}.` : `${left} unlock${left === 1 ? '' : 's'} left this month`}
      </span>
      <a href="/settings?sheet=plan" style={{ color: 'var(--accent)', textDecoration: 'none', borderBottom: '1px solid rgba(232,90,37,.35)' }}>Upgrade</a>
    </span>
  )
}
