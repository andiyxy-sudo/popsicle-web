'use client'

import { useEffect, useRef, useState } from 'react'

// Animates a formatted figure ("$1.2M", "47", "91%", "+38%") from zero to its
// value on first paint: 900ms, ease-out, respects reduced motion. The text is
// parsed for its numeric core so prefixes, suffixes and decimals are preserved.
export function CountUp({ value, duration = 900, className, style }: { value: string; duration?: number; className?: string; style?: React.CSSProperties }) {
  const m = /^([^0-9.-]*)(-?\d+(?:\.\d+)?)(.*)$/.exec(value.replace(/,/g, ''))
  const [shown, setShown] = useState<string>(m ? `${m[1]}0${m[3]}` : value)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (!m) { setShown(value); return }
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const target = parseFloat(m[2]); const decimals = (m[2].split('.')[1] || '').length
    const prefix = m[1], suffix = m[3]
    if (reduce) { setShown(value); return }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = target * eased
      setShown(`${prefix}${decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString()}${suffix}`)
      if (t < 1) raf.current = requestAnimationFrame(tick); else setShown(value)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{shown}</span>
}
