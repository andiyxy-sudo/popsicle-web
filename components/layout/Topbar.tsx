'use client'

import { useRouter, usePathname } from 'next/navigation'

interface TopbarProps {
  signalCount?: number
  onAskClick?: () => void
  initials?: string
}

export function Topbar({ signalCount = 0, onAskClick, initials = 'U' }: TopbarProps) {
  const router = useRouter()
  const pathname = usePathname()

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
        <div className="topbar-btn" title="Notifications">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          <div className="topbar-notif"></div>
        </div>
        <div className="topbar-avatar" onClick={() => router.push('/settings')} title="Settings">
          {initials}
        </div>
      </div>
    </div>
  )
}
