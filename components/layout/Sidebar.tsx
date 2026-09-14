'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'

interface SidebarProps {
  user: { email: string; id: string; name?: string; role?: string }
  isDemo: boolean
  badges?: { portfolio?: number; signals?: number; integrations?: number }
}

const NAV = [
  {
    section: 'Main',
    items: [
      { id: 'pulse', href: '/pulse', label: 'Pulse',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
      { id: 'portfolio', href: '/portfolio', label: 'Portfolio', badgeKey: 'portfolio' as const,
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-4 0v2"/></svg> },
      { id: 'signals', href: '/signals', label: 'Signals', badgeKey: 'signals' as const,
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5.64 19.36A9 9 0 0118.36 4.64"/><path d="M8.46 16.54A5 5 0 0115.54 7.46"/><circle cx="12" cy="12" r="1"/></svg> },
      { id: 'forecast', href: '/forecast', label: 'Forecast',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg> },
    ],
  },
  {
    section: 'Analytics',
    items: [
      { id: 'intelligence', href: '/intelligence', label: 'Intelligence',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
      { id: 'team', href: '/team', label: 'Team',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
    ],
  },
  {
    section: 'Settings',
    items: [
      { id: 'integrations', href: '/integrations', label: 'Integrations', badgeKey: 'integrations' as const, badgeOk: true,
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> },
      { id: 'settings', href: '/settings', label: 'Settings',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
    ],
  },
]

export function Sidebar({ user, isDemo, badges = {} }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const displayName = isDemo ? 'Andy G' : (user.name || user.email.split('@')[0])
  const displayRole = isDemo ? 'Online · VP Sales' : 'Online'
  const initials = isDemo ? 'AG' : getInitials(user.name || user.email.split('@')[0])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="sidebar ed-sidebar">
      <div className="ed-sb-logo" onClick={() => router.push('/pulse')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-dark-smallmark.svg" alt="Popsicle Labs" />
      </div>

      <div className="ed-sb-nav">
        {NAV.map((group, gi) => (
          <div key={group.section}>
            <div className="ed-sb-rule" style={{ background: gi === 0 ? 'transparent' : 'rgba(251,248,243,.12)', margin: gi === 0 ? '30px 26px 0' : '20px 26px 18px' }} />
            {group.items.map(item => {
              const active = pathname === item.href
              const badgeVal = item.badgeKey ? badges[item.badgeKey] : undefined
              return (
                <div key={item.id} className={`ed-sb-item${active ? ' on' : ''}`} onClick={() => router.push(item.href)} id={`nav-${item.id}`}>
                  <span className="ed-sb-dot" style={{ background: active ? '#E85A25' : 'transparent' }} />
                  <span className="ed-sb-label">{item.label}</span>
                  {badgeVal != null && badgeVal > 0 && <span className="ed-sb-count">{badgeVal}</span>}
                </div>
              )
            })}
          </div>
        ))}
        <div className="ed-sb-rule" style={{ background: 'rgba(251,248,243,.12)', margin: '20px 26px 18px' }} />
        <div className={`ed-sb-item${pathname === '/ask' ? ' on' : ''}`} onClick={() => router.push('/ask')}>
          <span className="ed-sb-dot" style={{ background: pathname === '/ask' ? '#E85A25' : 'transparent' }} />
          <span className="ed-sb-label">Ask AI</span>
        </div>
      </div>

      <div className="ed-sb-user" onClick={handleSignOut} title="Sign out">
        <div className="ed-sb-avatar">{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{displayName}</div>
          <div style={{ fontSize: 11.5, color: 'rgba(251,248,243,.45)' }}>{displayRole}</div>
        </div>
      </div>
    </nav>
  )
}
