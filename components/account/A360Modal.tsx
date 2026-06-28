'use client'

import { useEffect } from 'react'

export interface ModalConfig {
  title: string
  body: React.ReactNode
  footer?: React.ReactNode
}

export type ConfirmKind = 'success' | 'schedule' | 'email' | 'escalate' | 'connect' | 'snooze' | 'deploy'

// Faithful port of the prototype's actionConfirm: colored icon, title, desc,
// a 3-line detail box, and a "LOGGED · time" timestamp.
export function ActionConfirmBody({ kind, title, desc }: { kind: ConfirmKind; title: string; desc: string }) {
  const isEscalate = kind === 'escalate'
  const iconColor = isEscalate ? '#DC2626' : '#16A34A'
  const iconBg = isEscalate ? 'rgba(220,38,38,.1)' : 'rgba(22,163,74,.1)'
  const iconBorder = isEscalate ? 'rgba(220,38,38,.25)' : 'rgba(22,163,74,.25)'

  const iconPath = kind === 'schedule'
    ? <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>
    : kind === 'email'
    ? <><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="22 7 12 13 2 7"/></>
    : isEscalate
    ? <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
    : kind === 'connect'
    ? <><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>
    : kind === 'snooze'
    ? <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>
    : kind === 'deploy'
    ? <><polyline points="22 2 11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>
    : <polyline points="20 6 9 17 4 12"/>

  const now = new Date()
  const h = now.getHours(), mn = now.getMinutes()
  const timeStr = `${h % 12 || 12}:${mn < 10 ? '0' : ''}${mn}${h >= 12 ? ' PM' : ' AM'}`

  let lines: string[]
  if (kind === 'schedule') lines = ['Calendar invite sent', 'Your calendar has been updated', 'Reminder set 30 min before']
  else if (kind === 'email') lines = ['Message delivered and logged', 'Open tracking enabled', 'Activity recorded in Popsicle']
  else if (isEscalate) lines = ['Leadership team notified', 'Escalation logged in account history', 'Follow-up reminder created']
  else if (kind === 'connect') lines = ['Integration handshake initiated', 'Syncing data in the background', 'You will be notified when ready']
  else if (kind === 'snooze') lines = ['Signal paused temporarily', 'Reminder queued', 'You will be notified at the set time']
  else if (kind === 'deploy') lines = ['All assets deployed across channels', 'Open tracking enabled', 'Activity recorded in account history']
  else lines = ['Action confirmed and logged', 'Activity recorded in account history', 'Popsicle continues monitoring']

  const lineIcons = [
    <polyline key="0" points="20 6 9 17 4 12"/>,
    <polyline key="1" points="20 6 9 17 4 12"/>,
    <g key="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></g>,
  ]

  return (
    <div style={{ textAlign: 'center', padding: '6px 0 4px' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: iconBg, border: `2px solid ${iconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{iconPath}</svg>
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-.3px', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 16, lineHeight: 1.55 }}>{desc}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: iconBg, border: `1px solid ${iconBorder}`, borderRadius: 10, padding: '14px 16px', textAlign: 'left', marginBottom: 4 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--t2)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round">{lineIcons[i]}</svg>
            {l}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t4)', marginTop: 10, fontFamily: "'DM Mono',monospace" }}>LOGGED · {timeStr}</div>
    </div>
  )
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
