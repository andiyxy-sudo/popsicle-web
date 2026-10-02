'use client'

import { useCountUp } from '@/lib/pk/useCountUp'

// A formatted figure ("$1.2M", "47", "91%", "+38%").
// First time it appears in a session it counts up from zero. When it LATER CHANGES it counts from the old
// value to the new one and flashes green or red for the direction it moved, so a figure never changes
// silently on a portal someone leaves open. Same behavior as the mobile app (handoff motions 1 and 2).
// `k` identifies the figure across renders; give each one its own.
export function CountUp({ value, k, duration = 900, className, style }: {
  value: string; k?: string; duration?: number; className?: string; style?: React.CSSProperties
}) {
  const { text, flash } = useCountUp(value, k ?? (value.replace(/[\d.,-]/g, '') || 'figure'), duration)
  return (
    <span
      className={[className, flash === 'up' ? 'pk-flash-up' : flash === 'down' ? 'pk-flash-down' : ''].filter(Boolean).join(' ')}
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
    >{text}</span>
  )
}
