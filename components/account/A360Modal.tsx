'use client'

import { useEffect } from 'react'

export interface ModalConfig {
  title: string
  body: React.ReactNode
  footer?: React.ReactNode
}

export function A360Modal({ config, onClose }: { config: ModalConfig | null; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (config) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [config, onClose])

  if (!config) return null

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: 'rgba(15,12,9,.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'modalBg .2s ease' }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: 480, maxWidth: '92vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(13,10,7,.22),0 0 0 1px rgba(0,0,0,.08)', animation: 'modalIn .25s cubic-bezier(.32,0,.17,1)' }}>
        <div style={{ padding: '20px 24px 16px', backgroundColor: '#FF8040', backgroundImage: 'radial-gradient(rgba(255,255,255,.15) 1px,transparent 1px),linear-gradient(140deg,#FFB347,#FF6B35)', backgroundSize: '18px 18px,100% 100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: 0 }}>{config.title}</h3>
          <div onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>{config.body}</div>
        {config.footer && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>{config.footer}</div>
        )}
      </div>
      <style>{`
        @keyframes modalBg { from{opacity:0} to{opacity:1} }
        @keyframes modalIn { from{opacity:0;transform:scale(.96) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </div>
  )
}

export function ModalBtn({ children, primary, danger, onClick }: { children: React.ReactNode; primary?: boolean; danger?: boolean; onClick?: () => void }) {
  const bg = danger ? 'var(--danger)' : primary ? 'var(--o)' : 'var(--inset)'
  const color = (primary || danger) ? '#fff' : 'var(--t1)'
  const border = danger ? 'var(--danger)' : primary ? 'var(--od)' : 'var(--border)'
  return (
    <button onClick={onClick} style={{ padding: '9px 18px', borderRadius: 10, background: bg, color, border: `1px solid ${border}`, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
      {children}
    </button>
  )
}
