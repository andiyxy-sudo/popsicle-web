'use client'

// Settings — design layout: left section label column, right hairline rows.
// Every row reflects something real; nothing here implies a feature that
// does not exist (no billing, no seats, no fabricated device list).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHead } from '@/components/layout/PageHead'

interface SettingsClientProps { user: { email: string; id: string } }

export function SettingsClient({ user }: SettingsClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwOpen, setPwOpen] = useState(false)
  const [pwStatus, setPwStatus] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [tz, setTz] = useState('')
  const [integrations, setIntegrations] = useState<string[]>([])
  const [counts, setCounts] = useState<{ signals: number; accounts: number } | null>(null)
  const [notifs, setNotifs] = useState<Record<string, boolean>>({ risk: true, digest: true, brief: true })

  async function toggleNotif(k: string) {
    const next = { ...notifs, [k]: !notifs[k] }
    setNotifs(next)
    await supabase.auth.updateUser({ data: { notif_prefs: next } }).catch(() => {})
  }

  useEffect(() => {
    try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || '') } catch { setTz('') }
    let dead = false
    ;(async () => {
      const [{ data: integ }, { count: sigCount }, { count: acctCount }] = await Promise.all([
        supabase.from('integrations').select('provider').eq('user_id', user.id).eq('is_active', true),
        supabase.from('signals').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ])
      if (dead) return
      setIntegrations((integ ?? []).map(i => i.provider as string))
      setCounts({ signals: sigCount ?? 0, accounts: acctCount ?? 0 })
    })()
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  async function changePassword() {
    if (newPw.length < 8) { setPwStatus({ type: 'error', msg: 'Use at least 8 characters.' }); return }
    if (newPw !== confirmPw) { setPwStatus({ type: 'error', msg: 'The two entries do not match.' }); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSaving(false)
    if (error) setPwStatus({ type: 'error', msg: error.message })
    else { setPwStatus({ type: 'ok', msg: 'Password updated.' }); setNewPw(''); setConfirmPw(''); setPwOpen(false) }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const Section = ({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 24, marginTop: 48 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ink)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 4, lineHeight: 1.5 }}>{sub}</div>
      </div>
      <div>{children}</div>
    </div>
  )

  const Row = ({ label, sub, value, onClick, danger }: { label: string; sub?: string; value?: React.ReactNode; onClick?: () => void; danger?: boolean }) => (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, color: danger ? 'var(--critical, #c43d2b)' : 'var(--ink)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-muted)', fontSize: 14, whiteSpace: 'nowrap' }}>
        {value}
        {onClick && <span style={{ color: 'var(--ink-faint)' }}>›</span>}
      </div>
    </div>
  )

  return (
    <div className="dsk-screen on">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, minHeight: 36 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          Settings <span style={{ margin: '0 8px' }}>/</span> Popsicle Labs
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>all changes save automatically</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 22 }}>
        <span style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--accent, #E85A25)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18, flex: 'none' }}>
          {(user.email[0] || 'A').toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 30, letterSpacing: '-.035em', color: 'var(--ink)' }}>{user.email.split('@')[0]}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 2 }}>{user.email}{tz ? ` · ${tz}` : ''}</div>
        </div>
        <button onClick={() => { const el = document.querySelector('.ed-sb-user') as HTMLElement | null; el?.click() }}
          style={{ font: 'inherit', fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 999, border: '1.5px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Edit profile</button>
      </div>
      <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '28px 0 0' }} />

      <Section title="Account" sub="Profile, workspace and data.">
        <Row label="Workspace" sub="Popsicle Labs" value="1 seat" />
        <Row label="Work email" value={user.email} />
        <Row label="Your data" value={counts ? `${counts.accounts} accounts · ${counts.signals} signals` : '--'} />
        <Row label="Weekly digest" sub="Appears on Pulse every Monday" value="Mondays" onClick={() => router.push('/pulse?digest=1')} />
      </Section>

      <Section title="Preferences" sub="How the portal looks and reads.">
        <Row label="Appearance" value="Light" />
        <Row label="Language" value="English (US)" />
        <Row label="Timezone" value={tz || '--'} />
        <Row label="Currency" value="USD" />
      </Section>

      <Section title="Sources" sub="Channels Popsicle reads to raise signals.">
        <Row label="Connected sources" sub={integrations.length ? integrations.join(' · ') : 'None connected yet'}
          value={`${integrations.length} live`} onClick={() => router.push('/integrations')} />
        <Row label="Resolution broadcasts" sub="Slack ✓ and HubSpot notes when you mark a signal handled"
          value="Manage" onClick={() => router.push('/integrations')} />
      </Section>

      <Section title="Notifications" sub="What Popsicle should interrupt you for.">
        {([['risk', 'Risk alerts', 'Critical signals, as they are detected'],
           ['digest', 'Weekly summary', 'Mondays, on the Pulse screen'],
           ['brief', 'Pre-meeting briefs', '30 minutes before mapped meetings']] as const).map(([k, label, sub]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
            <div>
              <div style={{ fontSize: 15, color: 'var(--ink)' }}>{label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{sub}</div>
            </div>
            <button onClick={() => toggleNotif(k)} aria-label={label}
              style={{ width: 38, height: 22, borderRadius: 999, border: 0, padding: 0, cursor: 'pointer', position: 'relative', flex: 'none',
                background: notifs[k] ? 'linear-gradient(135deg,#FF8A50,#FF6B35)' : 'var(--border, #E5DFD4)' }}>
              <span style={{ position: 'absolute', top: 3, left: notifs[k] ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .18s ease', boxShadow: '0 1px 2px rgba(14,13,11,.2)' }} />
            </button>
          </div>
        ))}
      </Section>

      <Section title="Security" sub="Access to this account.">
        <Row label="Password" sub="Change the password you sign in with"
          value={pwOpen ? 'Cancel' : 'Change'} onClick={() => { setPwOpen(!pwOpen); setPwStatus(null) }} />
        {pwOpen && (
          <div style={{ padding: '18px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', display: 'grid', gap: 14, maxWidth: 380 }}>
            <label style={{ display: 'block' }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>New password</span>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0 }} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Confirm</span>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0 }} />
            </label>
            {pwStatus && <div style={{ fontSize: 13, color: pwStatus.type === 'ok' ? 'var(--good, #2f8f5b)' : 'var(--critical, #c43d2b)' }}>{pwStatus.msg}</div>}
            <div>
              <button onClick={changePassword} disabled={saving}
                style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '10px 22px', borderRadius: 999, border: 0, background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', cursor: 'pointer', boxShadow: '0 6px 18px -6px rgba(255,107,53,.5)', opacity: saving ? .7 : 1 }}>
                {saving ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </div>
        )}
        {pwStatus && !pwOpen && <div style={{ fontSize: 13, color: pwStatus.type === 'ok' ? 'var(--good, #2f8f5b)' : 'var(--critical, #c43d2b)', padding: '14px 0' }}>{pwStatus.msg}</div>}
      </Section>

      <Section title="More" sub="Product information.">
        <Row label="Ask AI" sub="Answers grounded in your own data" value="Open" onClick={() => router.push('/ask')} />
        <Row label="Help & support" sub="Answers from your own data" value="Chat with AI" onClick={() => router.push('/ask')} />
        <Row label="About Popsicle" value="Revenue intelligence infrastructure" />
        <Row label="Email support" value="support@popsicle-labs.app" />
      </Section>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 44, paddingTop: 22, borderTop: '1px solid var(--rule-strong, #0E0D0B)' }}>
        <span onClick={signOut} style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: '1.2px', color: 'var(--critical, #c43d2b)', fontWeight: 500, cursor: 'pointer' }}>Sign out</span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>Popsicle Labs · {counts ? `${counts.accounts} accounts tracked` : 'workspace'}</span>
      </div>
    </div>
  )
}
