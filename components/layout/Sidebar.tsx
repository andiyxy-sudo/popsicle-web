'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'

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

  const [profileOpen, setProfileOpen] = useState(false)
  const [draftName, setDraftName] = useState(displayName)
  const [draftTz, setDraftTz] = useState('')
  const [draftRole, setDraftRole] = useState(displayRole)
  const meta = user as { timezone?: string; work_start?: string; work_end?: string; digest_time?: string }
  const [tzPick, setTzPick] = useState(meta.timezone ?? '')
  const [workStart, setWorkStart] = useState(meta.work_start ?? '09:00')
  const [workEnd, setWorkEnd] = useState(meta.work_end ?? '18:00')
  const [digestTime, setDigestTime] = useState(meta.digest_time ?? '08:00')
  // Security: which sign-in methods the account has, and whether a password is set.
  // Loaded when the sheet opens (identities are not in the session claims).
  type PwMode = 'change' | 'set' | 'oauth' | 'loading'
  const [pwMode, setPwMode] = useState<PwMode>('loading')
  const [oauthName, setOauthName] = useState('')
  const [curPw, setCurPw] = useState(''); const [newPw, setNewPw] = useState(''); const [confPw, setConfPw] = useState('')
  const [pwState, setPwState] = useState<'idle' | 'saving' | 'saved' | 'reauth' | 'error'>('idle')
  const [pwErr, setPwErr] = useState(''); const [nonce, setNonce] = useState('')
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
      setCurPw(''); setNewPw(''); setConfPw(''); setNonce(''); setPwErr(''); setPwState('idle'); setPwMode('loading')
      supabase.auth.getUser().then(({ data }) => {
        const u = data.user
        if (!u) { setPwMode('set'); return }
        const providers = (u.identities ?? []).map(i => i.provider)
        const social = providers.find(p => p !== 'email')
        if (social && !providers.includes('email')) { setOauthName(social); setPwMode('oauth'); return }
        // an email identity exists: password account if we have seen one set, else magic link / OTP
        setPwMode((u.user_metadata as { has_password?: boolean } | null)?.has_password ? 'change' : 'set')
      }).catch(() => setPwMode('set'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileOpen])

  async function savePassword() {
    setPwErr('')
    if (isDemo) { setPwErr('Password changes are off for the demo account.'); setPwState('error'); return }
    if (newPw.length < 8) { setPwErr('Use at least 8 characters.'); setPwState('error'); return }
    if (newPw !== confPw) { setPwErr('The two passwords do not match.'); setPwState('error'); return }
    setPwState('saving')
    if (pwMode === 'change') {
      // updateUser does not verify the old password, so check it explicitly first
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: user.email, password: curPw })
      if (signErr) { setPwErr('Current password is incorrect.'); setPwState('error'); return }
    }
    const { error } = await supabase.auth.updateUser({ password: newPw, data: { has_password: true }, ...(nonce ? { nonce } : {}) })
    if (error) {
      if (/reauthentication|nonce/i.test(error.message)) {
        // secure password change is on: Supabase wants a fresh code from the inbox
        await supabase.auth.reauthenticate().catch(() => {})
        setPwState('reauth'); setPwErr(''); return
      }
      setPwErr(error.message); setPwState('error'); return
    }
    await supabase.auth.signOut({ scope: 'others' }).catch(() => {})
    setPwMode('change'); setCurPw(''); setNewPw(''); setConfPw(''); setNonce(''); setPwState('saved')
  }

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
    await supabase.auth.updateUser({ data: { name: draftName.trim(), role: draftRole.trim(), avatar_url: photo ?? null, timezone: tzPick || draftTz, work_start: workStart, work_end: workEnd, digest_time: digestTime } }).catch(() => {})
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

      <div className="ed-sb-nav">
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
          <span className="ed-sb-label">Ask AI</span>
        </Link>
      </div>

      <div className="ed-sb-user" onClick={() => setProfileOpen(true)} title="Profile">
        <div className="ed-sb-avatar" style={photo ? { background: `center/cover url(${photo})`, color: 'transparent' } : undefined}>{photo ? '' : initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{displayName}</div>
          <div style={{ fontSize: 11.5, color: 'rgba(251,248,243,.45)' }}>{displayRole}</div>
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

            <div style={{ padding: '14px 32px 0', display: 'flex', gap: 16 }}>
              <span onClick={pickPhoto} style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}>{photo ? 'Change photo' : 'Add photo'}</span>
              {photo && <span onClick={() => setPhoto(null)} style={{ fontSize: 13, color: 'var(--ink-faint)', cursor: 'pointer' }}>Remove</span>}
            </div>

            <div style={{ padding: '26px 32px 0', display: 'grid', gap: 20 }}>
              <label style={{ display: 'block' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Display name</span>
                <input value={draftName} onChange={e => setDraftName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0 }} />
              </label>

              <label style={{ display: 'block' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Job title</span>
                <input value={draftRole} onChange={e => setDraftRole(e.target.value)} placeholder="VP Sales"
                  style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0 }} />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Work email</span>
                <input value={user.email} readOnly title="Email changes go through account recovery"
                  style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--hairline, #EFEAE1)', background: 'transparent', color: 'var(--ink-muted, #5C5855)', outline: 0 }} />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Timezone</span>
                <select value={tzPick || draftTz} onChange={e => setTzPick(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0, cursor: 'pointer' }}>
                  {[...new Set([draftTz, ...TIMEZONES].filter(Boolean))].map(z => <option key={z} value={z}>{z}{z === draftTz ? ' (detected)' : ''}</option>)}
                </select>
              </label>
            </div>

            <div style={{ padding: '26px 32px 0' }}>
              <div style={{ marginTop: 22 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Signature name</span>
                <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.55 }}>
                  Drafts you send sign off as <strong style={{ fontWeight: 600, color: 'var(--ink)' }}>{draftName.trim() || displayName}</strong> from {user.email}.
                </div>
              </div>

              <div style={{ marginTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 0', borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
                <div>
                  <div style={{ fontSize: 15, color: 'var(--ink)' }}>Working hours</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>Used for pre-meeting briefs and digests</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'DM Mono',monospace", fontSize: 12.5, color: 'var(--ink)' }}>
                  <input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)} style={{ font: 'inherit', fontSize: 13, padding: '6px 8px', border: '1px solid var(--hairline, #EFEAE1)', borderRadius: 8, background: 'transparent', color: 'var(--ink)' }} />
                  <span style={{ color: 'var(--ink-faint)' }}>to</span>
                  <input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)} style={{ font: 'inherit', fontSize: 13, padding: '6px 8px', border: '1px solid var(--hairline, #EFEAE1)', borderRadius: 8, background: 'transparent', color: 'var(--ink)' }} />
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 0', borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
                <div>
                  <div style={{ fontSize: 15, color: 'var(--ink)' }}>Morning digest</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>Overnight signals and today's meetings, once a day</div>
                </div>
                <input type="time" value={digestTime} onChange={e => setDigestTime(e.target.value)} style={{ font: 'inherit', fontSize: 13, padding: '6px 8px', border: '1px solid var(--hairline, #EFEAE1)', borderRadius: 8, background: 'transparent', color: 'var(--ink)' }} />
              </div>
              {/* notification toggles live on the Settings page */}
            </div>

            {/* Security */}
            <div style={{ padding: '26px 32px 0' }}>
              <div style={{ paddingBottom: 10, borderBottom: '1px solid var(--rule-strong, #0E0D0B)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Security</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: 'var(--ink-faint)' }}>
                  {pwMode === 'loading' ? 'checking sign-in method' : pwMode === 'oauth' ? `signs in with ${oauthName}` : pwMode === 'change' ? 'password set' : 'email link · no password yet'}
                </span>
              </div>
              {(() => {
                const field = (label: string, value: string, set: (v: string) => void, ph?: string) => (
                  <label style={{ display: 'block', marginTop: 16 }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{label}</span>
                    <input type="password" autoComplete={label.startsWith('Current') ? 'current-password' : 'new-password'} value={value} onChange={e => set(e.target.value)} placeholder={ph} disabled={isDemo || pwState === 'saving'}
                      style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0, opacity: isDemo ? .55 : 1 }} />
                  </label>
                )
                const strength = newPw.length === 0 ? 0 : newPw.length < 8 ? 1 : (/[A-Z]/.test(newPw) && /[0-9]/.test(newPw) && /[^A-Za-z0-9]/.test(newPw)) ? 3 : (/[0-9]/.test(newPw) || /[A-Z]/.test(newPw)) ? 2 : 1
                const strengthColor = ['transparent', 'var(--critical, #c43d2b)', 'var(--warn, #d38b1d)', 'var(--good, #2f8f5b)'][strength]
                if (pwMode === 'oauth') return (
                  <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 14, lineHeight: 1.6 }}>
                    You sign in with <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{oauthName.charAt(0).toUpperCase() + oauthName.slice(1)}</strong>, so there is no Popsicle password to change. Manage it in your {oauthName === 'google' ? <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Google account</a> : oauthName === 'azure' ? <a href="https://mysignins.microsoft.com/security-info" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Microsoft account</a> : `${oauthName} account`}.
                  </div>
                )
                if (pwState === 'saved') return (
                  <div style={{ fontSize: 13.5, color: 'var(--good, #2f8f5b)', marginTop: 14, lineHeight: 1.6 }}>Password updated. Other sessions on this account were signed out.</div>
                )
                return (
                  <div>
                    {pwMode === 'set' && (
                      <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 12, lineHeight: 1.6 }}>You currently sign in with an email link. Add a password as a second way in; the link keeps working.</div>
                    )}
                    {pwMode === 'change' && field('Current password', curPw, setCurPw)}
                    {field(pwMode === 'set' ? 'New password' : 'New password', newPw, setNewPw, 'at least 8 characters')}
                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                      {[1, 2, 3].map(i => <span key={i} style={{ flex: 1, height: 2, background: i <= strength ? strengthColor : 'var(--hairline, #EFEAE1)', transition: 'background .2s' }} />)}
                    </div>
                    {field('Confirm new password', confPw, setConfPw)}
                    {pwState === 'reauth' && (
                      <label style={{ display: 'block', marginTop: 16 }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--accent)' }}>Code from your email</span>
                        <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 6 }}>Your session is older than Supabase allows for password changes. We sent a code to {user.email}.</div>
                        <input value={nonce} onChange={e => setNonce(e.target.value)} inputMode="numeric" placeholder="6-digit code"
                          style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0 }} />
                      </label>
                    )}
                    {pwErr && <div style={{ fontSize: 13, color: 'var(--critical, #c43d2b)', marginTop: 12 }}>{pwErr}</div>}
                    {isDemo && !pwErr && <div style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 12 }}>Password changes are off for the demo account.</div>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                      <button onClick={savePassword} disabled={isDemo || pwState === 'saving' || pwMode === 'loading' || !newPw || !confPw || (pwMode === 'change' && !curPw) || (pwState === 'reauth' && !nonce)}
                        style={{ font: 'inherit', fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 999, border: '1px solid rgba(232,90,37,.28)', background: 'var(--accent-tint, #FFF1EA)', color: 'var(--accent, #E85A25)', cursor: 'pointer', opacity: (isDemo || pwState === 'saving' || !newPw || !confPw) ? .5 : 1 }}>
                        {pwState === 'saving' ? 'Saving…' : pwState === 'reauth' ? 'Confirm with code' : pwMode === 'set' ? 'Set password' : 'Change password'}
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '24px 32px 28px' }}>
              <span onClick={handleSignOut} style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.2px', color: 'var(--critical, #c43d2b)', fontWeight: 500, cursor: 'pointer' }}>Sign out</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setProfileOpen(false)} style={{ font: 'inherit', fontSize: 13.5, fontWeight: 500, padding: '10px 18px', borderRadius: 999, border: 0, background: 'transparent', color: 'var(--ink-muted)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveProfile} disabled={saving || !draftName.trim()}
                  style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '10px 22px', borderRadius: 999, border: 0, color: '#fff', cursor: 'pointer',
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
