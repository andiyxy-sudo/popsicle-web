'use client'

// Settings, design layout: left section label column, right hairline rows.
// Every row reflects something real; nothing here implies a feature that
// does not exist (no billing, no seats, no fabricated device list).

import { useEffect, useState } from 'react'
import { TimeField } from '@/components/ui/TimeField'
import { useEscape } from '@/components/ui/useEscape'
import { agentPopupsOn, setAgentPopups } from '@/lib/agent/prefs'
import { AGENT_ENABLED, AGENT_NAME } from '@/lib/agent/config'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHead } from '@/components/layout/PageHead'
import { orgIdsBrowser } from '@/lib/org'
import { APP_VERSION } from '@/lib/version'
import { CURRENCIES } from '@/lib/currency'
import { applyTheme } from '@/lib/theme'
import { track } from '@/lib/analytics'

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
  const [agentOn, setAgentOn] = useState(true)
  useEffect(() => { setAgentOn(agentPopupsOn()) }, [])
  const [voice, setVoice] = useState<Record<string, string>>({ Tone: 'Direct', Length: 'Short', 'Sign-off': 'Best, Andy' })
  const [autoSend, setAutoSend] = useState(false)
  const [sendMode, setSendMode] = useState<'with' | 'without'>('with')
  const [industry, setIndustry] = useState('')
  const [easyRead, setEasyRead] = useState(() => { try { return typeof window !== 'undefined' && localStorage.getItem('easyread') === '1' } catch { return false } })
  const INDUSTRIES = ['Software & SaaS', 'Financial services', 'Healthcare & life sciences', 'Manufacturing', 'Retail & e-commerce', 'Logistics & supply chain', 'Real estate', 'Professional services', 'Media & advertising', 'Telecommunications', 'Education', 'Hospitality & travel', 'Energy & utilities', 'Public sector', 'Other']
  const [sendRules, setSendRules] = useState<{ kinds: string[]; neverExecs: boolean; neverCritical: boolean; maxDeal: string; hold: string; notify: string }>(
    { kinds: ['Follow-ups on existing threads', 'Rebooking cancelled meetings'], neverExecs: true, neverCritical: true, maxDeal: '$100K', hold: '30 minutes', notify: 'Every time' })
  const [thresholds, setThresholds] = useState<Record<string, string>>({ 'Days dark': '5 days', 'Minimum deal size': '$50K', 'Commitment overdue': '3 days' })
  const [quiet, setQuiet] = useState<Record<string, string>>({ From: '19:00', To: '08:00' })
  const [customQuiet, setCustomQuiet] = useState<Record<string, string>>({ From: '20:00', To: '07:00' })

  async function saveJson(key: string, value: unknown) {
    track('setting_changed', { setting: key })
    await supabase.auth.updateUser({ data: { [key]: value } }).catch(() => {})
    window.dispatchEvent(new Event('settings:changed'))
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
  const [delText, setDelText] = useState(''), [delBusy, setDelBusy] = useState(false), [delMsg, setDelMsg] = useState('')
  async function deleteWorkspace() {
    setDelBusy(true); setDelMsg('')
    const r = await fetch('/api/workspace/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: delText }) })
    const j = await r.json().catch(() => ({}))
    setDelBusy(false)
    if (!r.ok) { setDelMsg(j.error ?? 'Couldn\u2019t delete the workspace.'); return }
    await supabase.auth.signOut().catch(() => {})
    window.location.href = '/login'
  }
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
    window.dispatchEvent(new Event('settings:changed'))
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
  // organisation
  type OrgMember = { user_id: string; role: string; email?: string; name?: string }
  const [org, setOrg] = useState<{ id: string; name: string; owner_id: string | null } | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [myRole, setMyRole] = useState(''); const [meId, setMeId] = useState('')
  const [orgMsg, setOrgMsg] = useState('')
  async function loadOrg() {
    try { const r = await fetch('/api/org'); const j = await r.json(); setOrg(j.org ?? null); setMembers(j.members ?? []); setMyRole(j.myRole ?? ''); setMeId(j.me ?? '') } catch { /* ignore */ }
  }
  async function orgAction(body: Record<string, unknown>) {
    setOrgMsg('')
    try {
      const r = await fetch('/api/org', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok || j.error) { setOrgMsg(typeof j.error === 'string' ? j.error : 'That did not work.'); return }
      loadOrg()
    } catch { setOrgMsg('That did not work.') }
  }
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
    if (sheet === 'Your team') loadOrg()
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
    window.dispatchEvent(new Event('settings:changed'))
    setSheet(null)
  }

  async function toggleNotif(k: string) {
    const next = { ...notifs, [k]: !notifs[k] }
    setNotifs(next)
    await supabase.auth.updateUser({ data: { notif_prefs: next } }).catch(() => {})
    window.dispatchEvent(new Event('settings:changed'))
  }

  useEffect(() => {
    try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || '') } catch { setTz('') }
    // restore whatever was saved last time
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      const m = (u?.user_metadata ?? {}) as Record<string, unknown>
      if (m.digest_time) setDigestTime(String(m.digest_time))
      if (m.work_start || m.work_end) setWorkHours({ start: String(m.work_start ?? '09:00'), end: String(m.work_end ?? '18:00') })
      if (m.morning_digest) setMorningDigest(String(m.morning_digest))
      if (typeof m.agent_popups === 'boolean') { setAgentOn(m.agent_popups); setAgentPopups(m.agent_popups) }
      if (m.timezone) setTzPick(String(m.timezone))
      loadFactors()
      loadOrg()
      if (m.draft_voice) setVoice(m.draft_voice as Record<string, string>)
      if (m.thresholds) setThresholds(m.thresholds as Record<string, string>)
      if (m.quiet_hours) setQuiet(m.quiet_hours as Record<string, string>)
      if (typeof m.auto_send === 'boolean') setAutoSend(m.auto_send)
      if (m.send_mode === 'with' || m.send_mode === 'without') setSendMode(m.send_mode)
      if (typeof m.industry === 'string') setIndustry(m.industry)
      if (typeof m.easy_read === 'boolean') setEasyRead(m.easy_read)
      if (m.send_rules && typeof m.send_rules === 'object') setSendRules(r => ({ ...r, ...(m.send_rules as object) }))
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
      // the same sources and counts the rest of the app shows: the demo's own data for the demo account,
      // otherwise each connected provider once, by its proper name
      const NAME: Record<string, string> = { gmail: 'Gmail', outlook: 'Outlook', slack: 'Slack', zoom: 'Zoom', whatsapp: 'WhatsApp', hubspot: 'HubSpot', gcal: 'Google Calendar', fireflies: 'Fireflies', salesforce: 'Salesforce' }
      if (user.email === 'demo@popsicle-labs.app') {
        setIntegrations(['Gmail', 'WhatsApp', 'Slack', 'Zoom'])
        setCounts({ signals: 59, accounts: 9 })
        return
      }
      setIntegrations([...new Set((integ ?? []).map(i => String(i.provider)))].map(k => NAME[k] ?? k))
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
  const SHEETS: Record<string, { title: string; sub: string; rows?: Array<[string, string]>; options?: Array<[string, string]>; actions?: Array<[string, boolean, () => void]>; note?: string; custom?: React.ReactNode; titleNode?: React.ReactNode; wide?: boolean }> = {
    Workspace: { title: 'Workspace', sub: org?.name ?? 'Your workspace', rows: [['Workspace name', org?.name ?? 'Your workspace'], ['Industry', industry || 'Not set'], ['Signed in as', user.email], ['Accounts tracked', counts ? String(counts.accounts) : '--'], ['Signals recorded', counts ? String(counts.signals) : '--'], ['Seats', `${members.length || 1} · invite teammates under Your team`]], actions: [['Manage your team', true, () => setSheet('Your team')]] , custom: (
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Industry</div>
        <div style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '6px 0 10px' }}>Popsicle uses it to frame its answers and advice for your market.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {INDUSTRIES.map(ind => (
            <button key={ind} onClick={() => { setIndustry(ind); saveJson('industry', ind) }}
              style={{ font: 'inherit', fontSize: 13, fontWeight: 500, padding: '7px 12px', borderRadius: 0, cursor: 'pointer',
                background: industry === ind ? 'var(--d-btn, var(--ink, #0E0D0B))' : 'var(--d-raised, #fff)', color: industry === ind ? '#fff' : 'var(--ink-muted)',
                border: '1px solid ' + (industry === ind ? 'var(--ink, #0E0D0B)' : 'var(--hairline, #EFEAE1)') }}>{ind}</button>
          ))}
        </div>
      </div>
    ) },
    Tone: { title: 'Tone', sub: 'How drafts read', options: [['Direct', 'Short sentences, no preamble'], ['Warm', 'Friendly, still concise'], ['Formal', 'Full sentences, measured'], ['Match the thread', 'Mirror how they write to you']] },
    Length: { title: 'Length', sub: 'How long a first draft runs', options: [['Short', 'Three or four sentences'], ['Medium', 'A paragraph and a clear ask'], ['Detailed', 'Context, evidence, then the ask']] },
    'Sign-off': { title: 'Sign-off', sub: 'The closing line on your emails', options: [['Best, Andy', 'Standard'], ['Thanks, Andy', 'Warmer'], ['Regards, Andy', 'Formal'], ['No sign-off', 'Ends on the last line']] },
    'Days dark': { title: 'Days dark before flagging', sub: 'How long silence runs before Popsicle raises it', options: [['3 days', 'Aggressive'], ['5 days', 'Balanced'], ['7 days', 'Relaxed'], ['10 days', 'Only long silences']] },
    'Minimum deal size': { title: 'Minimum deal size', sub: 'Smaller deals stay quiet unless critical', options: [['No minimum', 'Surface everything'], ['$25K', 'Skip the smallest'], ['$50K', 'Focus on real pipeline'], ['$100K', 'Enterprise only']] },
    'Commitment overdue': { title: 'Commitment overdue', sub: 'Grace period before a promise is chased', options: [['1 day', 'Immediately after the date'], ['3 days', 'Balanced'], ['7 days', 'Only clear misses']] },
    'Quiet hours': { title: 'Quiet hours', sub: `Nothing interrupts you from ${quiet.From} to ${quiet.To}`, rows: [['Applies to', 'Push notifications and alerts'], ['Does not apply to', 'Signals still being detected'], ['Timezone', tz || 'your device setting']], options: [['19:00 - 08:00', 'Evenings and nights'], ['18:00 - 09:00', 'Longer window'], ['22:00 - 07:00', 'Late finish'], ['Off', 'Interrupt me any time']], custom: (
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Custom window</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <TimeField value={customQuiet.From} onChange={v => setCustomQuiet(c => ({ ...c, From: v }))} />
          <span style={{ color: 'var(--ink-faint)' }}>to</span>
          <TimeField value={customQuiet.To} onChange={v => setCustomQuiet(c => ({ ...c, To: v }))} />
          <button onClick={() => { setQuiet(customQuiet); saveJson('quiet_hours', customQuiet); setSheet(null) }}
            style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '9px 16px', border: 0, borderRadius: 0, background: 'var(--accent, #E85A25)', color: '#fff', cursor: 'pointer' }}>Use this window</button>
        </div>
      </div>
    ) },
    Members: { title: 'Members', sub: 'Who can see this workspace', rows: [['You', `${user.email} · owner`], ['Others', 'No one else has access'], ['Seats', 'Invitations not enabled yet']], note: 'Signals, accounts and drafts are visible only to you until someone is invited.' },
    'Your team': { title: 'Your team', sub: org ? `${org.name} · ${members.length} ${members.length === 1 ? 'person' : 'people'}` : 'Everyone here sees the same accounts and signals', custom: (
      <div style={{ marginTop: 18 }}>
        {!org && <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.6 }}>No organisation yet. It is created the first time you sign in after the team update.</div>}
        {org && (
          <>
            {myRole === 'admin' && (
              <label style={{ display: 'block', marginBottom: 22 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Team name</span>
                <input defaultValue={org.name} onBlur={e => { if (e.target.value.trim() && e.target.value.trim() !== org.name) orgAction({ action: 'rename', name: e.target.value }) }}
                  style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, marginTop: 8, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0 }} />
              </label>
            )}
            {members.map(mb => {
              const isOwner = mb.user_id === org.owner_id
              const isMe = mb.user_id === meId
              return (
                <div key={mb.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span style={{ width: 34, height: 34, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--d-btn, var(--ink, #0E0D0B))', color: '#fff', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 12 }}>
                      {(mb.name || mb.email || '?').slice(0, 2).toUpperCase()}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, color: 'var(--ink)' }}>{mb.name || mb.email || mb.user_id.slice(0, 8)}{isMe ? ' (you)' : ''}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{mb.email && mb.name ? mb.email : isOwner ? 'Owner' : ''}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 'none' }}>
                    {myRole === 'admin' && !isOwner ? (
                      <select value={mb.role} onChange={e => orgAction({ action: 'role', userId: mb.user_id, role: e.target.value })}
                        style={{ font: 'inherit', fontSize: 13.5, padding: '6px 8px', border: '1px solid var(--hairline, #EFEAE1)', borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', background: 'transparent', color: 'var(--ink-muted)', cursor: 'pointer' }}>
                        <option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{isOwner ? 'Owner' : mb.role}</span>
                    )}
                    {myRole === 'admin' && !isOwner && !isMe && (
                      <button onClick={() => orgAction({ action: 'remove', userId: mb.user_id })} style={{ font: 'inherit', fontSize: 13, background: 'none', border: 0, cursor: 'pointer', color: 'var(--critical, #c43d2b)' }}>Remove</button>
                    )}
                  </div>
                </div>
              )
            })}
            {invites.filter(i => i.status !== 'accepted').length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)', paddingBottom: 8, borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>Pending invites</div>
                {invites.filter(i => i.status !== 'accepted').map(i => (
                  <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', fontSize: 14 }}>
                    <span style={{ color: 'var(--ink-muted)' }}>{i.email} <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>· {i.role}</span></span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--warn, #d38b1d)' }}>{i.status}</span>
                  </div>
                ))}
              </div>
            )}
            {orgMsg && <div style={{ fontSize: 13, color: 'var(--critical, #c43d2b)', marginTop: 14 }}>{orgMsg}</div>}
            {myRole !== 'admin' && <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 16, lineHeight: 1.6 }}>Only admins can change roles or remove people.</div>}
          </>
        )}
      </div>
    ) },
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
    'Signal visibility': { title: 'Signal visibility', sub: 'Who sees your accounts and signals', rows: [['Who sees them', 'Everyone in your organisation'], ['Why', 'Coverage, handovers and reviews need one shared picture'], ['Private accounts', 'Coming soon']] },
    'Data & privacy': { title: 'Data & privacy', sub: 'What Popsicle reads and keeps', rows: [['Reads', 'Sales threads on your connected sources'], ['Stores', 'Signals with short excerpts as evidence, account state and message metadata'], ['Retention', 'Until you delete the workspace; 30 days after you leave'], ['Location', 'App in Singapore, database in the USA'], ['Shared with', 'Only the sub-processors listed in the DPA'], ['Model training', 'Your data is never used to train models']], custom: (
      <div style={{ marginTop: 22 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)', paddingBottom: 8, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>Legal documents</div>
        {([['Privacy policy', 'How we handle your account and usage data', 'https://popsicle-labs.app/privacy.html'],
           ['Terms of service', 'The agreement for using Popsicle', 'https://popsicle-labs.app/terms.html'],
           ['Data processing agreement', 'How we process your customers\u2019 data (GDPR, UK, PDPA, PDP Law, US states)', 'https://popsicle-labs.app/dpa.html']] as const).map(([name, desc, url]) => (
          <a key={name} href={url} target="_blank" rel="noreferrer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '13px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', textDecoration: 'none' }}>
            <span><span style={{ display: 'block', fontSize: 15, color: 'var(--ink)' }}>{name}</span><span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{desc}</span></span>
            <span style={{ fontSize: 14, color: 'var(--accent, #E85A25)', flex: 'none' }}>Open ↗</span>
          </a>
        ))}
      </div>
    ), actions: [['Export everything', true, () => exportData('json')]] },
    'Delete workspace': { title: 'Delete workspace', sub: 'This permanently removes your data and cannot be undone', rows: [['Removes', counts ? `${counts.accounts} accounts and ${counts.signals} signals, with your commitments, decisions and connected sources` : 'Every account, signal, commitment, decision and connected source you added'], ['Keeps', 'Your sign-in, and your teammates\u2019 own data'], ['Before you go', 'Export a copy first if you might want it']], custom: (
      <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
        <label style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Type <b style={{ color: 'var(--critical, #c43d2b)' }}>DELETE</b> to confirm</label>
        <input value={delText} onChange={e => { setDelText(e.target.value); setDelMsg('') }} placeholder="DELETE"
          style={{ font: 'inherit', fontSize: 15, padding: '10px 12px', border: '1px solid var(--hairline, #EFEAE1)', borderRadius: 0, background: 'var(--d-raised, #fff)' }} />
        {delMsg && <div style={{ fontSize: 13, color: 'var(--critical, #c43d2b)' }}>{delMsg}</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button disabled={delText !== 'DELETE' || delBusy} onClick={deleteWorkspace}
            style={{ font: 'inherit', fontSize: 14, fontWeight: 600, padding: '11px 20px', border: 0, borderRadius: 0, cursor: delText === 'DELETE' ? 'pointer' : 'default', background: 'var(--critical, #c43d2b)', color: '#fff', opacity: delText === 'DELETE' && !delBusy ? 1 : 0.4 }}>
            {delBusy ? 'Deleting…' : 'Delete everything permanently'}
          </button>
          <button onClick={() => exportData('json')} style={{ font: 'inherit', fontSize: 14, fontWeight: 500, padding: '11px 18px', border: '1px solid var(--hairline, #EFEAE1)', borderRadius: 0, background: 'var(--d-raised, #fff)', cursor: 'pointer' }}>Export a copy first</button>
        </div>
      </div>
    ) },
    'Plan & billing': { title: 'Plan & billing', sub: 'Beta access', rows: [['Plan', 'Beta'], ['Cost', 'No charge during beta'], ['Seats', `${members.length || 1} · invite teammates under Your team`], ['Sources', `${integrations.length} connected`], ['Billing contact', user.email]], note: 'Pricing starts when the beta ends. You will be told before anything is charged.' },
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
              <img src={mfaEnroll.qr} alt="Scan with your authenticator app" width={168} height={168} style={{ display: 'block', border: '1px solid var(--hairline, #EFEAE1)', background: 'var(--d-raised, #fff)' }} />
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
    'Active sessions': { title: 'Active sessions', sub: 'Where you are signed in', rows: [['This device', device || 'This browser'], ['Signed in as', user.email ?? ''], ['Other devices', 'Signing them out ends every session except this one']], actions: [['Sign out other devices', true, async () => { await supabase.auth.signOut({ scope: 'others' }).catch(() => {}); setSheet(null) }]] },
    "What's new": { title: "What's new", sub: '', custom: (() => {
      const TAG: Record<string, [string, string]> = { New: ['#E85A25', 'rgba(232,90,37,.1)'], Improved: ['#2f8f5b', 'rgba(47,143,91,.1)'], Fixed: ['#2f6f9f', 'rgba(47,111,159,.1)'] }
      const ITEMS: Array<[keyof typeof TAG, string, string]> = [
        ['New', 'Every number explains itself', 'Click any figure to see exactly how it was worked out, down to the buyer\u2019s own words.'],
        ['New', 'Pipeline review', 'Run your weekly review in Popsicle. Decisions are saved with the evidence behind them.'],
        ['New', 'Replay', 'Play back the last week, month or year of your pipeline, narrated day by day.'],
        ['New', 'Popsicle in Slack', 'Ask @popsicle in any deal channel, and get a daily top-5 risk briefing.'],
        ['Improved', 'Your own view of Pulse', 'Reps, managers, leaders and finance each see what matters to them first.'],
        ['Improved', 'Ask Popsicle', 'Clear yes/no verdicts, and suggested questions on every page.'],
        ['Improved', 'Settings that work', 'Drafting, quiet hours, alerts and thresholds now shape what Popsicle does.'],
        ['Fixed', 'Decision trail', 'Decisions and follow-ups now save reliably.'],
      ]
      return (
        <div style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 16px', borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.2px', color: '#fff', background: 'linear-gradient(135deg,#FF8A50,#E85A25)', padding: '5px 10px' }}>{APP_VERSION}</span>
            <span style={{ fontSize: 14, color: 'var(--ink-muted)' }}>The latest release</span>
          </div>
          {ITEMS.map(([tag, title, desc]) => (
            <div key={title} style={{ display: 'grid', gridTemplateColumns: '84px minmax(0,1fr)', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', alignItems: 'start' }}>
              <span style={{ justifySelf: 'start', fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: TAG[tag][0], background: TAG[tag][1], padding: '4px 8px', marginTop: 2 }}>{tag}</span>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-.01em' }}>{title}</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 3, lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      )
    })() },
    'Work email': { title: 'Work email', sub: user.email, rows: [['Address', user.email], ['Changing it', 'Runs through account recovery, not this screen'], ['Sending from', 'Drafts send from this address via Gmail']], actions: [['Copy address', true, () => { navigator.clipboard?.writeText(user.email); setCopied(true); setTimeout(() => setCopied(false), 1600) }]] },
    'Your data': { title: 'Your data', sub: 'Everything Popsicle holds for this workspace', rows: [['Accounts & health', counts ? `${counts.accounts} records` : '--'], ['Signals', counts ? `${counts.signals} records` : '--'], ['Sources connected', `${integrations.length}`], ['Export', 'Not built yet']], note: 'Export is on the roadmap. Nothing is shared outside this workspace.' },
    'Weekly digest': { title: 'Weekly digest', sub: 'Your week in review', rows: [['Where', 'The week-in-review card on Pulse'], ['Covers', 'Meetings this week, commitments due, and accounts that went quiet'], ['Show it', 'Turn Weekly summary on or off under Notifications'], ['Email delivery', 'Coming soon']] },
    Appearance: { title: 'Appearance', sub: 'How the portal renders on this device', options: [['Light', 'Warm paper, the default'], ['Dark', 'Warm charcoal, easy on the eyes at night'], ['Match system', 'Follows your computer\u2019s light or dark setting']] },
    Language: { title: 'Language', sub: 'Interface and AI responses', options: [['English (US)', 'Default'], ['English (UK)', 'British spelling in answers and drafts'], ['Bahasa Indonesia', 'Answers and drafts in Bahasa; the interface stays in English']] },
    Timezone: { title: 'Timezone', sub: '', custom: (() => {
      const active = tzPick || tz
      const offset = (zone: string) => { try { const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find(x => x.type === 'timeZoneName'); return p?.value ?? '' } catch { return '' } }
      // every time zone the browser knows (about 400), searchable by city, region or offset (e.g. "jakarta", "europe", "gmt+7")
      const allZones: string[] = (() => { try { return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? TIMEZONES } catch { return TIMEZONES } })()
      const q = tzQuery.trim().toLowerCase()
      const list = [...new Set([tz, ...allZones].filter(Boolean))].filter(z => !q || z.toLowerCase().replace(/_/g, ' ').includes(q) || offset(z).toLowerCase().replace(/\s/g, '').includes(q.replace(/\s/g, '')))
      return (
        <div style={{ marginTop: 18 }}>
          <input value={tzQuery} onChange={e => setTzQuery(e.target.value)} placeholder="Search a city, region or offset (GMT+7)"
            style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 15, padding: '10px 0', border: 0, borderRadius: 0, appearance: 'none', WebkitAppearance: 'none', borderBottom: '1px solid var(--ink, #0E0D0B)', background: 'transparent', color: 'var(--ink)', outline: 0 }} />
          <div style={{ height: 320, overflowY: 'auto', marginTop: 6 }}>   {/* fixed height: the window never jumps while you type */}
            {list.length === 0 && <div style={{ fontSize: 14, color: 'var(--ink-faint)', padding: '18px 0' }}>No time zone matches \u201c{tzQuery}\u201d. Try a city, a region or an offset like GMT+7.</div>}
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
    Currency: { title: 'Currency', sub: 'Every amount in Popsicle is shown in this currency, at live exchange rates', options: CURRENCIES.map(c => [c.code, `${c.name} · ${c.symbol.trim()}`] as [string, string]) },
    'Connected sources': { title: 'Connected sources', sub: `${integrations.length} live`, rows: (integrations.length ? integrations.map(i => [i, 'Connected'] as [string, string]) : [['None', 'Connect Gmail or Slack to start']]), actions: [
      ...(integrations.some(x => /slack/i.test(x)) ? [['Manage Slack channels', true, () => router.push('/integrations?slack_channels=1')], ['Daily briefing settings', false, () => router.push('/integrations?slack_briefing=1')]] as Array<[string, boolean, () => void]> : []),
      ['All integrations', !integrations.some(x => /slack/i.test(x)), () => router.push('/integrations')],
    ] },
    'Sending': { title: 'Sending', sub: 'What happens after Popsicle drafts a message', wide: true, custom: (() => {
      const setRules = (patch: Partial<typeof sendRules>) => { const next = { ...sendRules, ...patch }; setSendRules(next); saveJson('send_rules', next) }
      const choose = (m: 'with' | 'without') => { setSendMode(m); saveJson('send_mode', m) }
      const card = (m: 'with' | 'without', title: string, desc: string) => (
        <button onClick={() => choose(m)} style={{ font: 'inherit', textAlign: 'left', padding: '14px 16px', cursor: 'pointer', borderRadius: 0, width: '100%',
          background: sendMode === m ? 'var(--d-tint-red, rgba(232,90,37,.06))' : 'var(--d-raised, #fff)', border: sendMode === m ? '2px solid var(--accent, #E85A25)' : '1px solid var(--hairline, #EFEAE1)' }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: sendMode === m ? 'var(--accent, #E85A25)' : 'var(--ink)' }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 3, lineHeight: 1.45 }}>{desc}</div>
        </button>)
      const label = (t: string) => <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)', margin: '14px 0 7px' }}>{t}</div>
      const chip = (on: boolean, text: string, onClick: () => void) => (
        <button key={text} onClick={onClick} style={{ font: 'inherit', fontSize: 12.5, fontWeight: on ? 600 : 500, padding: '6px 11px', borderRadius: 0, cursor: 'pointer', marginRight: 5, marginBottom: 5,
          background: on ? 'var(--accent, #E85A25)' : 'var(--d-raised, #fff)', color: on ? '#fff' : 'var(--ink-muted)', border: '1px solid ' + (on ? 'var(--accent, #E85A25)' : 'var(--hairline, #EFEAE1)') }}>{text}</button>)
      const KINDS = ['Follow-ups on existing threads', 'Rebooking cancelled meetings', 'Documents you already approved', 'First contact with someone new']
      return (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {card('with', 'Send with you', 'Popsicle drafts every message; nothing goes out until you review and send it.')}
            {card('without', 'Send without you', 'Popsicle sends its drafts on its own, only within the limits you set below.')}
          </div>
          {sendMode === 'without' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24 }}>
              <div>
                {label('What it may send')}
                <div>{KINDS.map(k => chip(sendRules.kinds.includes(k), k, () => setRules({ kinds: sendRules.kinds.includes(k) ? sendRules.kinds.filter(x => x !== k) : [...sendRules.kinds, k] })))}</div>
              </div>
              <div>
                {label('Never send on its own to')}
                <div>
                  {chip(sendRules.neverExecs, 'Executives (VP and above)', () => setRules({ neverExecs: !sendRules.neverExecs }))}
                  {chip(sendRules.neverCritical, 'Accounts at critical risk', () => setRules({ neverCritical: !sendRules.neverCritical }))}
                </div>
                {label('Only on deals up to')}
                <div>{['$25K', '$50K', '$100K', '$250K', 'Any size'].map(v => chip(sendRules.maxDeal === v, v, () => setRules({ maxDeal: v })))}</div>
              </div>
              <div>
                {label('Hold before sending, so you can stop it')}
                <div>{['No hold', '5 minutes', '30 minutes', '1 hour'].map(v => chip(sendRules.hold === v, v, () => setRules({ hold: v })))}</div>
              </div>
              <div>
                {label('Tell me')}
                <div>{['Every time', 'In a daily summary'].map(v => chip(sendRules.notify === v, v, () => setRules({ notify: v })))}</div>
              </div>
            </div>
          )}
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--inset, #F4F0E8)', fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
            {sendMode === 'without'
              ? 'Your choices are saved. Automatic sending switches on once Popsicle has permission to send from your email, which is not connected yet. Until then, every draft still waits for you.'
              : 'Every draft waits for you. You can switch to sending without you at any time.'}
          </div>
        </div>
      )
    })() },
    'Resolution broadcasts': { title: 'Resolution broadcasts', sub: 'What happens when you mark a signal handled', rows: [['Slack', 'Appends "Handled by…" to the original card'], ['HubSpot', 'Writes a note on the matching deal'], ['Both', 'Opt-in per source']], actions: [['Open integrations', true, () => router.push('/integrations')]] },
    'Help & support': { title: 'Help & support', sub: 'Answers drawn from your own workspace data', rows: [['Ask Popsicle', 'Fastest route · answers in seconds'], ['Email support', 'support@popsicle-labs.app'], ['Status', 'All systems operational']], actions: [['Chat with AI', true, () => router.push('/ask')]] },
    'About Popsicle': { title: 'About Popsicle', titleNode: (
      <span style={{ display: 'block', padding: '4px 0 2px' }} aria-label="Popsicle Labs">
        <img src="/brand/logo-light.svg" alt="Popsicle Labs" className="about-logo about-logo-light" style={{ height: 52, width: 'auto', display: 'block' }} />
        <img src="/brand/logo-dark.svg" alt="Popsicle Labs" className="about-logo about-logo-dark" style={{ height: 52, width: 'auto', display: 'none' }} />
      </span>
    ), sub: 'Revenue intelligence infrastructure', rows: [['Version', APP_VERSION], ['Build date', (() => { const t = process.env.NEXT_PUBLIC_BUILD_TIME; return t ? new Date(t).toLocaleString('en-US', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Unknown' })()], ['Environment', (() => { const e = process.env.NEXT_PUBLIC_APP_ENV ?? 'development'; return e.charAt(0).toUpperCase() + e.slice(1) })()], ['Platform', 'Revenue intelligence'], ['Support', 'support@popsicle-labs.app']], note: '\u00a9 2026 Popsicle Labs. All rights reserved.' },
    'Email support': { title: 'Email support', sub: 'support@popsicle-labs.app', rows: [['Include', 'Workspace name and the account in question'], ['Alternative', 'Ask Popsicle for instant answers']], actions: [['Copy address', true, () => { navigator.clipboard?.writeText('support@popsicle-labs.app'); setCopied(true); setTimeout(() => setCopied(false), 1600) }]] },
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
        <Row label="Workspace" sub={[org?.name ?? 'Your workspace', industry].filter(Boolean).join(' · ')} value={`${members.length || 1} ${(members.length || 1) === 1 ? 'seat' : 'seats'}`} onClick={() => setSheet('Workspace')} />
        <Row label="Plan & billing" sub="Beta access, no charge while in beta" value="Beta" onClick={() => setSheet('Plan & billing')} />
        <Row label="Your data" value={counts ? `${counts.accounts} accounts · ${counts.signals} signals` : '--'} onClick={() => setSheet('Your data')} />
        <Row label="Weekly digest" sub="The week-in-review card on Pulse · email coming soon" value={notifs.digest ? 'On Pulse' : 'Off'} onClick={() => setSheet('Weekly digest')} />
      </Section>

      <Section title="Your day" sub="When Popsicle should work around you.">
        {AGENT_ENABLED && (
          <div onClick={() => { const v = !agentOn; setAgentOn(v); setAgentPopups(v); saveJson('agent_popups', v) }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: 15, color: 'var(--ink)' }}>{AGENT_NAME} speaks up</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{agentOn ? 'Morning brief, late promises and new signals come up through the Ask bar' : 'Off. Everything waits for you on the Ask page'}</div>
              {agentOn && (
                <span onClick={e => {
                  e.stopPropagation()
                  try { const d = new Date().toISOString().slice(0, 10); ['brief', 'count', 'seen'].forEach(k => localStorage.removeItem(`agent:${k}:${d}`)); sessionStorage.removeItem('agent:brief') } catch { /* ignore */ }
                  router.push('/pulse')
                }} style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', marginTop: 6 }}>Show today&apos;s brief again</span>
              )}
            </div>
            <span role="switch" aria-checked={agentOn} style={{ width: 38, height: 22, borderRadius: 999, background: agentOn ? 'var(--accent, #E85A25)' : 'var(--hairline, #EFEAE1)', position: 'relative', transition: 'background .15s ease', flex: 'none' }}>
              <span style={{ position: 'absolute', top: 3, left: agentOn ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: 'var(--d-raised, #fff)', transition: 'left .15s ease', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
            </span>
          </div>
        )}
        {/* moved here from Edit profile (v11.44) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
          <div>
            <div style={{ fontSize: 15, color: 'var(--ink)' }}>Working hours</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>Outside these hours, only critical signals interrupt you</div>
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
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>When the morning brief appears in the Ask bar</div>
          </div>
          <TimeField value={morningDigest} onChange={val => { setMorningDigest(val); saveJson('morning_digest', val) }} />
        </div>
      </Section>

      <Section title="Preferences" sub="How the portal looks and reads.">
        <Row label="Appearance" value={prefs.Appearance} onClick={() => setSheet('Appearance')} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
          <div>
            <div style={{ fontSize: 15, color: 'var(--ink)' }}>Easy read</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>Makes small text 20% larger; headings and figures stay the same</div>
          </div>
          <button role="switch" aria-checked={easyRead} aria-label="Easy read" onClick={() => { const v = !easyRead; setEasyRead(v); try { localStorage.setItem('easyread', v ? '1' : '0') } catch { /* ignore */ } saveJson('easy_read', v) }}
            style={{ width: 38, minWidth: 38, height: 22, borderRadius: 0, border: 0, padding: 0, cursor: 'pointer', position: 'relative', flex: '0 0 38px',
              background: easyRead ? 'linear-gradient(135deg,#FF8A50,#FF6B35)' : 'var(--d-inset, var(--border, #E5DFD4))' }}>
            <span style={{ position: 'absolute', top: 3, left: easyRead ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .18s ease' }} />
          </button>
        </div>
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
        {([['risk', 'Risk alerts', 'New signals in the Ask bar; respects quiet hours and minimum deal size'],
           ['digest', 'Weekly summary', 'The week-in-review card on Pulse'],
           ['brief', 'Pre-meeting briefs', 'The pre-meeting brief card on Pulse'],
           ['push', 'Push notifications', typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'Allowed in this browser' : 'Needs browser permission'],
           ['emailDigest', 'Email digest', 'A weekly summary in your inbox'],
           ['slackCritical', 'Slack DMs for critical signals', 'A direct message the moment an at-risk signal lands'],
           ['emailHandled', 'Email for handled and snoozed signals', 'A short confirmation when a signal is closed or parked']] as const).map(([k, label, sub]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
            <div>
              <div style={{ fontSize: 15, color: 'var(--ink)' }}>{label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{sub}</div>
            </div>
            {(k === 'emailDigest' || k === 'slackCritical' || k === 'emailHandled') ? <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Coming soon</span> :
            <button onClick={() => (k === 'push' ? askPush() : toggleNotif(k))} aria-label={label}
              style={{ width: 38, minWidth: 38, height: 22, borderRadius: 0, border: 0, padding: 0, cursor: 'pointer', position: 'relative', flex: '0 0 38px', marginRight: 2,
                background: notifs[k] ? 'linear-gradient(135deg,#FF8A50,#FF6B35)' : 'var(--border, #E5DFD4)' }}>
              <span style={{ position: 'absolute', top: 3, left: notifs[k] ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: 'var(--d-raised, #fff)', transition: 'left .18s ease', boxShadow: '0 1px 2px rgba(14,13,11,.2)' }} />
            </button>}
          </div>
        ))}
        <Row label="Quiet hours" sub="Nothing interrupts you inside this window" value={`${quiet.From} - ${quiet.To}`} onClick={() => setSheet('Quiet hours')} />
      </Section>

      <Section title="Drafting" sub="How Popsicle writes on your behalf.">
        <Row label="Tone" sub="Applies to every draft it prepares" value={voice.Tone} onClick={() => setSheet('Tone')} />
        <Row label="Length" sub="How long a first draft should run" value={voice.Length} onClick={() => setSheet('Length')} />
        <Row label="Sign-off" sub="The closing line on your emails" value={voice['Sign-off']} onClick={() => setSheet('Sign-off')} />
        <Row label="Sending" sub="Whether Popsicle sends after drafting, or waits for you" value={sendMode === 'without' ? 'Without you' : 'With you'} onClick={() => setSheet('Sending')} />
      </Section>

      <Section title="Escalation" sub="When a signal becomes your problem.">
        <Row label="Days dark before flagging" sub="How long silence runs before Popsicle raises it" value={thresholds['Days dark']} onClick={() => setSheet('Days dark')} />
        <Row label="Minimum deal size" sub="Smaller deals stay quiet unless critical" value={thresholds['Minimum deal size']} onClick={() => setSheet('Minimum deal size')} />
        <Row label="Commitment overdue" sub="Grace period before a promise is chased" value={thresholds['Commitment overdue']} onClick={() => setSheet('Commitment overdue')} />
      </Section>

      <Section title="Team" sub="Who else can see this workspace.">
        <Row label="Your team" sub={org ? `${org.name} · everyone here sees the same accounts` : 'Who is in your organisation'} value={`${members.length || 1} ${(members.length || 1) === 1 ? 'person' : 'people'}`} onClick={() => setSheet('Your team')} />
        <Row label="Invite a teammate" sub="Share signals and coverage" value="Invite" onClick={() => setSheet('Invite a teammate')} />
        <Row label="Signal visibility" sub="Everyone in your organisation sees the same accounts and signals" value="Organisation" onClick={() => setSheet('Signal visibility')} />
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
          value="Manage" onClick={() => setSheet('Active sessions')} />
        {pwStatus && !pwOpen && <div style={{ fontSize: 13, color: pwStatus.type === 'ok' ? 'var(--good, #2f8f5b)' : 'var(--critical, #c43d2b)', padding: '14px 0' }}>{pwStatus.msg}</div>}
      </Section>

      <Section title="More" sub="Product information.">
        <Row label="What's new" sub="Recent changes to Popsicle" value={APP_VERSION} onClick={() => setSheet("What's new")} />
        <Row label="Help & support" sub="Answers from your own data" value="Chat with AI" onClick={() => setSheet('Help & support')} />
        <Row label="About Popsicle" value={APP_VERSION} onClick={() => setSheet('About Popsicle')} />
        <Row label="Data & privacy" sub="What Popsicle reads and keeps · privacy policy, terms and DPA" value="Read" onClick={() => setSheet('Data & privacy')} />
        <Row label="Email support" value="support@popsicle-labs.app" onClick={() => setSheet('Email support')} />
        <Row label="Delete workspace" sub="Removes every account, signal and connection" danger
          value={<span style={{ color: 'var(--critical, #c43d2b)' }}>Delete</span>} onClick={() => setSheet('Delete workspace')} />
      </Section>

      {sheet && SHEETS[sheet] && (() => {
        const sh = SHEETS[sheet]
        return (
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'var(--d-tintbg, rgba(14,13,11,.42))', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: sh.wide ? 720 : 520, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', background: 'var(--paper, #FBF8F3)', padding: sh.wide ? '30px 36px 30px' : '36px 40px 40px', boxShadow: '0 40px 90px -30px rgba(14,13,11,.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '2.2px', textTransform: 'uppercase', color: 'var(--accent)' }}>settings</span>
                <button onClick={() => setSheet(null)} style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '2.2px', textTransform: 'uppercase', color: 'var(--ink-faint)', background: 'none', border: 0, cursor: 'pointer' }}>close</button>
              </div>
              <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 30, letterSpacing: '-.035em', margin: '12px 0 4px', color: 'var(--ink)' }}>{sh.titleNode ?? sh.title.split(/(Popsicle)/).map((part, k) => part === 'Popsicle' ? <span key={k} style={{ color: 'var(--accent, #E85A25)' }}>{part}</span> : part)}</h2>
              {sh.sub && <div style={{ fontSize: 14, color: 'var(--ink-muted)' }}>{sh.sub}</div>}
              <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '22px 0 6px' }} />

              {sh.rows?.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                  <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>{k}</span>
                  <span style={{ fontSize: 14, color: v === 'Connected' ? 'var(--good, #2f8f5b)' : 'var(--ink-muted)', fontWeight: v === 'Connected' ? 600 : 400, textAlign: 'right' }}>{v}</span>
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
                    else if (key === 'Currency') { choosePref(key, label); setTimeout(() => window.location.reload(), 400) }   // redraw every figure in the new currency
                    else if (key === 'Appearance') { choosePref(key, label); applyTheme(label) }
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
