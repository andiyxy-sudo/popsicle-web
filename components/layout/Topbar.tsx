'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TopbarProps {
  signalCount?: number
  onAskClick?: () => void
  initials?: string
}

interface NotifSignal { id: string; title: string | null; account_name: string | null; severity: string | null; created_at: string }

function notifAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000
  if (d < 1 / 24) return 'just now'
  if (d < 1) return `${Math.max(1, Math.floor(d * 24))}h ago`
  if (d < 2) return 'yesterday'
  return `${Math.floor(d)}d ago`
}

export function Topbar({ signalCount = 0, onAskClick, initials = 'U' }: TopbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState<NotifSignal[]>([])
  const [hasUnseen, setHasUnseen] = useState(false)
  const notifRef = useRef<HTMLDivElement | null>(null)

  // The bell shows the newest open signals; the dot lights up when anything
  // arrived since the last time the panel was opened (tracked locally).
  useEffect(() => {
    let cancelled = false
    async function load() {
      const supa = createClient()
      const { data: { user } } = await supa.auth.getUser()
      if (!user || cancelled) return
      const { data } = await supa.from('signals')
        .select('id, title, account_name, severity, created_at')
        .eq('user_id', user.id).eq('is_dismissed', false).eq('is_snoozed', false)
        .or('status.is.null,status.eq.open')
        .order('created_at', { ascending: false }).limit(8)
      if (cancelled) return
      const rows = (data ?? []) as NotifSignal[]
      setNotifs(rows)
      const seenAt = localStorage.getItem('popsicle_notif_seen_at') ?? ''
      setHasUnseen(rows.some(r => r.created_at > seenAt))
    }
    load()
    return () => { cancelled = true }
  }, [pathname])

  // Close on outside click.
  useEffect(() => {
    if (!notifOpen) return
    const onDown = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [notifOpen])

  function toggleNotifs() {
    const next = !notifOpen
    setNotifOpen(next)
    if (next) {
      localStorage.setItem('popsicle_notif_seen_at', new Date().toISOString())
      setHasUnseen(false)
    }
  }

  const step = (path: string) =>
    pathname === path ? 'pipeline-step active' : 'pipeline-step'

  return (
    <div className="topbar" id="pipeline-bar">
      {/* Search */}
      <div className="topbar-search" style={{ position: 'relative' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input placeholder="Search anything…" id="global-search" />
        <span className="topbar-search-kbd">⌘K</span>
      </div>

      {/* Center pipeline */}
      <div className="topbar-pipeline">
        <div className={step('/signals')} onClick={() => router.push('/signals')} id="ps-signals">
          <div className="pipeline-step-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <span className="pipeline-step-label">Signals</span>
          {signalCount > 0 && <span className="pipeline-count" id="pipeline-sig-count">{signalCount}</span>}
        </div>
        <span className="pipeline-chevron">›</span>
        <div className={step('/portfolio')} onClick={() => router.push('/portfolio')} id="ps-cases">
          <div className="pipeline-step-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-4 0v2"/></svg>
          </div>
          <span className="pipeline-step-label">Cases</span>
        </div>
        <span className="pipeline-chevron">›</span>
        <div className={step('/pulse')} onClick={() => router.push('/pulse')} id="ps-actions">
          <div className="pipeline-step-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span className="pipeline-step-label">Actions</span>
        </div>
        <span className="pipeline-chevron">›</span>
        <div className={step('/intelligence')} onClick={() => router.push('/intelligence')} id="ps-impact">
          <div className="pipeline-step-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
          </div>
          <span className="pipeline-step-label">Impact</span>
        </div>
      </div>

      {/* Right */}
      <div className="topbar-right">
        <button className="ask-btn" onClick={onAskClick} title="Ask Popsicle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Ask Popsicle
        </button>
        <div ref={notifRef} style={{ position: 'relative' }}>
          <div className="topbar-btn" title="Notifications" onClick={toggleNotifs} style={{ cursor: 'pointer' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            {hasUnseen && <div className="topbar-notif"></div>}
          </div>
          {notifOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 340, background: 'var(--surface, #fff)', border: '1px solid var(--line, var(--border))', borderRadius: 14, boxShadow: '0 18px 48px rgba(15,12,9,.18)', zIndex: 400, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line, var(--border))', fontSize: 12.5, fontWeight: 800, color: 'var(--t1)' }}>Notifications</div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {notifs.length === 0 && (
                  <div style={{ padding: '26px 16px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>No open signals. All quiet.</div>
                )}
                {notifs.map(n => (
                  <div key={n.id} onClick={() => { setNotifOpen(false); router.push('/signals') }} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 16px', borderBottom: '1px solid var(--line, var(--border))', cursor: 'pointer' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: n.severity === 'high' ? 'var(--danger)' : n.severity === 'positive' ? 'var(--ok)' : 'var(--amber)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.4 }}>{n.title || 'Signal'}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--t3)', marginTop: 2 }}>{n.account_name ? `${n.account_name} · ` : ''}{notifAgo(n.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div onClick={() => { setNotifOpen(false); router.push('/signals') }} style={{ padding: '11px 16px', textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--o)', cursor: 'pointer' }}>View all signals</div>
            </div>
          )}
        </div>
        <div className="topbar-avatar" onClick={() => router.push('/settings')} title="Settings">
          {initials}
        </div>
      </div>
    </div>
  )
}
