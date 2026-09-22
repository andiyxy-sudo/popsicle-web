'use client'

import { useEffect, useRef, useState } from 'react'

// Themed date picker: a mono button that opens a paper month grid. Value is
// YYYY-MM-DD. Replaces the browser's native <input type="date">.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pad = (n: number) => String(n).padStart(2, '0')
export function DateField({ value, onChange, placeholder = 'Pick a date', min }: { value: string; onChange: (v: string) => void; placeholder?: string; min?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const sel = value ? new Date(value + 'T00:00:00') : null
  const [view, setView] = useState(() => { const d = sel ?? new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  const first = new Date(view.y, view.m, 1)
  const startDow = (first.getDay() + 6) % 7   // Monday first
  const days = new Date(view.y, view.m + 1, 0).getDate()
  const today = new Date(); const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const label = sel ? sel.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : placeholder
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 12.5, padding: '9px 12px', width: '100%', textAlign: 'left', border: '1px solid var(--hairline, #EFEAE1)', background: open ? 'var(--inset, #F4F0E8)' : 'transparent', color: sel ? 'var(--ink)' : 'var(--ink-faint)', cursor: 'pointer' }}>
        {label}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, background: 'var(--paper, #FBF8F3)', border: '1px solid var(--hairline, #EFEAE1)', boxShadow: '0 18px 40px -18px rgba(14,13,11,.35)', padding: 14, width: 268 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <button type="button" onClick={() => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 })} style={{ font: 'inherit', background: 'none', border: 0, cursor: 'pointer', color: 'var(--ink-muted)', fontSize: 16, padding: '0 6px' }}>‹</button>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{MONTHS[view.m]} {view.y}</span>
            <button type="button" onClick={() => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 })} style={{ font: 'inherit', background: 'none', border: 0, cursor: 'pointer', color: 'var(--ink-muted)', fontSize: 16, padding: '0 6px' }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--ink-faint)', textAlign: 'center', paddingBottom: 4 }}>{d}</span>)}
            {Array.from({ length: startDow }).map((_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: days }).map((_, i) => {
              const key = `${view.y}-${pad(view.m + 1)}-${pad(i + 1)}`
              const isSel = value === key, isToday = key === todayKey, disabled = !!min && key < min
              return (
                <button key={key} type="button" disabled={disabled} onClick={() => { onChange(key); setOpen(false) }}
                  style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 12, height: 30, border: 0, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .3 : 1,
                    background: isSel ? 'var(--d-btn, var(--ink, #0E0D0B))' : 'transparent', color: isSel ? '#fff' : isToday ? 'var(--accent)' : 'var(--ink)', fontWeight: isToday || isSel ? 700 : 400 }}>
                  {i + 1}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
