'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { A360Modal, ModalConfig, ActionConfirmBody } from '@/components/account/A360Modal'

const catIcon = (path: React.ReactNode) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round">{path}</svg>
)

const INP: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, fontFamily: 'Outfit', color: 'var(--t1)', background: 'var(--inset)', outline: 'none', boxSizing: 'border-box' }
const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 4 }

function SBtn({ children, primary, onClick }: { children: React.ReactNode; primary?: boolean; onClick: () => void }) {
  return <button className={`smodal-btn ${primary ? 'smodal-btn-primary' : 'smodal-btn-secondary'}`} onClick={onClick}>{children}</button>
}
function SRow({ label, value, valStyle }: { label: string; value: React.ReactNode; valStyle?: React.CSSProperties }) {
  return <div className="smodal-row"><label>{label}</label><span className="val" style={valStyle}>{value}</span></div>
}
function Field({ label, value, readOnly }: { label: string; value: string; readOnly?: boolean }) {
  const [v, setV] = useState(value)
  return <div><label style={LBL}>{label}</label><input value={v} readOnly={readOnly} onChange={e => setV(e.target.value)} style={readOnly ? { ...INP, color: 'var(--t3)', fontFamily: "'DM Mono',monospace", fontSize: 11 } : INP} onFocus={e => !readOnly && (e.currentTarget.style.borderColor = 'var(--o)')} onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')} /></div>
}

