'use client'

import { useEffect, useState } from 'react'
import { X } from '@/components/explain/Explain'
import type { LensId } from '@/lib/lens'

// One truth, a view for each role, chosen from who is signed in (their job title, else their org
// role). A rep sees their own book; managers, leaders and finance see what they answer for first.
type Tile = { label: string; valueText: string; sub: string; m: string; scope?: 'me'; tone: 'critical' | 'good' | 'accent' | 'ink' }
export type LensData = { lens: LensId; label: string; title: string | null; tiles: Tile[] }
const TONE: Record<Tile['tone'], string> = { critical: 'var(--critical, #c43d2b)', good: 'var(--good, #2f8f5b)', accent: 'var(--accent, #E85A25)', ink: 'var(--ink, #0E0D0B)' }

let cache: Promise<LensData | null> | null = null
export function useLens(): LensData | null {
  const [d, setD] = useState<LensData | null>(null)
  useEffect(() => {
    if (!cache) cache = fetch('/api/lens').then(r => r.ok ? r.json() : null).catch(() => null)
    let dead = false; cache.then(x => { if (!dead) setD(x) })
    return () => { dead = true }
  }, [])
  return d
}

export function LensStrip({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="lens-strip">
      {tiles.map((t, i) => (
        <div key={i} className="lens-tile">
          <div className="lens-tile-k">{t.label}</div>
          <div className="lens-tile-v" style={{ color: TONE[t.tone] }}><X m={t.m} scope={t.scope}>{t.valueText}</X></div>
          <div className="lens-tile-s">{t.sub}</div>
        </div>
      ))}
    </div>
  )
}
