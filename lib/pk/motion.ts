'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * FLIP: keep a list's rows in place while the order changes, then move them from where they WERE to
 * where they now are. Used when a filter changes or a column is sorted, so you can see what moved
 * rather than the table blinking into a new arrangement.
 * Give each row `data-flip="<stable id>"` inside the container.
 */
export function useFlip<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T | null>(null)
  const prev = useRef<Map<string, DOMRect>>(new Map())

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-flip]'))
    if (!reduced()) {
      for (const row of rows) {
        const key = row.dataset.flip!
        const was = prev.current.get(key)
        const now = row.getBoundingClientRect()
        if (was) {
          const dy = was.top - now.top
          const dx = was.left - now.left
          if (Math.abs(dy) > 1 || Math.abs(dx) > 1) {
            row.animate(
              [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
              { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' },
            )
          }
        } else {
          // rows that were not there a moment ago arrive rather than appear
          row.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
            { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' })
        }
      }
    }
    prev.current = new Map(rows.map(r => [r.dataset.flip!, r.getBoundingClientRect()]))
  }, [dep])

  return ref
}

/**
 * Move a copy of one element to another, then leave it there. Used when an amount flies from the row
 * you just handled up to the figure it adds to, so the two are read as one event.
 */
export function flyTo(from: HTMLElement | null, to: HTMLElement | null, opts?: { text?: string; color?: string }) {
  if (!from || !to || reduced()) return Promise.resolve()
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect()
  const ghost = document.createElement('div')
  ghost.textContent = opts?.text ?? from.textContent ?? ''
  Object.assign(ghost.style, {
    position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, margin: '0', zIndex: '9999', pointerEvents: 'none',
    font: getComputedStyle(from).font, color: opts?.color ?? getComputedStyle(from).color,
    fontWeight: '700', whiteSpace: 'nowrap',
  } as CSSStyleDeclaration)
  document.body.appendChild(ghost)
  const anim = ghost.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${(b.left - a.left) * 0.55}px, ${(b.top - a.top) * 0.42}px) scale(1.08)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(.82)`, opacity: 0 },
  ], { duration: 720, easing: 'cubic-bezier(.3,.7,.2,1)' })
  return anim.finished.then(() => ghost.remove()).catch(() => ghost.remove())
}

/** Text that writes itself in, so a draft reads as written rather than pasted. */
export function useTypewriter(full: string, on: boolean, cps = 420) {
  const [out, setOut] = useState(on ? '' : full)
  useEffect(() => {
    if (!on) { setOut(full); return }
    if (reduced()) { setOut(full); return }
    let i = 0, raf = 0, t0 = 0
    const step = (t: number) => {
      if (!t0) t0 = t
      i = Math.min(full.length, Math.round(((t - t0) / 1000) * cps))
      setOut(full.slice(0, i))
      if (i < full.length) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [full, on, cps])
  return out
}

/** Which rows are new since the last render, so an arriving Concern can announce itself once. */
export function useArrivals(ids: string[]) {
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (seen.current === null) { seen.current = new Set(ids); return }   // first paint announces nothing
    const added = ids.filter(id => !seen.current!.has(id))
    seen.current = new Set(ids)
    if (!added.length) return
    setFresh(new Set(added))
    const t = setTimeout(() => setFresh(new Set()), 2600)
    return () => clearTimeout(t)
  }, [ids.join(',')])
  return fresh
}
