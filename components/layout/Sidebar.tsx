'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'
import { useEscape } from '@/components/ui/useEscape'

interface SidebarProps {
  user: { email: string; id: string; name?: string; role?: string; avatar_url?: string }
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
      { id: 'review', href: '/review', label: 'Review',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4M8 9l3 2.5L8 14" /></svg> },
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
  // v11.129: a highlight that glides to the page you pick, before the page has even loaded
  const navRef = useRef<HTMLDivElement>(null)
  const [glide, setGlide] = useState<{ top: number; h: number; on: boolean; phase?: 'stretch' | 'settle' }>({ top: 0, h: 36, on: false })
  const glideRef = useRef(glide); glideRef.current = glide
  const settleT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const moveGlide = (el: HTMLElement) => {
    const to = { top: el.offsetTop, h: el.offsetHeight }, cur = glideRef.current
    if (settleT.current) clearTimeout(settleT.current)
    if (!cur.on || Math.abs(cur.top - to.top) < 2) { setGlide({ ...to, on: true, phase: 'settle' }); return }
    // 1. stretch: reach from the current item to the new one, like a drop of liquid
    const top = Math.min(cur.top, to.top), bottom = Math.max(cur.top + cur.h, to.top + to.h)
    setGlide({ top, h: bottom - top, on: true, phase: 'stretch' })
    // 2. settle: let go of the old item and spring onto the new one
    settleT.current = setTimeout(() => setGlide({ ...to, on: true, phase: 'settle' }), 170)
  }

  const pathname = usePathname()
  useLayoutEffect(() => {
    const el = navRef.current?.querySelector('.ed-sb-item.on') as HTMLElement | null
    if (el) moveGlide(el); else setGlide(g => ({ ...g, on: false }))
  }, [pathname])
  const router = useRouter()
  const supabase = createClient()

  const displayName = isDemo ? 'Andy G' : (user.name || user.email.split('@')[0])
  // the person's job title (what sets their Pulse view); no online/offline status in a business tool
  const displayRole = user.role?.trim() || (isDemo ? 'VP of Sales' : '')
  const initials = isDemo ? 'AG' : getInitials(user.name || user.email.split('@')[0])

  const [profileOpen, setProfileOpen] = useState(false)
  useEscape(profileOpen, () => setProfileOpen(false))
  const [draftName, setDraftName] = useState(displayName)
  const [draftTz, setDraftTz] = useState('')
  const [draftRole, setDraftRole] = useState(displayRole)
  const meta = user as { timezone?: string }
  const [tzPick, setTzPick] = useState(meta.timezone ?? '')
  const TIMEZONES = ['Asia/Jakarta', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney']
  const [photo, setPhoto] = useState<string | null>((user as { avatar_url?: string }).avatar_url ?? null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (profileOpen) {
      setDraftName(displayName)
      setDraftRole(displayRole)
      try { const d = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; setDraftTz(d); if (!tzPick) setTzPick(d) } catch { setDraftTz('') }
      setSaved(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileOpen])



  function pickPhoto() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          // Downscale to 256px square so it fits in the profile record.
          const size = 256
          const canvas = document.createElement('canvas')
          canvas.width = size; canvas.height = size
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          const side = Math.min(img.width, img.height)
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
          setPhoto(canvas.toDataURL('image/jpeg', 0.82))
        }
        img.src = String(reader.result)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  async function saveProfile() {
    setSaving(true)
    // Name lives on the auth user's metadata; email changes are an auth flow,
    // so this panel shows the address rather than pretending to edit it.
    await supabase.auth.updateUser({ data: { name: draftName.trim(), role: draftRole.trim(), avatar_url: photo ?? null, } }).catch(() => {})
    setSaving(false); setSaved(true)
    router.refresh()
    setTimeout(() => setProfileOpen(false), 700)
  }

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

      <div className="ed-sb-nav" ref={navRef} onClickCapture={e => { const a = (e.target as HTMLElement).closest('.ed-sb-item') as HTMLElement | null; if (a) moveGlide(a) }}>
        <span className={`ed-sb-glide${glide.on ? ' on' : ''}${glide.phase ? ` ${glide.phase}` : ''}`} aria-hidden style={{ transform: `translateY(${glide.top}px)`, height: glide.h }} />
        {NAV.map((group, gi) => (
          <div key={group.section}>
            <div className="ed-sb-rule" style={{ background: gi === 0 ? 'transparent' : 'rgba(251,248,243,.12)', margin: gi === 0 ? '30px 26px 0' : '20px 26px 18px' }} />
            {group.items.map(item => {
              const active = pathname === item.href
              const badgeVal = item.badgeKey ? badges[item.badgeKey] : undefined
              return (
                <Link key={item.id} href={item.href} prefetch className={`ed-sb-item${active ? ' on' : ''}`} id={`nav-${item.id}`}>
                  <span className="ed-sb-dot" style={{ background: active ? '#E85A25' : 'transparent' }} />
                  <span className="ed-sb-label">{item.label}</span>
                  {badgeVal != null && badgeVal > 0 && <span className="ed-sb-count">{badgeVal}</span>}
                </Link>
              )
            })}
          </div>
        ))}
        <div className="ed-sb-rule" style={{ background: 'rgba(251,248,243,.12)', margin: '20px 26px 18px' }} />
        <Link href="/ask" prefetch className={`ed-sb-item${pathname === '/ask' ? ' on' : ''}`}>
          <span className="ed-sb-dot" style={{ background: pathname === '/ask' ? '#E85A25' : 'transparent' }} />
          <span className="ed-sb-label">Ask Popsicle</span>
        </Link>
      </div>

      <div className="ed-sb-user" onClick={() => setProfileOpen(true)} title="Profile">
        <div className="ed-sb-avatar" style={photo ? { background: `center/cover url(${photo})`, color: 'transparent' } : undefined}>{photo ? '' : initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{displayName}</div>
          {displayRole && <div style={{ fontSize: 11.5, color: 'rgba(251,248,243,.45)' }}>{displayRole}</div>}
        </div>
      </div>
      {profileOpen && typeof document !== 'undefined' && createPortal((
        <div onClick={() => setProfileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(14,13,11,.42)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: 'var(--paper, #FBF8F3)', boxShadow: '0 40px 90px -30px rgba(14,13,11,.5)', animation: 'fadeUp .3s both', color: 'var(--ink, #0E0D0B)' }}>
            <div style={{ padding: '32px 32px 0', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', flex: 'none' }}>
                <span onClick={pickPhoto} title="Change photo" style={{ width: 54, height: 54, borderRadius: '50%', background: photo ? `center/cover url(${photo})` : 'var(--accent, #E85A25)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18, cursor: 'pointer', overflow: 'hidden' }}>
                  {!photo && initials}
                </span>
                <span onClick={pickPhoto} title="Change photo" style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: '50%', background: 'var(--ink, #0E0D0B)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', border: '2px solid var(--paper, #FBF8F3)' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></svg>
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: '-.03em' }}>Edit profile</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-muted, #5C5855)', marginTop: 3 }}>{displayName} · {user.email}</div>
              </div>
              <button onClick={() => setProfileOpen(false)} style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--ink-faint)', background: 'none', border: 0, cursor: 'pointer' }}>close</button>
            </div>

            {/* the pen on the avatar changes the photo; only removal needs its own control */}
            {photo && (
              <div style={{ padding: '12px 32px 0' }}>
                <span onClick={() => setPhoto(null)} style={{ fontSize: 13, color: 'var(--ink-faint)', cursor: 'pointer' }}>Remove photo</span>
              </div>
            )}

            <div style={{ padding: photo ? '22px 32px 0' : '26px 32px 0', display: 'grid', gap: 20 }}>
              <label style={{ display: 'block' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Display name</span>
                <input value={draftName} onChange={e => setDraftName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0 }} />
              </label>

              <label style={{ display: 'block' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Job title</span>
                <input value={draftRole} onChange={e => setDraftRole(e.target.value)} placeholder="VP Sales"
                  style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0 }} />
                              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6 }}>Sets what Pulse shows you first: reps see their own accounts, managers their team, leaders the forecast, finance the revenue at risk.</span>
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Work email</span>
                <input value={user.email} readOnly title="Email changes go through account recovery"
                  style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--hairline, #EFEAE1)', background: 'transparent', color: 'var(--ink-muted, #5C5855)', outline: 0 }} />
              </label>
            </div>

            <div style={{ padding: '26px 32px 0' }}>
              <div style={{ marginTop: 22 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Signature name</span>
                <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.55 }}>
                  Drafts you send sign off as <strong style={{ fontWeight: 600, color: 'var(--ink)' }}>{draftName.trim() || displayName}</strong> from {user.email}.
                </div>
              </div>

              {/* working hours, morning digest and notification toggles live on the Settings page */}
            </div>

            {/* password lives on the Settings page (Security) */}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '24px 32px 28px' }}>
              <span onClick={handleSignOut} style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.2px', color: 'var(--critical, #c43d2b)', fontWeight: 500, cursor: 'pointer' }}>Sign out</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setProfileOpen(false)} style={{ font: 'inherit', fontSize: 13.5, fontWeight: 500, padding: '10px 18px', borderRadius: 'var(--toggle-radius, 0px)', border: 0, background: 'transparent', color: 'var(--ink-muted)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveProfile} disabled={saving || !draftName.trim()}
                  style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '10px 22px', borderRadius: 'var(--toggle-radius, 0px)', border: 0, color: '#fff', cursor: 'pointer',
                    background: saved ? 'var(--good, #2f8f5b)' : 'linear-gradient(135deg,#FF8A50,#FF6B35)', boxShadow: '0 6px 18px -6px rgba(255,107,53,.5)', opacity: saving ? .7 : 1 }}>
                  {saving ? 'Saving...' : saved ? 'Saved' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ), document.body)}
    </nav>
  )
}
