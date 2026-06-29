'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { A360Modal, ModalBtn, ModalConfig } from '@/components/account/A360Modal'

const catIcon = (path: React.ReactNode) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round">{path}</svg>
)

// A small key/value row used inside settings modals
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <span style={{ fontSize: 12, color: 'var(--t3)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{value}</span>
    </div>
  )
}

export function SettingsShowcase({ email }: { email: string }) {
  const [modal, setModal] = useState<ModalConfig | null>(null)
  const [theme, setTheme] = useState('light')
  const [notif, setNotif] = useState<Record<string, boolean>>({ risk: true, signal: true, weekly: true, push: true, emailDigest: false })
  const router = useRouter()

  const display = email && !email.includes('cdn-cgi') ? email : 'andy@popsicle-labs.app'

  function open(title: string, body: React.ReactNode, footer?: React.ReactNode) {
    setModal({ title, body, footer: footer ?? <ModalBtn primary onClick={() => setModal(null)}>Done</ModalBtn> })
  }
  function note(text: string) {
    return <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 10, lineHeight: 1.6 }}>{text}</div>
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const ACCOUNT = [
    { label: 'Profile', value: 'Photo, name, role ›', onClick: () => open('Profile', <><Row label="Name" value="Andy G" /><Row label="Role" value="VP of Sales" /><Row label="Email" value={display} />{note('Update your profile photo, display name, and role from here.')}</>) },
    { label: 'Workspace', value: 'Popsicle Labs ›', onClick: () => open('Workspace', <><Row label="Workspace" value="Popsicle Labs" /><Row label="Members" value="3 seats" /><Row label="Plan" value="Enterprise" />{note('Manage workspace name, members, and seat allocation.')}</>) },
    { label: 'Plan & Billing', value: 'Enterprise ✓', vc: 'var(--ok)', onClick: () => open('Plan & Billing', <><Row label="Current plan" value="Enterprise" /><Row label="Billing cycle" value="Annual" /><Row label="Next invoice" value="Jan 1, 2027" />{note('Enterprise plan includes unlimited signals, all integrations, and a dedicated CSM.')}</>) },
    { label: 'Export Data', value: 'CSV, JSON ›', vc: 'var(--o)', onClick: () => open('Export Data', <><Row label="Accounts" value="CSV / JSON" /><Row label="Signals" value="CSV / JSON" /><Row label="Activity log" value="CSV" />{note('Exports are generated on demand and emailed to you when ready.')}</>) },
    { label: 'Weekly Digest', value: 'Preview ›', vc: 'var(--ok)', onClick: () => open('Weekly Digest', <>{note('Your weekly digest summarises new signals, account movements, and recommended actions every Monday at 8AM.')}<Row label="Delivery" value="Mondays · 8AM" /><Row label="Format" value="Email" /></>) },
  ]

  const SECURITY = [
    { label: 'Password', value: 'Changed 30d ago ›', vc: 'var(--t3)', onClick: () => open('Password', <>{note('Your password was last changed 30 days ago. We recommend rotating it every 90 days.')}<Row label="Last changed" value="30 days ago" /><Row label="Strength" value="Strong" /></>) },
    { label: 'Two-Factor Auth', value: 'Enabled ✓', vc: 'var(--ok)', onClick: () => open('Two-Factor Auth', <><Row label="Status" value="Enabled" /><Row label="Method" value="Authenticator app" />{note('Two-factor authentication adds an extra layer of security to your account.')}</>) },
    { label: 'Active Sessions', value: '2 devices ›', onClick: () => open('Active Sessions', <><Row label="MacBook Pro · Jakarta" value="Active now" /><Row label="iPhone 15 · Jakarta" value="2h ago" />{note('You are signed in on 2 devices. Sign out remotely from any device you do not recognise.')}</>) },
  ]

  const MORE = [
    { label: 'Integrations', value: '7 active →', vc: 'var(--ok)', bold: true, onClick: () => router.push('/integrations') },
    { label: "What's New", badge: 'v1.0', bold: true, onClick: () => open("What's New", <>{note('Popsicle v1.0 (May 2026): Revenue Loop, AI Response Kits, multi-channel signal monitoring across 7 integrations, and the Ask Popsicle co-pilot.')}</>) },
    { label: 'Help & Support', value: 'Chat with AI →', vc: 'var(--o)', bold: true, onClick: () => window.dispatchEvent(new CustomEvent('open-ai', { detail: {} })) },
    { label: 'About', value: 'v1.0 · May 2026', vc: 'var(--t3)', bold: true, onClick: () => open('About', <><Row label="Version" value="1.0" /><Row label="Released" value="May 2026" /><Row label="Build" value="popsicle-web" />{note('Popsicle Labs · Business Signal Infrastructure for revenue teams.')}</>) },
    { label: 'Email Support', value: 'info@popsicle-labs.app', vc: 'var(--t3)', mono: true, bold: true, onClick: () => open('Email Support', <>{note('Reach our team at info@popsicle-labs.app. Enterprise customers get priority response within 4 hours.')}</>) },
  ]

  return (
    <div className="dsk-screen on">
      <div className="page-hdr"><h1>Settings</h1><p>Account, preferences, and workspace configuration</p></div>

      {/* Profile Hero */}
      <div className="dcard" style={{ marginBottom: 20, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20, background: 'linear-gradient(135deg,rgba(255,107,53,.06),rgba(255,209,102,.03))', borderColor: 'rgba(255,107,53,.12)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#FF9050,#FF6B35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', boxShadow: '0 4px 14px rgba(255,107,53,.22)', flexShrink: 0 }}>AG</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-.3px', marginBottom: 2 }}>Andy G</div>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>VP of Sales · Popsicle Labs</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ok)', background: 'rgba(42,157,92,.08)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(42,157,92,.15)' }}>Enterprise</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--o)', background: 'rgba(255,107,53,.08)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,107,53,.15)' }}>9 deals active</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', background: 'rgba(59,111,222,.08)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(59,111,222,.15)' }}>7 integrations</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>{display}</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace", marginTop: 2 }}>v1.0 · May 2026</div>
        </div>
      </div>

      {/* 3-col grid: Account / Preferences / Security */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>{catIcon(<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>)}<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Account</span></div>
          <div style={{ padding: '4px 20px' }}>
            {ACCOUNT.map(r => (
              <div key={r.label} className="set-row" onClick={r.onClick}><span style={{ color: 'var(--t1)' }}>{r.label}</span><span style={{ fontWeight: r.vc ? 700 : 600, color: r.vc || undefined }}>{r.value}</span></div>
            ))}
          </div>
        </div>

        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>{catIcon(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4"/></>)}<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Preferences</span></div>
          <div style={{ padding: '4px 20px' }}>
            <div className="set-row" style={{ padding: '11px 20px', alignItems: 'center', margin: '0 -20px' }}>
              <span style={{ fontSize: 13, color: 'var(--t1)' }}>Appearance</span>
              <div style={{ display: 'flex', gap: 5 }}>
                {[
                  { k: 'light', label: 'Light', icon: <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></> },
                  { k: 'dark', label: 'Dark', icon: <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/> },
                  { k: 'system', label: 'System', icon: <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></> },
                ].map(t => (
                  <button key={t.k} onClick={() => setTheme(t.k)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 10, border: `1.5px solid ${theme === t.k ? 'var(--o)' : 'var(--border)'}`, background: theme === t.k ? 'rgba(255,107,53,.08)' : 'var(--inset)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit', color: theme === t.k ? 'var(--o)' : 'var(--t2)', transition: 'all .15s', minWidth: 60 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{t.icon}</svg>{t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="set-row" onClick={() => open('Language', <><Row label="Current" value="English (US)" />{note('More languages are coming soon.')}</>)}><span style={{ color: 'var(--t1)' }}>Language</span><span style={{ fontWeight: 600 }}>English (US) ›</span></div>
            <div className="set-row" onClick={() => open('Timezone', <><Row label="Current" value="GMT+7 Jakarta" />{note('Signal timestamps and digests use your selected timezone.')}</>)}><span style={{ color: 'var(--t1)' }}>Timezone</span><span style={{ fontWeight: 600 }}>GMT+7 Jakarta ›</span></div>
            <div className="set-row" onClick={() => open('Currency', <><Row label="Current" value="Follow System" />{note('Currency display follows your system locale settings.')}</>)}><span style={{ color: 'var(--t1)' }}>Currency</span><span style={{ fontWeight: 600 }}>Follow System</span></div>
            <div className="set-row" onClick={() => open('Display', <><Row label="Mode" value="Compact" /><Row label="Font Size" value="Standard" /><Row label="Density" value="Default" /></>)}><span style={{ color: 'var(--t1)' }}>Display</span><span style={{ fontWeight: 600 }}>Compact</span></div>
          </div>
        </div>

        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>{catIcon(<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>)}<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Security</span></div>
          <div style={{ padding: '4px 20px' }}>
            {SECURITY.map(r => (
              <div key={r.label} className="set-row" onClick={r.onClick}><span style={{ color: 'var(--t1)' }}>{r.label}</span><span style={{ fontWeight: r.vc === 'var(--ok)' ? 700 : 600, color: r.vc || undefined }}>{r.value}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications + More */}
      <div className="two-col" style={{ alignItems: 'stretch' }}>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>{catIcon(<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>)}<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Notifications</span></div>
          <div style={{ padding: '4px 20px', flex: 1 }}>
            {[['risk', 'Risk Alerts'], ['signal', 'Signal Digest'], ['weekly', 'Weekly Summary'], ['push', 'Push Notifications'], ['emailDigest', 'Email Digest']].map(([k, label]) => (
              <div key={k} className="set-row" onClick={() => setNotif(n => ({ ...n, [k]: !n[k] }))}><span>{label}</span><div className={`dm-toggle${notif[k] ? ' on' : ''}`} style={{ width: 36, height: 20, borderRadius: 10, pointerEvents: 'none' }}></div></div>
            ))}
          </div>
        </div>

        <div className="dcard" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>{catIcon(<><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>)}<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>More</span></div>
          <div style={{ padding: '4px 20px', flex: 1 }}>
            {MORE.map(r => (
              <div key={r.label} className="set-row" onClick={r.onClick}>
                <span style={{ fontWeight: 600 }}>{r.label}</span>
                {r.badge ? <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--o)', padding: '2px 8px', borderRadius: 20 }}>{r.badge}</span>
                  : <span style={{ fontWeight: r.vc === 'var(--ok)' ? 700 : 600, color: r.vc || undefined, fontFamily: r.mono ? "'DM Mono',monospace" : undefined, fontSize: r.mono ? 11 : undefined }}>{r.value}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button onClick={signOut} style={{ padding: '10px 48px', borderRadius: 10, background: 'rgba(224,62,62,.06)', border: '1px solid rgba(224,62,62,.15)', color: 'var(--danger)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Sign Out</button>
      </div>

      <A360Modal config={modal} onClose={() => setModal(null)} />
    </div>
  )
}
