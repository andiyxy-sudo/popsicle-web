'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/analytics'

// The first ten minutes. A new workspace sees, on Pulse: how to connect a source; then, while Popsicle reads
// the last 30 days, what's happening and what to do next; and, until they set it, a one-click role choice
// (which decides what Pulse shows first). It refreshes itself and steps aside when the first signals land.
type State = { demo?: boolean; sources: Array<{ provider: string; connectedAt: string | null; reading: boolean; needsReconnect: boolean }>; signals: number; accounts: number; slackChannels: number; role: string | null; teamSize: number }
const NAME: Record<string, string> = { gmail: 'Gmail', outlook: 'Outlook', slack: 'Slack', zoom: 'Zoom', gcal: 'Google Calendar', hubspot: 'HubSpot', fireflies: 'Fireflies', whatsapp: 'WhatsApp' }
const ROLES: Array<[string, string, string]> = [['Sales rep', 'Account Executive', 'Your own accounts first'], ['Manager', 'Sales Manager', 'Your team\u2019s coverage'], ['Sales leader', 'VP of Sales', 'The forecast and its risk'], ['Finance', 'Finance', 'Revenue at risk, with proof']]
const ago = (iso: string | null) => { if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)}h ago` }

export function FirstRun() {
  const router = useRouter()
  const [st, setSt] = useState<State | null>(null)
  const [roleDone, setRoleDone] = useState(false)
  useEffect(() => {
    let dead = false, t: ReturnType<typeof setTimeout>
    const load = async () => {
      try {
        const j = await (await fetch('/api/onboarding')).json() as State
        if (dead) return
        setSt(prev => { if (prev && prev.signals === 0 && j.signals > 0) { track('first_signals_arrived', { sources: j.sources.length }); router.refresh() } return j })   // first signals landed: fill Pulse in
        if (!j.demo && j.signals === 0) t = setTimeout(load, 60000)                                       // still reading: check every minute
      } catch { /* ignore */ }
    }
    load()
    return () => { dead = true; clearTimeout(t) }
  }, [router])
  if (!st || st.demo) return null

  const pickRole = async (title: string) => {
    track('role_chosen', { role: title, from: 'first_run' })
    await createClient().auth.updateUser({ data: { role: title } }).catch(() => {})
    setRoleDone(true); setTimeout(() => window.location.reload(), 600)   // Pulse redraws in that view
  }
  const roleCard = !st.role && !roleDone && (
    <div className="fr-role">
      <div><b>What’s your role?</b><span>Pulse shows what matters to you first. You can change it any time in your profile.</span></div>
      <div className="fr-role-opts">{ROLES.map(([label, title, hint]) => <button key={label} onClick={() => pickRole(title)} title={hint}>{label}</button>)}</div>
    </div>
  )

  // 1. nothing connected yet
  if (st.sources.length === 0) return (
    <section className="fr">
      <div className="fr-k">Welcome to Popsicle</div>
      <h2>Connect your first source, and Popsicle starts reading your deals.</h2>
      <p>Popsicle reads your sales conversations to find the deals at risk before your CRM does. It starts with the last 30 days, and nothing is ever sent on your behalf.</p>
      <div className="fr-actions">
        <button className="fr-primary" onClick={() => router.push('/integrations')}>Connect Gmail</button>
        <button onClick={() => router.push('/integrations')}>Connect Slack</button>
        <button onClick={() => router.push('/integrations')}>See all sources</button>
      </div>
      {roleCard}
    </section>
  )

  // 2. connected, first signals not in yet
  if (st.signals === 0) {
    const slack = st.sources.find(s => s.provider === 'slack')
    const steps: Array<[boolean, string, string, (() => void)?]> = [
      ...st.sources.map(s => [!s.reading && !s.needsReconnect, `${NAME[s.provider] ?? s.provider} connected${s.connectedAt ? ` \u00b7 ${ago(s.connectedAt)}` : ''}`,
        s.needsReconnect ? 'Needs reconnecting' : s.reading ? 'Reading the last 30 days\u2026' : 'Read', s.needsReconnect ? () => router.push('/integrations') : undefined] as [boolean, string, string, (() => void)?]),
      ...(slack && st.slackChannels === 0 ? [[false, 'Choose which Slack channels to read', 'Open', () => router.push('/integrations?slack_channels=1')] as [boolean, string, string, () => void]] : []),
      [!!st.role || roleDone, 'Tell Popsicle your role', st.role ?? (roleDone ? 'Saved' : 'Below')],
      [st.teamSize > 1, 'Invite a teammate', st.teamSize > 1 ? `${st.teamSize} people` : 'Invite', st.teamSize > 1 ? undefined : () => router.push('/settings')],
    ]
    return (
      <section className="fr">
        <div className="fr-k"><span className="fr-pulse" />Getting ready</div>
        <h2>We’re reading your last 30 days.</h2>
        <p>Your first signals usually arrive within about an hour. You don’t need to keep this page open; Pulse fills itself in when they land.</p>
        <ul className="fr-steps">
          {steps.map(([done, label, state, go], k) => (
            <li key={k} className={done ? 'done' : ''}>
              <i>{done ? '\u2713' : ''}</i><span>{label}</span>
              {go ? <button onClick={go}>{state} →</button> : <em>{state}</em>}
            </li>
          ))}
        </ul>
        {roleCard}
      </section>
    )
  }

  // 3. up and running, but no role yet
  return roleCard ? <section className="fr fr-slim">{roleCard}</section> : null
}