export function SettingsShowcase({ email }: { email: string }) {
  const [modal, setModal] = useState<ModalConfig | null>(null)
  const [theme, setTheme] = useState('light')
  const [notif, setNotif] = useState<Record<string, boolean>>({ risk: true, signal: true, weekly: true, push: true, emailDigest: false })
  const [lang, setLang] = useState('English (US)')
  const [tz, setTz] = useState('GMT+7 Jakarta')
  const router = useRouter()

  const userEmail = email && !email.includes('cdn-cgi') ? email : 'andy@popsicle-labs.app'

  function show(title: string, body: React.ReactNode, footer?: React.ReactNode) {
    setModal({ title, body, footer })
  }
  function success(title: string, desc: string) {
    setModal({ title: 'Confirmed', body: <ActionConfirmBody kind="success" title={title} desc={desc} />, footer: <SBtn primary onClick={() => setModal(null)}>Done</SBtn> })
  }
  function confirmAction(title: string, desc: string) {
    setModal({ title: 'Confirmed', body: <ActionConfirmBody kind="success" title={title} desc={desc} />, footer: <SBtn primary onClick={() => setModal(null)}>Done</SBtn> })
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ---- Modals (faithful to prototype) ----
  function smProfile() {
    show('My Profile',
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: '#FF8040', backgroundImage: 'radial-gradient(rgba(255,255,255,.15) 1px,transparent 1px),linear-gradient(140deg,#FFB347,#FF6B35)', backgroundSize: '18px 18px,100% 100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff', flexShrink: 0 }}>AG</div>
          <div><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)' }}>Andy G</div><div style={{ fontSize: 12, color: 'var(--t3)' }}>VP Sales · Popsicle Labs</div></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Full Name" value="Andy G" />
          <Field label="Job Title" value="VP of Sales" />
          <Field label="Email" value={userEmail} />
          <Field label="Company" value="Popsicle Labs" />
        </div>
      </>,
      <><SBtn onClick={() => setModal(null)}>Cancel</SBtn><SBtn primary onClick={() => success('Profile Saved', 'Your profile changes have been saved.')}>Save Changes</SBtn></>
    )
  }

  function smWorkspace() {
    show('Workspace',
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Company Name" value="Popsicle Labs" />
        <Field label="Industry" value="SaaS / Revenue Intelligence" />
        <div><label style={LBL}>Team Size</label><select style={INP} defaultValue="6-20 people"><option>1-5 people</option><option>6-20 people</option><option>21-50 people</option><option>50+</option></select></div>
        <div><label style={LBL}>Fiscal Year Start</label><select style={INP} defaultValue="January"><option>January</option><option>April</option><option>July</option><option>October</option></select></div>
        <Field label="Workspace ID" value="ws_popsicle_labs_01" readOnly />
      </div>,
      <><SBtn onClick={() => setModal(null)}>Cancel</SBtn><SBtn primary onClick={() => success('Workspace Saved', 'Workspace settings have been updated.')}>Save Changes</SBtn></>
    )
  }

  function smBilling() {
    show('Plan & Billing',
      <>
        <div style={{ padding: 16, background: 'rgba(42,157,92,.05)', border: '1px solid rgba(42,157,92,.12)', borderRadius: 12, marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ok)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Current Plan</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--ok)' }}>Enterprise</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>Unlimited integrations · Unlimited signals · Priority support</div>
        </div>
        <SRow label="Billing Cycle" value="Annual" />
        <SRow label="Next Invoice" value="Jan 1, 2027" />
        <SRow label="Payment Method" value="Visa ···· 6411" />
        <SRow label="Seats Used" value="3 / Unlimited" />
      </>,
      <><SBtn onClick={() => setModal(null)}>Close</SBtn><SBtn primary onClick={() => confirmAction('Billing Portal', 'Redirecting to billing portal. Update payment method, download invoices, or change your plan.')}>Manage Billing →</SBtn></>
    )
  }

  function smExport() {
    const row = (title: string, sub: string, action: string, icon: React.ReactNode, onClick: () => void) => (
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--inset)', borderRadius: 12, cursor: 'pointer' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round">{icon}</svg>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>{sub}</div></div>
        <span style={{ fontSize: 11, color: 'var(--o)', fontWeight: 700 }}>{action}</span>
      </div>
    )
    const dl = <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>
    show('Export Data',
      <>
        <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 20 }}>Export your pipeline data, signals, and team metrics. Enterprise plans include scheduled auto-exports.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {row('Pipeline Data (CSV)', '9 accounts · All deal stages & signals', 'Download', dl, () => success('Export Started', 'Your CSV export is being generated and will be emailed to you shortly.'))}
          {row('Full Export (JSON)', 'API-compatible dump with signal metadata', 'Download', dl, () => success('Export Started', 'Your JSON export is being generated and will be emailed to you shortly.'))}
          {row('Intelligence Report (PDF)', 'Formatted weekly analysis with charts', 'Generate', <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></>, () => success('Report Generating', 'Your intelligence report (PDF) is being generated and will be emailed to you shortly.'))}
        </div>
      </>
    )
  }

  function smDigest() {
    show('Weekly Digest Preview',
      <>
        <div style={{ background: 'linear-gradient(135deg,rgba(255,107,53,.08),rgba(255,209,102,.04))', border: '1px solid rgba(255,107,53,.15)', borderRadius: 14, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <svg width="16" height="28" viewBox="4 0 40 80" fill="none"><defs><linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#FF6B35"/><stop offset="100%" stopColor="#FFD166"/></linearGradient></defs><path d="M4 22C4 11 13 2 24 2s20 9 20 20v28c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4V22z" fill="url(#dg)"/><path d="M17 54h14v20a4 4 0 01-4 4h-6a4 4 0 01-4-4V54z" fill="#E85A25"/></svg>
            <div><div style={{ fontSize: 15, fontWeight: 900 }}>Popsicle Weekly</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>Jun 22-28, 2026</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={{ padding: 10, background: 'var(--surface)', borderRadius: 10, textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 900, color: 'var(--o)' }}>74</div><div style={{ fontSize: 9, color: 'var(--t3)' }}>Health (+6)</div></div>
            <div style={{ padding: 10, background: 'var(--surface)', borderRadius: 10, textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 900, color: 'var(--t1)' }}>47</div><div style={{ fontSize: 9, color: 'var(--t3)' }}>Signals</div></div>
            <div style={{ padding: 10, background: 'var(--surface)', borderRadius: 10, textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 900, color: 'var(--danger)' }}>3</div><div style={{ fontSize: 9, color: 'var(--t3)' }}>Critical</div></div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.6 }}><strong>Accounts That Need You:</strong> Acme Corp ($480K, 8d dark), Axion ($95K, legal stall), Meridian ($850K, Q2 slip)</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 12 }}>This preview will be sent to <strong>{userEmail}</strong> every Monday at 8:00 AM.</div>
      </>,
      <><SBtn onClick={() => setModal(null)}>Close</SBtn><SBtn primary onClick={() => success('Digest Sent', `Weekly digest sent to ${userEmail}. Next auto-send: Monday 8:00 AM.`)}>Send to Inbox</SBtn></>
    )
  }

  function smList(title: string, items: string[], current: string, setCurrent: (v: string) => void) {
    show(title,
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(item => {
          const active = item === current
          return (
            <div key={item} onClick={() => { setCurrent(item); setModal(null) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', background: active ? 'rgba(255,107,53,.06)' : 'var(--inset)', border: `1px solid ${active ? 'rgba(255,107,53,.15)' : 'var(--border)'}` }}>
              <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? 'var(--o)' : 'var(--t1)' }}>{item}</span>
              {active && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
          )
        })}
      </div>
    )
  }

  function smPassword() {
    show('Password',
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'rgba(42,157,92,.05)', border: '1px solid rgba(42,157,92,.12)', borderRadius: 12, marginBottom: 20 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ok)' }}>Password is secure</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>Last changed 30 days ago</div></div>
        </div>
        <SRow label="Current Password" value={<input type="password" value="**********" disabled style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 13, background: 'var(--inset)', color: 'var(--t1)', fontFamily: 'Outfit', width: 160, textAlign: 'right' }} />} />
        <SRow label="New Password" value={<input type="password" placeholder="Enter new password" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 13, background: 'var(--surface)', color: 'var(--t1)', fontFamily: 'Outfit', width: 160, textAlign: 'right', outline: 'none' }} />} />
      </>,
      <><SBtn onClick={() => setModal(null)}>Cancel</SBtn><SBtn primary onClick={() => success('Password Updated', 'Your password has been changed. All other sessions remain active.')}>Update Password</SBtn></>
    )
  }

  function sm2FA() {
    show('Two-Factor Authentication',
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'rgba(42,157,92,.05)', border: '1px solid rgba(42,157,92,.12)', borderRadius: 12, marginBottom: 20 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ok)' }}>2FA is Enabled ✓</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>Using Authenticator App</div></div>
        </div>
        <SRow label="Method" value="Authenticator App" />
        <SRow label="Backup Codes" value="8 remaining" valStyle={{ color: 'var(--ok)' }} />
        <SRow label="Recovery Email" value={userEmail} valStyle={{ fontSize: 11 }} />
      </>,
      <><SBtn onClick={() => setModal(null)}>Close</SBtn><SBtn primary onClick={() => success('Backup Codes Regenerated', `8 new backup codes generated and sent to ${userEmail}. Old codes are now invalid.`)}>Regenerate Codes</SBtn></>
    )
  }

  function smSessions() {
    show('Active Sessions',
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'rgba(42,157,92,.05)', border: '1px solid rgba(42,157,92,.12)', borderRadius: 12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>MacBook Pro</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>Jakarta, Indonesia · Current session</div></div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ok)' }}>Active now</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--inset)', borderRadius: 12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="2" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>iPhone 15 Pro</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>Jakarta, Indonesia · 2h ago</div></div>
          <button onClick={() => confirmAction('Session Revoked', 'iPhone 15 Pro has been signed out. That device will need to sign in again.')} style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', background: 'rgba(224,62,62,.06)', border: '1px solid rgba(224,62,62,.15)', padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit' }}>Revoke</button>
        </div>
      </div>
    )
  }

  function smAbout() {
    show('About Popsicle',
      <>
        <div style={{ textAlign: 'center', padding: '10px 0 16px' }}>
          <svg width="40" height="72" viewBox="4 0 40 80" fill="none"><defs><linearGradient id="ab" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#FF6B35"/><stop offset="100%" stopColor="#FFD166"/></linearGradient></defs><path d="M4 22C4 11 13 2 24 2s20 9 20 20v28c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4V22z" fill="url(#ab)"/><path d="M17 54h14v20a4 4 0 01-4 4h-6a4 4 0 01-4-4V54z" fill="#E85A25"/><path d="M25 16L17 34h6l-4 14 12-18h-6l4-14z" fill="#fff" fillOpacity=".95"/></svg>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.5px', marginTop: 4 }}>popsicle</div>
          <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--o)', textTransform: 'uppercase', letterSpacing: '.35em', fontFamily: 'DM Mono,monospace' }}>LABS</div>
        </div>
        <SRow label="Version" value="v1.0" valStyle={{ fontFamily: 'DM Mono,monospace' }} />
        <SRow label="Release" value="June 2026" />
        <SRow label="Platform" value="Revenue Intelligence" />
        <SRow label="Support" value={userEmail} valStyle={{ fontSize: 11, fontFamily: 'DM Mono,monospace' }} />
        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 11, color: 'var(--t3)' }}>© 2026 Popsicle Labs. All rights reserved.</div>
      </>
    )
  }

  function smWhatsNew() {
    const item = (text: string) => <div style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.5 }}><span style={{ color: 'var(--ok)', fontWeight: 800, minWidth: 32 }}>NEW</span><span>{text}</span></div>
    show("What's New",
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}><span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: 'var(--o)', padding: '3px 10px', borderRadius: 20 }}>v1.0</span><span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'DM Mono,monospace' }}>June 2026</span></div>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Launch Release</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {item('Revenue Loop - Signals to Cases to Actions to Impact')}
          {item('Ask AI - natural language revenue co-pilot')}
          {item('Account 360 with AI executive briefs')}
          {item('Interactive Forecast with scenario modelling')}
          {item('7 integrations - Gmail, Slack, WhatsApp, LinkedIn, HubSpot, Zoom, Gong')}
          {item('Dark mode + desktop & mobile apps')}
        </div>
        <div style={{ marginTop: 16, padding: 10, background: 'rgba(255,107,53,.05)', border: '1px solid rgba(255,107,53,.1)', borderRadius: 8, fontSize: 11, color: 'var(--o)', fontWeight: 600, textAlign: 'center' }}>Coming Soon: Salesforce deep integration · Custom playbooks · API access</div>
      </>
    )
  }

  const ACCOUNT = [
    { label: 'Profile', value: 'Photo, name, role ›', onClick: smProfile },
    { label: 'Workspace', value: 'Popsicle Labs ›', onClick: smWorkspace },
    { label: 'Plan & Billing', value: 'Enterprise ✓', vc: 'var(--ok)', onClick: smBilling },
    { label: 'Export Data', value: 'CSV, JSON ›', vc: 'var(--o)', onClick: smExport },
    { label: 'Weekly Digest', value: 'Preview ›', vc: 'var(--ok)', onClick: smDigest },
  ]
  const SECURITY = [
    { label: 'Password', value: 'Changed 30d ago ›', vc: 'var(--t3)', onClick: smPassword },
    { label: 'Two-Factor Auth', value: 'Enabled ✓', vc: 'var(--ok)', onClick: sm2FA },
    { label: 'Active Sessions', value: '2 devices ›', onClick: smSessions },
  ]
  const MORE = [
    { label: 'Integrations', value: '7 active →', vc: 'var(--ok)', onClick: () => router.push('/integrations') },
    { label: "What's New", badge: 'v1.0', onClick: smWhatsNew },
    { label: 'Help & Support', value: 'Chat with AI →', vc: 'var(--o)', onClick: () => window.dispatchEvent(new CustomEvent('open-ai', { detail: {} })) },
    { label: 'About', value: 'v1.0 · June 2026', vc: 'var(--t3)', onClick: smAbout },
    { label: 'Email Support', value: userEmail, vc: 'var(--t3)', mono: true, onClick: smAbout },
  ]

  return (
    <div className="dsk-screen on">
      <div className="page-hdr"><h1>Settings</h1><p>Account, preferences, and workspace configuration</p></div>

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
          <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>{userEmail}</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace", marginTop: 2 }}>v1.0 · June 2026</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>{catIcon(<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>)}<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Account</span></div>
          <div style={{ padding: '4px 20px' }}>
            {ACCOUNT.map(r => <div key={r.label} className="set-row" onClick={r.onClick}><span style={{ color: 'var(--t1)' }}>{r.label}</span><span style={{ fontWeight: r.vc ? 700 : 600, color: r.vc || undefined }}>{r.value}</span></div>)}
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
            <div className="set-row" onClick={() => smList('Language', ['English (US)', 'English (UK)', 'Bahasa Indonesia', '日本語', '中文', 'Español', 'Deutsch', 'Français', 'Português'], lang, setLang)}><span style={{ color: 'var(--t1)' }}>Language</span><span style={{ fontWeight: 600 }}>{lang} ›</span></div>
            <div className="set-row" onClick={() => smList('Timezone', ['GMT-8 Los Angeles', 'GMT-5 New York', 'GMT+0 London', 'GMT+1 Paris', 'GMT+7 Jakarta', 'GMT+8 Singapore', 'GMT+9 Tokyo', 'GMT+10 Sydney'], tz, setTz)}><span style={{ color: 'var(--t1)' }}>Timezone</span><span style={{ fontWeight: 600 }}>{tz} ›</span></div>
            <div className="set-row" onClick={() => show('Currency', <><SRow label="Current" value="Follow System" /><div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>Currency display follows your system locale settings.</div></>)}><span style={{ color: 'var(--t1)' }}>Currency</span><span style={{ fontWeight: 600 }}>Follow System</span></div>
            <div className="set-row" onClick={() => show('Display', <><SRow label="Mode" value="Compact" /><SRow label="Font Size" value="Standard" /><SRow label="Density" value="Default" /></>)}><span style={{ color: 'var(--t1)' }}>Display</span><span style={{ fontWeight: 600 }}>Compact</span></div>
          </div>
        </div>

        <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>{catIcon(<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>)}<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Security</span></div>
          <div style={{ padding: '4px 20px' }}>
            {SECURITY.map(r => <div key={r.label} className="set-row" onClick={r.onClick}><span style={{ color: 'var(--t1)' }}>{r.label}</span><span style={{ fontWeight: r.vc === 'var(--ok)' ? 700 : 600, color: r.vc || undefined }}>{r.value}</span></div>)}
          </div>
        </div>
      </div>

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

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button onClick={signOut} style={{ padding: '10px 48px', borderRadius: 10, background: 'rgba(224,62,62,.06)', border: '1px solid rgba(224,62,62,.15)', color: 'var(--danger)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Sign Out</button>
      </div>

      <A360Modal config={modal} onClose={() => setModal(null)} />
    </div>
  )
}
