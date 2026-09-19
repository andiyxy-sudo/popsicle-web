'use client'

import { useEffect, useRef, useState } from 'react'

// Themed time picker: a mono button that opens a small paper popover with hour
// and minute columns. Replaces the browser's native <input type="time">.
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']
export function TimeField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [h, m] = (value || '09:00').split(':')
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  const col = (items: string[], cur: string, pick: (v: string) => void) => (
    <div style={{ maxHeight: 176, overflowY: 'auto', minWidth: 56 }}>
      {items.map(it => (
        <div key={it} onClick={() => pick(it)} style={{ padding: '7px 12px', fontFamily: "'DM Mono',monospace", fontSize: 12.5, cursor: 'pointer', background: it === cur ? 'var(--ink, #0E0D0B)' : 'transparent', color: it === cur ? '#fff' : 'var(--ink)' }}>{it}</div>
      ))}
    </div>
  )
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
        style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 12.5, padding: '7px 12px', border: '1px solid var(--hairline, #EFEAE1)', background: open ? 'var(--inset, #F4F0E8)' : 'transparent', color: 'var(--ink)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .5 : 1 }}>
        {h}:{m}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, background: 'var(--paper, #FBF8F3)', border: '1px solid var(--hairline, #EFEAE1)', boxShadow: '0 18px 40px -18px rgba(14,13,11,.35)', display: 'flex', padding: 6, gap: 6 }}>
          {col(HOURS, h, v => onChange(`${v}:${m}`))}
          {col(MINUTES, MINUTES.includes(m) ? m : '00', v => { onChange(`${h}:${v}`); setOpen(false) })}
        </div>
      )}
    </div>
  )
}
