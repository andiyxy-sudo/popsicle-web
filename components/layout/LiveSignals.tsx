'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Toast = { id: string; title: string; account?: string; severity?: string }

// Subscribes to new rows in the `signals` table for the current user and shows
// a live toast the moment one is detected (no refresh needed). The same insert
// reaches every open client - web and mobile - so signals surface in real time
// everywhere. Demo account is excluded (it has no real signals table data).
export function LiveSignals({ userId }: { userId: string }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const router = useRouter()

  const dismiss = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('signals-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'signals', filter: `user_id=eq.${userId}` },
        (payload) => {
          const s = payload.new as { id: string; title?: string; account_name?: string; severity?: string; is_dismissed?: boolean }
          if (s.is_dismissed) return
          setToasts(t => [{ id: s.id, title: s.title || 'New signal detected', account: s.account_name, severity: s.severity }, ...t].slice(0, 4))
          // Let any open screen refresh its server data so the new signal renders.
          router.refresh()
          // Auto-dismiss after 8s.
          setTimeout(() => dismiss(s.id), 8000)
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, router, dismiss])

  if (toasts.length === 0) return null

  const color = (sev?: string) => sev === 'high' ? 'var(--danger)' : sev === 'positive' ? 'var(--ok)' : 'var(--amber)'

  return (
    <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340 }}>
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => { window.dispatchEvent(new CustomEvent('open-a360', { detail: { name: t.account, stage: 'Active', risk: (t.severity || 'watch').toUpperCase(), arr: '--', health: 0, signals: 1, rep: 'You', lastTouch: t.title } })); dismiss(t.id) }}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border-soft)',
            borderLeft: `4px solid ${color(t.severity)}`, borderRadius: 12,
            padding: '12px 14px', boxShadow: '0 8px 28px rgba(13,10,7,.18)',
            cursor: t.account ? 'pointer' : 'default', animation: 'slideIn .25s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color(t.severity), flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: color(t.severity), textTransform: 'uppercase', letterSpacing: '.6px' }}>New signal</span>
            <span style={{ marginLeft: 'auto', fontSize: 16, color: 'var(--t4)', cursor: 'pointer', lineHeight: 1 }} onClick={(e) => { e.stopPropagation(); dismiss(t.id) }}>×</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.35 }}>{t.title}</div>
          {t.account && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{t.account}</div>}
        </div>
      ))}
      <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(20px) } to { opacity: 1; transform: translateX(0) } }`}</style>
    </div>
  )
}
