'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Themed time picker: a mono button that opens a small paper popover with hour and minute columns.
// The popover is drawn on top of the page (not inside the window that holds the button), so a scrolling
// or clipped container can never cut it off; it opens upward when there isn't room below.
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']
const POP_H = 196
export function TimeField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null), popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; up: boolean } | null>(null)
  const [h, m] = (value || '09:00').split(':')
  const place = () => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return
    const up = r.bottom + 6 + POP_H > window.innerHeight - 8 && r.top - 6 - POP_H > 8
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 150)), top: up ? r.top - 6 : r.bottom + 6, up })
  }
  useLayoutEffect(() => { if (open) place() }, [open])
  useEffect(() => {
    if (!open || !pos) return
    popRef.current?.querySelectorAll<HTMLElement>('[data-on="1"]').forEach(el => { const box = el.parentElement!; box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2 })
  }, [open, pos])
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onMove = () => place()
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onMove); window.addEventListener('scroll', onMove, true)   // follows the button if its window scrolls
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onMove); window.removeEventListener('scroll', onMove, true) }
  }, [open])
  const col = (items: string[], cur: string, pick: (v: string) => void) => (
    <div style={{ maxHeight: 176, overflowY: 'auto', minWidth: 56, position: 'relative' }}>
      {items.map(it => (
        <div key={it} data-on={it === cur ? '1' : undefined} onClick={() => pick(it)} style={{ padding: '7px 12px', fontSize: 14, cursor: 'pointer', background: it === cur ? 'var(--accent, #E85A25)' : 'transparent', color: it === cur ? '#fff' : 'var(--ink)' }}>{it}</div>
      ))}
    </div>
  )
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
        style={{ font: 'inherit', fontSize: 14, padding: '7px 12px', border: '1px solid ' + (open ? 'var(--ink-muted, #5C5855)' : 'var(--hairline, #EFEAE1)'), background: open ? 'var(--inset, #F4F0E8)' : 'transparent', color: 'var(--ink-muted)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .5 : 1, whiteSpace: 'nowrap' }}>
        {h}:{m}
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={popRef} style={{ position: 'fixed', left: pos.left, top: pos.top, transform: pos.up ? 'translateY(-100%)' : undefined, zIndex: 2000, fontFamily: "var(--font-sans, 'Outfit', sans-serif)",
          background: 'var(--paper, #FBF8F3)', border: '1px solid var(--hairline, #EFEAE1)', boxShadow: '0 18px 40px -18px rgba(14,13,11,.35)', display: 'flex', padding: 6, gap: 6 }}>
          {col(HOURS, h, v => onChange(`${v}:${m}`))}
          {col(MINUTES, MINUTES.includes(m) ? m : '00', v => { onChange(`${h}:${v}`); setOpen(false) })}
        </div>,
        document.body,
      )}
    </div>
  )
}
