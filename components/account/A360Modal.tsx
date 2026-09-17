'use client'

// Result dialog, rebuilt in the current design: a square paper sheet on a
// blurred ink scrim, mono eyebrow, editorial headline, hairline detail rows.
// The API is unchanged so every existing caller keeps working.

import { useEffect } from 'react'

export interface ModalConfig {
  title: string
  body: React.ReactNode
  footer?: React.ReactNode | null
}

const MONO = { fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.6px', textTransform: 'uppercase' as const }

export function ModalBtn({ primary, onClick, children }: { primary?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      style={{
        font: 'inherit', fontFamily: "'Outfit',sans-serif", fontSize: 13.5, fontWeight: primary ? 600 : 500,
        padding: primary ? '11px 24px' : '11px 20px', borderRadius: 999, cursor: 'pointer',
        border: primary ? 0 : '1px solid var(--border, #E5DFD4)',
        background: primary ? 'linear-gradient(135deg,#FF8A50,#FF6B35)' : 'var(--raised, #FFFDFA)',
        color: primary ? '#fff' : 'var(--ink, #0E0D0B)',
        boxShadow: primary ? '0 6px 18px -8px rgba(255,107,53,.6)' : 'none',
      }}>
      {children}
    </button>
  )
}

export function ActionConfirmBody({ kind, title, desc, rows }: {
  kind: 'success' | 'escalate' | 'connect'
  title: string
  desc?: string
  rows?: string[]
}) {
  const color = kind === 'success' ? 'var(--good, #2f8f5b)'
    : kind === 'escalate' ? 'var(--critical, #c43d2b)'
    : 'var(--accent, #E85A25)'
  const eyebrow = kind === 'success' ? 'done' : kind === 'escalate' ? 'could not complete' : 'heads up'
  return (
    <div>
      <div style={{ ...MONO, color, display: 'inline-flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />{eyebrow}
      </div>
      <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 23, letterSpacing: '-.03em', margin: '11px 0 0', color: 'var(--ink, #0E0D0B)' }}>{title}</h2>
      {desc && <div style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink-muted, #5C5855)', marginTop: 10 }}>{desc}</div>}
      {rows && rows.length > 0 && (
        <div style={{ marginTop: 18 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '7px minmax(0,1fr)', gap: 12, padding: '10px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', fontSize: 14, lineHeight: 1.5, color: 'var(--ink, #0E0D0B)' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, marginTop: 7 }} />
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function A360Modal({ config, onClose }: { config: ModalConfig | null; onClose: () => void }) {
  // the floating Ask bar must not sit over the sheet
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.dataset.modal = config ? '1' : '0'
    return () => { document.body.dataset.modal = '0' }
  }, [config])

  if (!config) return null
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 820, background: 'rgba(14,13,11,.42)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: 'min(460px,100%)', maxHeight: '84vh', overflowY: 'auto', background: 'var(--paper, #FBF8F3)', padding: '26px 28px 26px', boxShadow: '0 40px 90px -30px rgba(14,13,11,.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <span style={{ ...MONO, color: 'var(--ink-faint, #A09C97)' }}>{config.title}</span>
          <button onClick={onClose} style={{ ...MONO, fontSize: 10.5, background: 'none', border: 0, color: 'var(--ink-faint, #A09C97)', cursor: 'pointer' }}>close</button>
        </div>
        <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', marginBottom: 20 }} />
        {config.body}
        {config.footer && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
            {config.footer}
          </div>
        )}
      </div>
    </div>
  )
}
