'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'

interface SidebarProps {
  user: { email: string; id: string }
  signalCount?: number
}

const NAV_ITEMS = [
  {
    section: 'Monitor',
    items: [
      {
        href: '/dashboard',
        label: 'Signals',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
        ),
        badgeKey: 'signals',
      },
      {
        href: '/accounts',
        label: 'Accounts',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Tools',
    items: [
      {
        href: '/ask',
        label: 'Ask AI',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Setup',
    items: [
      {
        href: '/integrations',
        label: 'Integrations',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
        ),
      },
      {
        href: '/settings',
        label: 'Settings',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        ),
      },
    ],
  },
]

export function Sidebar({ user, signalCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const initials = getInitials(user.email.split('@')[0])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0,
      width: 'var(--sidebar-w)',
      background: 'var(--sidebar-bg)',
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(255,107,53,.09) 0%, transparent 60%)',
      borderRight: '1px solid rgba(255,255,255,.055)',
      boxShadow: '2px 0 24px rgba(0,0,0,.18)',
      display: 'flex', flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        display: 'flex', alignItems: 'center', gap: '11px',
        borderBottom: '1px solid rgba(255,255,255,.06)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'var(--o)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          filter: 'drop-shadow(0 2px 8px rgba(255,107,53,.4))',
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
            <rect x="8" y="6" width="7" height="28" rx="3.5" fill="white"/>
            <rect x="19" y="13" width="7" height="21" rx="3.5" fill="rgba(255,255,255,0.7)"/>
            <circle cx="31" cy="22" r="5" fill="rgba(255,255,255,0.9)"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1 }}>
            Popsicle
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--o)', opacity: .9, textTransform: 'uppercase', letterSpacing: '.42em', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
            Revenue OS
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(group => (
          <div key={group.section}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '1.5px',
              textTransform: 'uppercase', color: 'rgba(255,255,255,.35)',
              padding: '18px 14px 5px',
              fontFamily: "'DM Mono', monospace",
            }}>
              {group.section}
            </div>
            {group.items.map(item => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              const isDashboardActive = item.href === '/dashboard' && (pathname === '/dashboard' || pathname === '/')

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', borderRadius: 'var(--r-sm)',
                    fontSize: 13, fontWeight: isActive || isDashboardActive ? 700 : 600,
                    color: isActive || isDashboardActive ? '#fff' : 'rgba(255,255,255,.58)',
                    background: isActive || isDashboardActive
                      ? 'linear-gradient(135deg,rgba(255,107,53,.18),rgba(255,107,53,.08))'
                      : 'transparent',
                    textDecoration: 'none',
                    marginBottom: 1, position: 'relative',
                    transition: 'all .15s',
                  }}
                >
                  {(isActive || isDashboardActive) && (
                    <span style={{
                      position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                      width: 3, height: 22,
                      background: 'linear-gradient(180deg,#FF8C50,#E85A22)',
                      borderRadius: '0 2px 2px 0',
                      boxShadow: '0 0 14px rgba(255,107,53,.65)',
                    }} />
                  )}
                  <span style={{ color: isActive || isDashboardActive ? 'var(--o)' : 'inherit' }}>
                    {item.icon}
                  </span>
                  {item.label}
                  {item.badgeKey === 'signals' && signalCount > 0 && (
                    <span style={{
                      position: 'absolute', right: 12,
                      minWidth: 18, height: 18, borderRadius: 9,
                      background: 'var(--danger)', color: '#fff',
                      fontSize: 9, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 5px', fontFamily: "'DM Mono', monospace",
                    }}>
                      {signalCount > 99 ? '99+' : signalCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding: '10px 14px 14px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 'var(--r-sm)',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(140deg,#FFB347 0%,#FF8C42 40%,#FF6B35 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email.split('@')[0]}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,.3)', padding: 4, borderRadius: 4,
              display: 'flex', alignItems: 'center',
              transition: 'color .15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,.7)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.3)')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
