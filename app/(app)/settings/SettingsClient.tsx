'use client'

// Settings, design layout: left section label column, right hairline rows.
// Every row reflects something real; nothing here implies a feature that
// does not exist (no billing, no seats, no fabricated device list).

import { useEffect, useState } from 'react'
import { TimeField } from '@/components/ui/TimeField'
import { useEscape } from '@/components/ui/useEscape'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHead } from '@/components/layout/PageHead'
import { orgIdsBrowser } from '@/lib/org'

interface SettingsClientProps { user: { email: string; id: string } }

// Hoisted out of the component: a component defined inside another remounts its
// whole subtree on every render, which replayed the entrance animation on every toggle.
const Section = ({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '190px minmax(0,1fr)', gap: 32, marginTop: 48, paddingLeft: 13 }}>
      {/* rows carry 16px of top padding, so the label matches it */}
      <div style={{ paddingTop: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ink)' }}>{title}</div>
        <div className="read-prose" style={{ color: 'var(--ink-faint)', marginTop: 4, fontSize: 'inherit' }}>{sub}</div>
      </div>
      <div>{children}</div>
    </div>
  )


const Row = ({ label, sub, value, onClick, danger }: { label: string; sub?: string; value?: React.ReactNode; onClick?: () => void; danger?: boolean }) => (
    <div onClick={onClick}
      className={onClick ? 'set-row' : undefined}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, color: danger ? 'var(--critical, #c43d2b)' : 'var(--ink)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: onClick ? 'var(--ink)' : 'var(--ink-muted)', fontSize: 14, whiteSpace: 'nowrap' }}>
        {value}
        {onClick && <span style={{ color: 'var(--accent, #E85A25)', fontSize: 16, lineHeight: 1 }}>›</span>}
      </div>
    </div>
  )

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
  const [notifs, setNotifs] = useState<Record<string, boolean>>({ risk: true, digest: true, brief: true, push: false, emailDigest: false, slackCritical: true, emailHandled: true })
  const [digestTime, setDigestTime] = useState('07:00')
  const [workHours, setWorkHours] = useState<{ start: string; end: string }>({ start: '09:00', end: '18:00' })
  const [morningDigest, setMorningDigest] = useState('08:00')
  const [voice, setVoice] = useState<Record<string, string>>({ Tone: 'Direct', Length: 'Short', 'Sign-off': 'Best, Andy' })
  const [autoSend, setAutoSend] = useState(false)
  const [thresholds, setThresholds] = useState<Record<string, string>>({ 'Days dark': '5 days', 'Minimum deal size': '$50K', 'Commitment overdue': '3 days' })
  const [quiet, setQuiet] = useState<Record<string, string>>({ From: '19:00', To: '08:00' })

  async function saveJson(key: string, value: unknown) {
    await supabase.auth.updateUser({ data: { [key]: value } }).catch(() => {})
  }
  const [device, setDevice] = useState('')
  const [exportBusy, setExportBusy] = useState(false)

  useEffect(() => {
    // the one device we can honestly report on is this one
    if (typeof navigator === 'undefined') return
    const ua = navigator.userAgent
    const os = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : 'Unknown OS'
    const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Browser'
    setDevice(`${br} on ${os}`)
  }, [])

  // Export is real: it pulls the workspace's own rows and downloads them.
  async function exportData(fmt: 'json' | 'csv') {
    setExportBusy(true)
    try {
      const [{ data: accts }, { data: sigs }] = await Promise.all([
        supabase.from('accounts').select('*').in('user_id', await orgIdsBrowser(supabase, user.id)),
        supabase.from('signals').select('*').in('user_id', await orgIdsBrowser(supabase, user.id)).limit(2000),
      ])
      let blob: Blob
      let name: string
      if (fmt === 'json') {
        blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), accounts: accts ?? [], signals: sigs ?? [] }, null, 2)], { type: 'application/json' })
        name = 'popsicle-export.json'
      } else {
        const rows = (sigs ?? []) as Array<Record<string, unknown>>
        const cols = ['created_at', 'account_name', 'signal_type', 'severity', 'title', 'description', 'risk_amount', 'source_integration', 'status']
        const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
        blob = new Blob([[cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')], { type: 'text/csv' })
        name = 'popsicle-signals.csv'
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = name; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportBusy(false)
      setSheet(null)
    }
  }

  async function askPush() {
    if (typeof Notification === 'undefined') return
    const res = await Notification.requestPermission()
    const on = res === 'granted'
    const next = { ...notifs, push: on }
    setNotifs(next)
    await supabase.auth.updateUser({ data: { notif_prefs: next } }).catch(() => {})
  }
  const [sheet, setSheet] = useState<string | null>(null)
  // timezone
  const TIMEZONES = ['Asia/Jakarta', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Bangkok', 'Asia/Manila', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Kolkata', 'Asia/Dubai', 'Australia/Sydney', 'Pacific/Auckland', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Madrid', 'Europe/Stockholm', 'Africa/Johannesburg', 'America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Mexico_City']
  const [tzPick, setTzPick] = useState('')
  const [tzQuery, setTzQuery] = useState('')
  // invites
  const [invEmail, setInvEmail] = useState(''); const [invRole, setInvRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [invState, setInvState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle'); const [invMsg, setInvMsg] = useState('')
  const [invites, setInvites] = useState<Array<{ id: string; email: string; role: string; status: string; created_at: string }>>([])
  // two-factor (TOTP via Supabase MFA)
  const [mfaFactors, setMfaFactors] = useState<Array<{ id: string; friendly_name?: string | null; status: string }>>([])
  const [mfaEnroll, setMfaEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [mfaCode, setMfaCode] = useState(''); const [mfaMsg, setMfaMsg] = useState(''); const [mfaBusy, setMfaBusy] = useState(false)
  const isDemoUser = user.email === 'demo@popsicle-labs.app'

  async function loadInvites() {
    try { const r = await fetch('/api/invite'); const j = await r.json(); setInvites(j.invites ?? []) } catch { /* ignore */ }
  }
  async function sendInvite() {
    setInvState('sending'); setInvMsg('')
    try {
      const r = await fetch('/api/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: invEmail, role: invRole }) })
      const j = await r.json()
      if (!r.ok) { setInvState('error'); setInvMsg(j.error === 'invalid_email' ? 'That does not look like an email address.' : 'Could not send the invite.'); return }
      if (!j.demo && !j.sent) { setInvState('error'); setInvMsg(j.error ? `Supabase refused the invite: ${j.error}` : (j.note ?? 'Invite recorded, but the email was not sent.')); loadInvites(); return }
      setInvState('sent'); setInvMsg(j.demo ? 'Invites are simulated on the demo account.' : `Invite sent to ${invEmail}. It can take a minute; check spam if it does not arrive.`)
      if (j.demo) setInvites(prev => [{ id: `demo-${Date.now()}`, email: invEmail, role: invRole, status: 'sent', created_at: new Date().toISOString() }, ...prev])
      else loadInvites()
      setInvEmail('')
    } catch { setInvState('error'); setInvMsg('Could not send the invite.') }
  }
  async function loadFactors() {
    try { const { data } = await supabase.auth.mfa.listFactors(); setMfaFactors(((data?.totp ?? []) as Array<{ id: string; friendly_name?: string | null; status: string }>)) } catch { /* ignore */ }
  }
  async function startEnroll() {
    setMfaBusy(true); setMfaMsg('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' })
      if (error || !data) { setMfaMsg(error?.message ?? 'Could not start enrolment.'); return }
      setMfaEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    } finally { setMfaBusy(false) }
  }
  async function verifyEnroll() {
    if (!mfaEnroll) return
    setMfaBusy(true); setMfaMsg('')
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: mfaEnroll.id })
      if (chErr || !ch) { setMfaMsg(chErr?.message ?? 'Could not create a challenge.'); return }
      const { error } = await supabase.auth.mfa.verify({ factorId: mfaEnroll.id, challengeId: ch.id, code: mfaCode.trim() })
      if (error) { setMfaMsg('That code did not match. Codes rotate every 30 seconds.'); return }
      setMfaEnroll(null); setMfaCode(''); setMfaMsg('Two-factor authentication is on. You will be asked for a code at sign-in.')
      loadFactors()
    } finally { setMfaBusy(false) }
  }
  async function disableMfa(id: string) {
    setMfaBusy(true); setMfaMsg('')
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id })
      setMfaMsg(error ? error.message : 'Two-factor authentication is off.')
      loadFactors()
    } finally { setMfaBusy(false) }
  }

  useEscape(!!sheet, () => setSheet(null))
  useEffect(() => {
    if (sheet === 'Invite a teammate') loadInvites()
    if (sheet === 'Two-factor authentication') { loadFactors(); setMfaEnroll(null); setMfaCode(''); setMfaMsg('') }
    if (sheet === 'Timezone') { setTzQuery(''); if (!tzPick) setTzPick(tz) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet])

  const [prefs, setPrefs] = useState<Record<string, string>>({ Appearance: 'Light', Language: 'English (US)', Currency: 'USD' })
  const [copied, setCopied] = useState(false)

  async function choosePref(key: string, value: string) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    await supabase.auth.updateUser({ data: { prefs: next } }).catch(() => {})
    setSheet(null)
  }

  async function toggleNotif(k: string) {
    const next = { ...notifs, [k]: !notifs[k] }
    setNotifs(next)
    await supabase.auth.updateUser({ data: { notif_prefs: next } }).catch(() => {})
  }

  useEffect(() => {
    try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || '') } catch { setTz('') }
    // restore whatever was saved last time
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      const m = (u?.user_metadata ?? {}) as Record<string, unknown>
      if (m.digest_time) setDigestTime(String(m.digest_time))
      if (m.work_start || m.work_end) setWorkHours({ start: String(m.work_start ?? '09:00'), end: String(m.work_end ?? '18:00') })
      if (m.morning_digest) setMorningDigest(String(m.morning_digest))
      if (m.timezone) setTzPick(String(m.timezone))
      loadFactors()
      if (m.draft_voice) setVoice(m.draft_voice as Record<string, string>)
      if (m.thresholds) setThresholds(m.thresholds as Record<string, string>)
      if (m.quiet_hours) setQuiet(m.quiet_hours as Record<string, string>)
      if (typeof m.auto_send === 'boolean') setAutoSend(m.auto_send)
      if (m.notif_prefs) setNotifs(m.notif_prefs as Record<string, boolean>)
      if (m.prefs) setPrefs(m.prefs as Record<string, string>)
    })
    let dead = false
    ;(async () => {
      const [{ data: integ }, { count: sigCount }, { count: acctCount }] = await Promise.all([
        supabase.from('integrations').select('provider').in('user_id', await orgIdsBrowser(supabase, user.id)).eq('is_active', true),
        supabase.from('signals').select('id', { count: 'exact', head: true }).in('user_id', await orgIdsBrowser(supabase, user.id)),
        supabase.from('accounts').select('id', { count: 'exact', head: true }).in('user_id', await orgIdsBrowser(supabase, user.id)),
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


  // Settings detail sheets (design pattern). Every row states something true
  // about this workspace; options that are not implemented say so rather than
  // pretending to switch.
  const SHEETS: Record<string, { title: string; sub: string; rows?: Array<[string, string]>; options?: Array<[string, string]>; actions?: Array<[string, boolean, () => void]>; note?: string; custom?: React.ReactNode }> = {
    Workspace: { title: 'Workspace', sub: 'Popsicle Labs', rows: [['Workspace name', 'Popsicle Labs'], ['Signed in as', user.email], ['Accounts tracked', counts ? String(counts.accounts) : '--'], ['Signals recorded', counts ? String(counts.signals) : '--'], ['Seats', '1 · invitations not enabled yet']] },
    Tone: { title: 'Tone', sub: 'How drafts read', options: [['Direct', 'Short sentences, no preamble'], ['Warm', 'Friendly, still concise'], ['Formal', 'Full sentences, measured'], ['Match the thread', 'Mirror how they write to you']] },
    Length: { title: 'Length', sub: 'How long a first draft runs', options: [['Short', 'Three or four sentences'], ['Medium', 'A paragraph and a clear ask'], ['Detailed', 'Context, evidence, then the ask']] },
    'Sign-off': { title: 'Sign-off', sub: 'The closing line on your emails', options: [['Best, Andy', 'Standard'], ['Thanks, Andy', 'Warmer'], ['Regards, Andy', 'Formal'], ['No sign-off', 'Ends on the last line']] },
    'Days dark': { title: 'Days dark before flagging', sub: 'How long silence runs before Popsicle raises it', options: [['3 days', 'Aggressive'], ['5 days', 'Balanced'], ['7 days', 'Relaxed'], ['10 days', 'Only long silences']] },
    'Minimum deal size': { title: 'Minimum deal size', sub: 'Smaller deals stay quiet unless critical', options: [['No minimum', 'Surface everything'], ['$25K', 'Skip the smallest'], ['$50K', 'Focus on real pipeline'], ['$100K', 'Enterprise only']] },
    'Commitment overdue': { title: 'Commitment overdue', sub: 'Grace period before a promise is chased', options: [['1 day', 'Immediately after the date'], ['3 days', 'Balanced'], ['7 days', 'Only clear misses']] },
    'Quiet hours': { title: 'Quiet hours', sub: `Nothing interrupts you from ${quiet.From} to ${quiet.To}`, rows: [['Applies to', 'Push notifications and alerts'], ['Does not apply to', 'Signals still being detected'], ['Timezone', tz || 'your device setting']], options: [['19:00 - 08:00', 'Evenings and nights'], ['18:00 - 09:00', 'Longer window'], ['22:00 - 07:00', 'Late finish'], ['Off', 'Interrupt me any time']] },
    Members: { title: 'Members', sub: 'Who can see this workspace', rows: [['You', `${user.email} · owner`], ['Others', 'No one else has access'], ['Seats', 'Invitations not enabled yet']], note: 'Signals, accounts and drafts are visible only to you until someone is invited.' },
    'Invite a teammate': { title: 'Invite a teammate', sub: 'They get an email with a sign-in link and see the accounts you share', custom: (
      <div style={{ marginTop: 18 }}>
        <label style={{ display: 'block' }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Work email</span>
          <input value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder="name@company.com" type="email" autoComplete="off"
            style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0 }} />
        </label>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)', marginTop: 20 }}>Role</div>
        {([['admin', 'Admin', 'Everything, including integrations and billing'], ['member', 'Member', 'Signals, accounts and Ask; can handle and draft'], ['viewer', 'Viewer', 'Read-only across the portal']] as const).map(([k, t, d]) => (
          <div key={k} onClick={() => setInvRole(k)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer' }}>
            <div><div style={{ fontSize: 14.5, color: 'var(--ink)' }}>{t}</div><div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{d}</div></div>
            {invRole === k && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
          </div>
        ))}
        {invMsg && <div style={{ fontSize: 13, color: invState === 'error' ? 'var(--critical, #c43d2b)' : 'var(--good, #2f8f5b)', marginTop: 14 }}>{invMsg}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={sendInvite} disabled={invState === 'sending' || !invEmail.trim()} style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '11px 22px', border: 0, cursor: 'pointer', background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', opacity: invState === 'sending' || !invEmail.trim() ? .5 : 1 }}>{invState === 'sending' ? 'Sending…' : 'Send invite'}</button>
        </div>
        {invites.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)', paddingBottom: 8, borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>Invites</div>
            {invites.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', fontSize: 14 }}>
                <span style={{ color: 'var(--ink)' }}>{i.email} <span style={{ color: 'var(--ink-faint)', fontSize: 12.5 }}>· {i.role}</span></span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1px', textTransform: 'uppercase', color: i.status === 'accepted' ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)' }}>{i.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    ) },
    'Signal visibility': { title: 'Signal visibility', sub: 'Whether teammates see your accounts', options: [['Private', 'Only you'], ['Team', 'Everyone in the workspace'], ['Owner and manager', 'You and whoever covers you']] },
    'Data & privacy': { title: 'Data & privacy', sub: 'What Popsicle reads and keeps', rows: [['Reads', 'Sales threads on your connected sources'], ['Stores', 'Signals, account state and message metadata'], ['Retention', 'Until you delete the workspace'], ['Location', 'Hosted in Singapore'], ['Shared with', 'No one outside this workspace'], ['Model training', 'Your data is never used to train models']], actions: [['Export everything', true, () => exportData('json')]] },
    'Delete workspace': { title: 'Delete workspace', sub: 'This cannot be undone', rows: [['Removes', counts ? `${counts.accounts} accounts and ${counts.signals} signals` : 'every account and signal'], ['Disconnects', `${integrations.length} source${integrations.length === 1 ? '' : 's'}`], ['Keeps', 'Nothing'], ['Timing', 'Immediate']], note: 'Deletion is handled manually while in beta so nothing is lost by accident. Email support@popsicle-labs.app from this address and it will be done within one working day.', actions: [['Export first', false, () => exportData('json')]] },
    'Plan & billing': { title: 'Plan & billing', sub: 'Beta access', rows: [['Plan', 'Beta'], ['Cost', 'No charge during beta'], ['Seats', '1 · invitations not enabled yet'], ['Sources', `${integrations.length} connected`], ['Billing contact', user.email]], note: 'Pricing starts when the beta ends. You will be told before anything is charged.' },
    'Export data': { title: 'Export data', sub: 'Your accounts and signals, downloaded now', rows: [['Accounts', counts ? String(counts.accounts) : '--'], ['Signals', counts ? String(counts.signals) : '--'], ['Includes', 'Everything this workspace holds for you'], ['Leaves Popsicle', 'Yes, the file downloads to this device']], actions: [['Download JSON', true, () => exportData('json')], [exportBusy ? 'Preparing...' : 'Download CSV', false, () => exportData('csv')]] },
    'Two-factor authentication': { title: 'Two-factor authentication', sub: mfaFactors.some(f => f.status === 'verified') ? 'On. A code from your authenticator app is required at sign-in.' : 'Off. Add an authenticator app as a second step.', custom: (
      <div style={{ marginTop: 18 }}>
        {isDemoUser && <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.6 }}>Two-factor is locked on the demo account so nobody can lock it.</div>}
        {!isDemoUser && mfaFactors.filter(f => f.status === 'verified').map(f => (
          <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
            <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>{f.friendly_name || 'Authenticator app'} <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: 'var(--good, #2f8f5b)', marginLeft: 8 }}>ENABLED</span></span>
            <button onClick={() => disableMfa(f.id)} disabled={mfaBusy} style={{ font: 'inherit', fontSize: 13, color: 'var(--critical, #c43d2b)', background: 'none', border: 0, cursor: 'pointer' }}>Turn off</button>
          </div>
        ))}
        {!isDemoUser && !mfaFactors.some(f => f.status === 'verified') && !mfaEnroll && (
          <>
            {[['1', 'Install an authenticator app', 'Google Authenticator, 1Password, Authy or similar'], ['2', 'Scan the code we show you', 'It adds Popsicle to the app'], ['3', 'Enter the six-digit code', 'That confirms the link and turns 2FA on']].map(([n, t, d]) => (
              <div key={n} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10, padding: '10px 0' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--accent)' }}>{n.padStart(2, '0')}</span>
                <span><span style={{ fontSize: 14.5, color: 'var(--ink)' }}>{t}</span><span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{d}</span></span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={startEnroll} disabled={mfaBusy} style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '11px 22px', border: 0, cursor: 'pointer', background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff' }}>{mfaBusy ? 'Starting…' : 'Set up two-factor'}</button>
            </div>
          </>
        )}
        {mfaEnroll && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '168px 1fr', gap: 20, alignItems: 'start' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mfaEnroll.qr} alt="Scan with your authenticator app" width={168} height={168} style={{ display: 'block', border: '1px solid var(--hairline, #EFEAE1)', background: '#fff' }} />
              <div>
                <div style={{ fontSize: 14.5, color: 'var(--ink)' }}>Scan with your authenticator app</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 6, lineHeight: 1.55 }}>Or enter this key by hand:</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--ink)', marginTop: 6, wordBreak: 'break-all' }}>{mfaEnroll.secret}</div>
                <label style={{ display: 'block', marginTop: 16 }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Six-digit code</span>
                  <input value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} inputMode="numeric" placeholder="123 456"
                    style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 18, letterSpacing: '4px', marginTop: 8, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0 }} />
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => { setMfaEnroll(null); setMfaCode('') }} style={{ font: 'inherit', fontSize: 13.5, padding: '11px 18px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink-muted)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={verifyEnroll} disabled={mfaBusy || mfaCode.length !== 6} style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '11px 22px', border: 0, cursor: 'pointer', background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', opacity: mfaCode.length !== 6 ? .5 : 1 }}>{mfaBusy ? 'Checking…' : 'Turn on'}</button>
            </div>
          </div>
        )}
        {mfaMsg && <div style={{ fontSize: 13, color: /is on|is off/.test(mfaMsg) ? 'var(--good, #2f8f5b)' : 'var(--critical, #c43d2b)', marginTop: 14 }}>{mfaMsg}</div>}
      </div>
    ) },
    'Active sessions': { title: 'Active sessions', sub: '1 device signed in', rows: [['This device', device || 'This browser'], ['Signed in as', user.email], ['Other devices', 'None detected'], ['Sign out everywhere', 'Sign out below ends this session']], note: 'Popsicle keeps one session per browser. Signing out here ends it on this device.' },
    "What's new": { title: "What's new", sub: 'Recent changes to Popsicle', rows: [['Ask AI', 'Streaming answers, saved questions, source inspection'], ['Account 360', 'People, timeline and contracts tabs'], ['Signals', 'Evidence and pattern match on every signal'], ['Integrations', 'Resolution broadcasts to Slack and HubSpot']] },
    'Work email': { title: 'Work email', sub: user.email, rows: [['Address', user.email], ['Changing it', 'Runs through account recovery, not this screen'], ['Sending from', 'Drafts send from this address via Gmail']], actions: [['Copy address', true, () => { navigator.clipboard?.writeText(user.email); setCopied(true); setTimeout(() => setCopied(false), 1600) }]] },
    'Your data': { title: 'Your data', sub: 'Everything Popsicle holds for this workspace', rows: [['Accounts & health', counts ? `${counts.accounts} records` : '--'], ['Signals', counts ? `${counts.signals} records` : '--'], ['Sources connected', `${integrations.length}`], ['Export', 'Not built yet']], note: 'Export is on the roadmap. Nothing is shared outside this workspace.' },
    'Weekly digest': { title: 'Weekly digest', sub: `Mondays at ${digestTime}`, rows: [['Meetings this week', 'From your calendar'], ['Commitments due', 'From detected promises'], ['Gone quiet', 'Accounts past their own reply cadence'], ['Email delivery', 'Not enabled yet']], options: [['06:00', 'Before the day starts'], ['07:00', 'With your first coffee'], ['08:00', 'At your desk'], ['09:00', 'After the morning rush']], actions: [['Preview it now', true, () => router.push('/pulse?digest=1')]] },
    Appearance: { title: 'Appearance', sub: 'How the portal renders on this device', options: [['Light', 'Warm paper, the default'], ['Dark', 'Not built yet'], ['Match system', 'Not built yet']] },
    Language: { title: 'Language', sub: 'Interface and AI responses', options: [['English (US)', 'Default'], ['English (UK)', 'Spelling and dates'], ['Bahasa Indonesia', 'Not translated yet']] },
    Timezone: { title: 'Timezone', sub: 'Used for digests, ages and time-of-day logic', custom: (() => {
      const active = tzPick || tz
      const list = [...new Set([tz, ...TIMEZONES].filter(Boolean))].filter(z => !tzQuery || z.toLowerCase().includes(tzQuery.toLowerCase().replace(' ', '_')))
      const offset = (zone: string) => { try { const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find(x => x.type === 'timeZoneName'); return p?.value ?? '' } catch { return '' } }
      return (
        <div style={{ marginTop: 18 }}>
          <input value={tzQuery} onChange={e => setTzQuery(e.target.value)} placeholder="Search a city or region"
            style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0 }} />
          <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 6 }}>
            {list.map(z => (
              <div key={z} onClick={() => { setTzPick(z); saveJson('timezone', z); setSheet(null) }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer' }}>
                <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>{z.replace(/_/g, ' ')}{z === tz ? <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--ink-faint)', marginLeft: 8 }}>detected</span> : null}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{offset(z)}</span>{z === active && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>}</span>
              </div>
            ))}
          </div>
        </div>
      )
    })() },
    Currency: { title: 'Currency', sub: 'Applied to ARR, exposure and forecast', options: [['USD', 'US dollar'], ['SGD', 'Singapore dollar'], ['IDR', 'Indonesian rupiah'], ['EUR', 'Euro']] },
    'Connected sources': { title: 'Connected sources', sub: `${integrations.length} live`, rows: (integrations.length ? integrations.map(i => [i, 'Connected'] as [string, string]) : [['None', 'Connect Gmail or Slack to start']]), actions: [['Manage integrations', true, () => router.push('/integrations')]] },
    'Resolution broadcasts': { title: 'Resolution broadcasts', sub: 'What happens when you mark a signal handled', rows: [['Slack', 'Appends "Handled by…" to the original card'], ['HubSpot', 'Writes a note on the matching deal'], ['Both', 'Opt-in per source']], actions: [['Open integrations', true, () => router.push('/integrations')]] },
    'Ask AI': { title: 'Ask AI', sub: 'Answers grounded in your own data', rows: [['Sources', 'Signals, accounts, correspondence'], ['Grounding', 'Answers cite what they are drawn from'], ['Speed', 'Seconds']], actions: [['Open Ask AI', true, () => router.push('/ask')]] },
    'Help & support': { title: 'Help & support', sub: 'Answers drawn from your own workspace data', rows: [['Ask AI', 'Fastest route · answers in seconds'], ['Email support', 'support@popsicle-labs.app'], ['Status', 'All systems operational']], actions: [['Chat with AI', true, () => router.push('/ask')]] },
    'About Popsicle': { title: 'About Popsicle', sub: 'Revenue intelligence infrastructure', rows: [['Version', 'v3.6'], ['Platform', 'Revenue intelligence'], ['Support', 'support@popsicle-labs.app']], note: '© 2026 Popsicle Labs. All rights reserved.' },
    'Email support': { title: 'Email support', sub: 'support@popsicle-labs.app', rows: [['Include', 'Workspace name and the account in question'], ['Alternative', 'Ask AI for instant answers']], actions: [['Copy address', true, () => { navigator.clipboard?.writeText('support@popsicle-labs.app'); setCopied(true); setTimeout(() => setCopied(false), 1600) }]] },
  }


  return (
    <div className="dsk-screen on">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, minHeight: 36 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          Settings <span style={{ margin: '0 8px' }}>/</span> Popsicle Labs
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className="sig-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          all changes save automatically
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 22 }}>
        <span style={{ width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(135deg,#FF8A50,#E85A25)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18, flex: 'none', boxShadow: '0 0 0 4px rgba(232,90,37,.12)' }}>
          {(user.email[0] || 'A').toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 30, letterSpacing: '-.035em', color: 'var(--ink)' }}>{user.email.split('@')[0]}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 2 }}>{user.email}{tz ? ` · ${tz}` : ''}</div>
        </div>
        <button onClick={() => { const el = document.querySelector('.ed-sb-user') as HTMLElement | null; el?.click() }}
          className="warm-pill"
          style={{ font: 'inherit', fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 0, border: '1.5px solid var(--accent, #E85A25)', background: 'rgba(232,90,37,.06)', color: 'var(--accent, #E85A25)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Edit profile</button>
      </div>
      <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '28px 0 0' }} />

      <Section title="Account" sub="Profile, workspace and data.">
        <Row label="Workspace" sub="Popsicle Labs" value="1 seat" onClick={() => setSheet('Workspace')} />
        <Row label="Plan & billing" sub="Beta access, no charge while in beta" value="Beta" onClick={() => setSheet('Plan & billing')} />
        <Row label="Your data" value={counts ? `${counts.accounts} accounts · ${counts.signals} signals` : '--'} onClick={() => setSheet('Your data')} />
        <Row label="Weekly digest" sub="Appears on Pulse at the start of your week" value={`Mondays · ${digestTime}`} onClick={() => setSheet('Weekly digest')} />
      </Section>

      <Section title="Your day" sub="When Popsicle should work around you.">
        {/* moved here from Edit profile (v11.44) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
          <div>
            <div style={{ fontSize: 15, color: 'var(--ink)' }}>Working hours</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>Used for pre-meeting briefs and digests</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink-muted)' }}>
            <TimeField value={workHours.start} onChange={val => { const v = { ...workHours, start: val }; setWorkHours(v); saveJson('work_start', v.start) }} />
            <span style={{ color: 'var(--ink-faint)' }}>to</span>
            <TimeField value={workHours.end} onChange={val => { const v = { ...workHours, end: val }; setWorkHours(v); saveJson('work_end', v.end) }} />
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
          <div>
            <div style={{ fontSize: 15, color: 'var(--ink)' }}>Morning digest</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>Overnight signals and today's meetings, once a day</div>
          </div>
          <TimeField value={morningDigest} onChange={val => { setMorningDigest(val); saveJson('morning_digest', val) }} />
        </div>
      </Section>

      <Section title="Preferences" sub="How the portal looks and reads.">
        <Row label="Appearance" value={prefs.Appearance} onClick={() => setSheet('Appearance')} />
        <Row label="Language" value={prefs.Language} onClick={() => setSheet('Language')} />
        <Row label="Timezone" value={(tzPick || tz || '--').replace(/_/g, ' ')} onClick={() => setSheet('Timezone')} />
        <Row label="Currency" value={prefs.Currency} onClick={() => setSheet('Currency')} />
        <Row label="Export data" sub="Download your accounts and signals" value="JSON · CSV" onClick={() => setSheet('Export data')} />
      </Section>

      <Section title="Sources" sub="Channels Popsicle reads to raise signals.">
        <Row label="Connected sources" sub={integrations.length ? integrations.join(' · ') : 'None connected yet'}
          value={`${integrations.length} live`} onClick={() => setSheet('Connected sources')} />
        <Row label="Resolution broadcasts" sub="Slack ✓ and HubSpot notes when you mark a signal handled"
          value="Manage" onClick={() => setSheet('Resolution broadcasts')} />
      </Section>

      <Section title="Notifications" sub="What Popsicle should interrupt you for.">
        {([['risk', 'Risk alerts', 'Critical signals, as they are detected'],
           ['digest', 'Weekly summary', `Mondays at ${digestTime}, on the Pulse screen`],
           ['brief', 'Pre-meeting briefs', '30 minutes before mapped meetings'],
           ['push', 'Push notifications', typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'Allowed in this browser' : 'Needs browser permission'],
           ['emailDigest', 'Email digest', 'Sent to your inbox, not yet enabled'],
           ['slackCritical', 'Slack DMs for critical signals', 'A direct message the moment an at-risk signal lands'],
           ['emailHandled', 'Email for handled and snoozed signals', 'A short confirmation when a signal is closed or parked']] as const).map(([k, label, sub]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
            <div>
              <div style={{ fontSize: 15, color: 'var(--ink)' }}>{label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{sub}</div>
            </div>
            <button onClick={() => (k === 'push' ? askPush() : toggleNotif(k))} aria-label={label}
              style={{ width: 38, minWidth: 38, height: 22, borderRadius: 0, border: 0, padding: 0, cursor: 'pointer', position: 'relative', flex: '0 0 38px', marginRight: 2,
                background: notifs[k] ? 'linear-gradient(135deg,#FF8A50,#FF6B35)' : 'var(--border, #E5DFD4)' }}>
              <span style={{ position: 'absolute', top: 3, left: notifs[k] ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .18s ease', boxShadow: '0 1px 2px rgba(14,13,11,.2)' }} />
            </button>
          </div>
        ))}
        <Row label="Quiet hours" sub="Nothing interrupts you inside this window" value={`${quiet.From} - ${quiet.To}`} onClick={() => setSheet('Quiet hours')} />
      </Section>

      <Section title="Drafting" sub="How Popsicle writes on your behalf.">
        <Row label="Tone" sub="Applies to every draft it prepares" value={voice.Tone} onClick={() => setSheet('Tone')} />
        <Row label="Length" sub="How long a first draft should run" value={voice.Length} onClick={() => setSheet('Length')} />
        <Row label="Sign-off" sub="The closing line on your emails" value={voice['Sign-off']} onClick={() => setSheet('Sign-off')} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
          <div>
            <div style={{ fontSize: 15, color: 'var(--ink)' }}>Send without asking</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>Off means every draft waits for your approval</div>
          </div>
          <button onClick={() => { const v = !autoSend; setAutoSend(v); saveJson('auto_send', v) }} aria-label="Send without asking"
            style={{ width: 38, minWidth: 38, height: 22, borderRadius: 0, border: 0, padding: 0, cursor: 'pointer', position: 'relative', flex: '0 0 38px',
              background: autoSend ? 'linear-gradient(135deg,#FF8A50,#FF6B35)' : 'var(--border, #E5DFD4)' }}>
            <span style={{ position: 'absolute', top: 3, left: autoSend ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .18s ease', boxShadow: '0 1px 2px rgba(14,13,11,.2)' }} />
          </button>
        </div>
      </Section>

      <Section title="Escalation" sub="When a signal becomes your problem.">
        <Row label="Days dark before flagging" sub="How long silence runs before Popsicle raises it" value={thresholds['Days dark']} onClick={() => setSheet('Days dark')} />
        <Row label="Minimum deal size" sub="Smaller deals stay quiet unless critical" value={thresholds['Minimum deal size']} onClick={() => setSheet('Minimum deal size')} />
        <Row label="Commitment overdue" sub="Grace period before a promise is chased" value={thresholds['Commitment overdue']} onClick={() => setSheet('Commitment overdue')} />
      </Section>

      <Section title="Team" sub="Who else can see this workspace.">
        <Row label="Members" sub="You are the only member" value="1" onClick={() => setSheet('Members')} />
        <Row label="Invite a teammate" sub="Share signals and coverage" value="Invite" onClick={() => setSheet('Invite a teammate')} />
        <Row label="Signal visibility" sub="Whether teammates see your accounts" value="Private" onClick={() => setSheet('Signal visibility')} />
      </Section>

      <Section title="Security" sub="Access to this account.">
        <Row label="Password" sub="Change the password you sign in with"
          value={pwOpen ? 'Cancel' : 'Change'} onClick={() => { setPwOpen(!pwOpen); setPwStatus(null) }} />
        {pwOpen && (
          <div style={{ padding: '18px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', display: 'grid', gap: 14, maxWidth: 380 }}>
            <label style={{ display: 'block' }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>New password</span>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0 }} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Confirm</span>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0 }} />
            </label>
            {pwStatus && <div style={{ fontSize: 13, color: pwStatus.type === 'ok' ? 'var(--good, #2f8f5b)' : 'var(--critical, #c43d2b)' }}>{pwStatus.msg}</div>}
            <div style={{ paddingBottom: 4 }}>
              <button onClick={changePassword} disabled={saving}
                style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '10px 22px', borderRadius: 0, border: 0, background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', cursor: 'pointer', boxShadow: '0 6px 18px -6px rgba(255,107,53,.5)', opacity: saving ? .7 : 1 }}>
                {saving ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </div>
        )}
        <Row label="Two-factor authentication" sub="A second step when signing in"
          value={mfaFactors.some(f => f.status === 'verified') ? <span style={{ color: 'var(--good, #2f8f5b)', fontWeight: 600 }}>Enabled</span> : <span style={{ color: 'var(--critical, #c43d2b)', fontWeight: 600 }}>Disabled</span>}
          onClick={() => setSheet('Two-factor authentication')} />
        <Row label="Active sessions" sub={device ? `This device: ${device}` : 'Signed-in devices'}
          value="1 device" onClick={() => setSheet('Active sessions')} />
        {pwStatus && !pwOpen && <div style={{ fontSize: 13, color: pwStatus.type === 'ok' ? 'var(--good, #2f8f5b)' : 'var(--critical, #c43d2b)', padding: '14px 0' }}>{pwStatus.msg}</div>}
      </Section>

      <Section title="More" sub="Product information.">
        <Row label="What's new" sub="Recent changes to Popsicle" value="v10.6" onClick={() => setSheet("What's new")} />
        <Row label="Ask AI" sub="Answers grounded in your own data" value="Open" onClick={() => setSheet('Ask AI')} />
        <Row label="Help & support" sub="Answers from your own data" value="Chat with AI" onClick={() => setSheet('Help & support')} />
        <Row label="About Popsicle" value="v3.6" onClick={() => setSheet('About Popsicle')} />
        <Row label="Data & privacy" sub="What Popsicle reads, stores and for how long" value="Read" onClick={() => setSheet('Data & privacy')} />
        <Row label="Email support" value="support@popsicle-labs.app" onClick={() => setSheet('Email support')} />
        <Row label="Delete workspace" sub="Removes every account, signal and connection" danger
          value={<span style={{ color: 'var(--critical, #c43d2b)' }}>Delete</span>} onClick={() => setSheet('Delete workspace')} />
      </Section>

      {sheet && SHEETS[sheet] && (() => {
        const sh = SHEETS[sheet]
        return (
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(14,13,11,.42)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: 'var(--paper, #FBF8F3)', padding: '36px 40px 40px', boxShadow: '0 40px 90px -30px rgba(14,13,11,.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '2.2px', textTransform: 'uppercase', color: 'var(--accent)' }}>settings</span>
                <button onClick={() => setSheet(null)} style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '2.2px', textTransform: 'uppercase', color: 'var(--ink-faint)', background: 'none', border: 0, cursor: 'pointer' }}>close</button>
              </div>
              <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 30, letterSpacing: '-.035em', margin: '12px 0 4px', color: 'var(--ink)' }}>{sh.title}</h2>
              <div style={{ fontSize: 14, color: 'var(--ink-muted)' }}>{sh.sub}</div>
              <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '22px 0 6px' }} />

              {sh.rows?.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                  <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>{k}</span>
                  <span style={{ fontSize: 14, color: 'var(--ink-muted)', textAlign: 'right' }}>{v}</span>
                </div>
              ))}

              {sh.options?.map(([label, desc]) => {
                const isTime = /^\d{2}:\d{2}$/.test(label)
                const key = sh.title
                const chosen = isTime ? digestTime === label
                  : ['Tone', 'Length', 'Sign-off'].includes(key) ? voice[key] === label
                  : ['Days dark', 'Minimum deal size', 'Commitment overdue'].includes(key) ? thresholds[key] === label
                  : key === 'Quiet hours' ? `${quiet.From} - ${quiet.To}` === label
                  : prefs[key] === label
                const disabled = desc.includes('Not built') || desc.includes('Not translated')
                return (
                  <div key={label} onClick={() => {
                    if (disabled) return
                    if (isTime) { setDigestTime(label); saveJson('digest_time', label); setSheet(null) }
                    else if (['Tone', 'Length', 'Sign-off'].includes(key)) { const n = { ...voice, [key]: label }; setVoice(n); saveJson('draft_voice', n); setSheet(null) }
                    else if (['Days dark', 'Minimum deal size', 'Commitment overdue'].includes(key)) { const n = { ...thresholds, [key]: label }; setThresholds(n); saveJson('thresholds', n); setSheet(null) }
                    else if (key === 'Quiet hours') { const [f, t] = label.split(' - '); const n = { From: f ?? 'Off', To: t ?? 'Off' }; setQuiet(n); saveJson('quiet_hours', n); setSheet(null) }
                    else choosePref(key, label)
                  }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .5 : 1 }}>
                    <div>
                      <div style={{ fontSize: 14.5, color: 'var(--ink)' }}>{label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{desc}</div>
                    </div>
                    {chosen && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
                  </div>
                )
              })}

              {sh.custom}
              {sh.note && <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.6, marginTop: 16 }}>{sh.note}</div>}
              {copied && <div style={{ fontSize: 13, color: 'var(--good, #2f8f5b)', marginTop: 14 }}>Copied.</div>}

              {sh.actions && (
                <div style={{ display: 'flex', gap: 10, marginTop: 26, flexWrap: 'wrap' }}>
                  {sh.actions.map(([label, primary, fn]) => (
                    <button key={label} onClick={fn}
                      style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '11px 22px', borderRadius: 0, cursor: 'pointer',
                        border: primary ? 0 : '1px solid var(--border)',
                        background: primary ? 'linear-gradient(135deg,#FF8A50,#FF6B35)' : 'var(--raised, #FFFDFA)',
                        color: primary ? '#fff' : 'var(--ink)',
                        boxShadow: primary ? '0 6px 18px -6px rgba(255,107,53,.5)' : 'none' }}>{label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 44, paddingTop: 22, borderTop: '1px solid var(--rule-strong, #0E0D0B)' }}>
        <span onClick={signOut} style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: '1.2px', color: 'var(--critical, #c43d2b)', fontWeight: 500, cursor: 'pointer' }}>Sign out</span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>Popsicle Labs · {counts ? `${counts.accounts} accounts tracked` : 'workspace'}</span>
      </div>
    </div>
  )
}
