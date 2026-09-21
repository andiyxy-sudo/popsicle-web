'use client'

import { useEffect, useState } from 'react'
import type { Changes } from '@/lib/replay'

// "Since your last visit": per screen, remembered in the browser. If you were here in the last
// half hour (or never), it compares against the start of the week instead, so there's always a
// meaningful baseline. One fetch per baseline, shared by everything on the page.
const inflight = new Map<number, Promise<Changes | null>>()

function startOfWeek(now: number) {
  const d = new Date(now); const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - (dow === 0 ? 7 : dow)); d.setHours(9, 0, 0, 0)
  return d.getTime()
}
function label(since: number, now: number, fromVisit: boolean) {
  if (!fromVisit) return 'Since Monday'
  const h = (now - since) / 3600e3
  if (h < 24) return `Since your last visit, ${Math.max(1, Math.round(h))}h ago`
  const days = Math.round(h / 24)
  return days <= 6 ? `Since your last visit, ${days} day${days === 1 ? '' : 's'} ago` : `Since ${new Date(since).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`
}

export function useChanges(screen: string) {
  const [state, setState] = useState<{ changes: Changes; label: string } | null>(null)
  useEffect(() => {
    const now = Date.now()
    const key = `visit:${screen}`
    let prev = 0
    try { prev = Number(localStorage.getItem(key)) || 0 } catch { /* ignore */ }
    const fromVisit = prev > 0 && now - prev > 30 * 60e3 && now - prev < 30 * 864e5
    const since = fromVisit ? prev : startOfWeek(now)
    const rounded = Math.floor(since / 60e3) * 60e3
    let p = inflight.get(rounded)
    if (!p) { p = fetch(`/api/changes?since=${rounded}`).then(r => r.ok ? r.json() : null).catch(() => null); inflight.set(rounded, p) }
    let dead = false
    p.then(c => { if (!dead && c) setState({ changes: c, label: label(since, now, fromVisit) }) })
    // remember this visit once you've actually been here a moment
    const t = setTimeout(() => { try { localStorage.setItem(key, String(Date.now())) } catch { /* ignore */ } }, 8000)
    return () => { dead = true; clearTimeout(t) }
  }, [screen])
  return state
}
