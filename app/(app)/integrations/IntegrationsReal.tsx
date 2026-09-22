'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { A360Modal, ModalBtn, ModalConfig, ActionConfirmBody } from '@/components/account/A360Modal'
import { LOGOS } from './IntegrationsShowcase'
import { SlackChannelPicker } from './SlackChannels'
import { BriefingWindow } from './SlackDigest'
import { PageHead } from '@/components/layout/PageHead'
import { EmptyState } from '@/components/ui/EmptyState'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Providers whose OAuth + ingestion are live (reusing the Android backend).
// fn = the edge function slug. Others are shown as "coming soon".
type Provider = { key: string; name: string; short?: string; desc: string; cat: string; fn?: string; token?: boolean }
const PROVIDERS: Provider[] = [
  { key: 'gmail', name: 'Gmail', desc: 'Reads sales threads · Detects tone & ghosting', cat: 'Email', fn: 'oauth-gmail' },
  { key: 'outlook', name: 'Outlook', desc: 'Microsoft 365 email · Same AI analysis', cat: 'Email' },
  { key: 'slack', name: 'Slack', desc: 'Shared channels · Flags quiet conversations', cat: 'Messaging', fn: 'oauth-slack' },
  { key: 'whatsapp', name: 'WhatsApp Business', short: 'WhatsApp', desc: 'Buyer message patterns & sentiment', cat: 'Messaging' },
  { key: 'teams', name: 'Microsoft Teams', short: 'Teams', desc: 'Shared channels & chats · Same stall detection', cat: 'Messaging' },
  { key: 'gcal', name: 'Google Calendar & Meet', desc: 'Meeting cadence & stall detection · Meet call transcripts & analysis', cat: 'Calendar', fn: 'oauth-gcal' },
  { key: 'hubspot', name: 'HubSpot', desc: 'Deal values, stages & owners · CRM risk signals', cat: 'CRM', fn: 'oauth-hubspot' },
  { key: 'salesforce', name: 'Salesforce', desc: 'Bi-directional sync · Opportunity health', cat: 'CRM' },
  { key: 'gong', name: 'Gong', desc: 'Revenue intelligence · Call insights', cat: 'Voice & Meetings' },
  { key: 'fireflies', name: 'Fireflies', desc: 'Meeting transcripts from any platform · Call analysis', cat: 'Voice & Meetings', fn: 'oauth-fireflies', token: true },
  { key: 'zoom', name: 'Zoom', desc: 'Call transcripts · Buyer sentiment analysis', cat: 'Voice & Meetings', fn: 'oauth-zoom' },
]

const CAT_ORDER = ['Email', 'Messaging', 'Calendar', 'CRM', 'Voice & Meetings']

export type ProviderStat = {
  total: number; thisMonth: number; high: number; watch: number; positive: number
  lastSignal: string | null; connectedAt: string | null; lastSynced: string | null
  identity?: string | null
}


// HubSpot connects with a private-app token instead of an OAuth redirect.
// Module scope so the input keeps focus across re-renders.
function HubspotConnectBody({ onDone }: { onDone: () => void }) {
  const [token, setToken] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  async function submit() {
    if (!token.trim()) { setErr('Paste your access token first.'); return }
    setWorking(true); setErr(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }
      const res = await fetch(`${SUPA_URL}/functions/v1/oauth-hubspot?action=connect`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        setWorking(false)
        setErr(String(data?.detail || data?.error || 'Connection failed.'))
        return
      }
      const fs = data.first_sync || {}
      setDone(`Connected. Synced ${fs.deals ?? 0} deals, enriched ${fs.accounts_enriched ?? 0} accounts, created ${fs.accounts_created ?? 0}.`)
      setTimeout(onDone, 1600)
    } catch {
      setWorking(false)
      setErr('Network error. Try again.')
    }
  }

  const step = { fontSize: 11.5, color: 'var(--t3)', lineHeight: 1.6 }
  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 10 }}>
        Popsicle reads your deals and companies with a private app token from your own HubSpot. Two minutes, read-only scopes, no HubSpot review needed.
      </div>
      <div style={{ background: 'var(--inset)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
        <div style={step}>1. In HubSpot: Settings gear, then Integrations, then Private Apps (or Legacy apps, then Create, then Private)</div>
        <div style={step}>2. Name it Popsicle, open the Scopes tab</div>
        <div style={step}>3. Add read scopes: deals, companies, contacts, owners</div>
        <div style={step}>4. Create app, then Show token and copy it</div>
      </div>
      <input
        type="password"
        value={token}
        onChange={e => setToken(e.target.value)}
        placeholder="Paste your HubSpot access token"
        autoFocus
        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--t1)', fontSize: 12.5, fontFamily: "'DM Mono',monospace", outline: 'none', boxSizing: 'border-box' }}
      />
      {err && <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 8 }}>{err}</div>}
      {done && <div style={{ fontSize: 11.5, color: 'var(--ok)', marginTop: 8, fontWeight: 700 }}>{done}</div>}
      <button
        onClick={submit}
        disabled={working || !!done}
        style={{ marginTop: 12, width: '100%', padding: '10px 0', borderRadius: 10, background: 'var(--o)', border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: working ? 'default' : 'pointer', fontFamily: "'Outfit'", opacity: working || done ? 0.7 : 1 }}
      >{working ? 'Connecting and running first sync...' : done ? 'Connected' : 'Connect HubSpot'}</button>
      <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 8, textAlign: 'center' }}>The token is stored encrypted and only used to read your CRM data.</div>
    </div>
  )
}


function FirefliesConnectBody({ onDone }: { onDone: () => void }) {
  const [token, setToken] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  async function submit() {
    if (!token.trim()) { setErr('Paste your API key first.'); return }
    setWorking(true); setErr(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }
      const res = await fetch(`${SUPA_URL}/functions/v1/oauth-fireflies?action=connect`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        setWorking(false)
        setErr(String(data?.detail || data?.error || 'Connection failed.'))
        return
      }
      const fs = data.first_sync || {}
      setDone(`Connected. Pulled ${fs.inserted ?? 0} new transcripts from ${fs.listed ?? 0} meetings.`)
      setTimeout(onDone, 1600)
    } catch {
      setWorking(false)
      setErr('Network error. Try again.')
    }
  }

  const step = { fontSize: 11.5, color: 'var(--t3)', lineHeight: 1.6 }
  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 10 }}>
        Fireflies records your meetings on Zoom, Meet, Teams and more. Popsicle pulls those transcripts and analyzes every call. Works on the free Fireflies plan.
      </div>
      <div style={{ background: 'var(--inset)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
        <div style={step}>1. Go to app.fireflies.ai, open Settings</div>
        <div style={step}>2. Open the Developer settings section</div>
        <div style={step}>3. Copy your API key and paste it below</div>
      </div>
      <input
        type="password"
        value={token}
        onChange={e => setToken(e.target.value)}
        placeholder="Paste your Fireflies API key"
        autoFocus
        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--t1)', fontSize: 12.5, fontFamily: "'DM Mono',monospace", outline: 'none', boxSizing: 'border-box' }}
      />
      {err && <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 8 }}>{err}</div>}
      {done && <div style={{ fontSize: 11.5, color: 'var(--ok)', marginTop: 8, fontWeight: 700 }}>{done}</div>}
      <button
        onClick={submit}
        disabled={working || !!done}
        style={{ marginTop: 12, width: '100%', padding: '10px 0', borderRadius: 10, background: 'var(--o)', border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: working ? 'default' : 'pointer', fontFamily: "'Outfit'", opacity: working || done ? 0.7 : 1 }}
      >{working ? 'Connecting and pulling transcripts...' : done ? 'Connected' : 'Connect Fireflies'}</button>
      <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 8, textAlign: 'center' }}>The key is stored encrypted and only used to read your transcripts.</div>
    </div>
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function ResSwitch({ on }: { on: boolean }) {
  return (
    <div style={{ width: 36, height: 21, borderRadius: 20, background: on ? 'var(--ok)' : 'var(--border)', position: 'relative', transition: 'background .18s ease', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2.5, left: on ? 17.5 : 2.5, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .18s ease', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }}></div>
    </div>
  )
}

export function IntegrationsReal({ active, stats = {} }: { active: string[]; stats?: Record<string, ProviderStat> }) {
  const [briefingOpen, setBriefingOpen] = useState(false)   // the daily Slack briefing, in its own window
  // Opt-in resolution broadcasts (shared columns with mobile).
  const [resToggles, setResToggles] = useState<{ slack?: boolean; hubspot?: boolean }>({})
  useEffect(() => {
    createClient().from('integrations').select('provider, slack_post_resolutions, hubspot_log_resolutions')
      .in('provider', ['slack', 'hubspot'])
      .then(({ data }) => {
        const t: { slack?: boolean; hubspot?: boolean } = {}
        for (const r of ((data ?? []) as Array<{ provider: string; slack_post_resolutions: boolean | null; hubspot_log_resolutions: boolean | null }>)) {
          if (r.provider === 'slack') t.slack = !!r.slack_post_resolutions
          if (r.provider === 'hubspot') t.hubspot = !!r.hubspot_log_resolutions
        }
        setResToggles(t)
      })
  }, [active])
  async function flipResToggle(p: Provider): Promise<boolean> {
    const key = p.key as 'slack' | 'hubspot'
    const col = key === 'slack' ? 'slack_post_resolutions' : 'hubspot_log_resolutions'
    const next = !resToggles[key]
    setResToggles(v => ({ ...v, [key]: next }))
    await createClient().from('integrations').update({ [col]: next }).eq('provider', key)
    return next
  }
  const [modal, setModal] = useState<ModalConfig | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Provider | null>(null)
  const [confirmDc, setConfirmDc] = useState(false)

  // Arriving from a fresh Slack connect (?slack_channels=1): open the channel
  // picker immediately so the first-run user is never stranded with a
  // connected-but-silent Slack. window.location avoids the useSearchParams
  // Suspense requirement; the param is stripped so refreshes don't re-open it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('slack_channels') === '1' && active.includes('slack')) {
      window.history.replaceState({}, '', '/integrations')
      const slack = PROVIDERS.find(p => p.key === 'slack')
      if (slack) openSlackChannels(slack)
    }
    if (params.get('slack_briefing') === '1' && active.includes('slack')) {
      window.history.replaceState({}, '', '/integrations')
      setBriefingOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const cats = CAT_ORDER.filter(c => PROVIDERS.some(p => p.cat === c))

  // Kick off real OAuth: ask the edge function for the consent URL (with our JWT
  // + platform=web), then send the browser there. The function will 302 back to
  // /integrations/callback when done.
  async function connect(p: Provider) {
    if (p.key === 'fireflies') {
      setModal({
        title: 'Connect Fireflies',
        body: <FirefliesConnectBody onDone={() => window.location.reload()} />,
      })
      return
    }
    if (!p.fn) {
      setModal({
        title: 'Coming soon',
        body: <ActionConfirmBody kind="connect" title={`${p.name} is coming soon`} desc="This connector is not wired up yet. Gmail, Google Calendar, Slack, and Zoom are live today." />,
        footer: <ModalBtn primary onClick={() => setModal(null)}>Got it</ModalBtn>,
      })
      return
    }
    setBusy(p.key)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }
      const res = await fetch(`${SUPA_URL}/functions/v1/${p.fn}?action=auth-url&platform=web`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'auth-url', platform: 'web' }),
      })
      const data = await res.json()
      if (data?.url) {
        window.location.href = data.url   // off to Google / Slack / Zoom consent
      } else {
        if (p.key === 'hubspot' && data?.error === 'provider_not_configured') {
          setBusy(null)
          setModal({
            title: 'Connect HubSpot',
            body: <HubspotConnectBody onDone={() => window.location.reload()} />,
          })
          return
        }
        const detail = data?.error === 'provider_not_configured'
          ? `${p.name} OAuth keys are not set on the server yet.`
          : (data?.error ?? 'Could not start the connection.')
        setBusy(null)
        setModal({
          title: 'Connection error',
          body: <ActionConfirmBody kind="escalate" title="Could not connect" desc={String(detail)} />,
          footer: <ModalBtn primary onClick={() => setModal(null)}>Close</ModalBtn>,
        })
      }
    } catch {
      setBusy(null)
      setModal({
        title: 'Connection error',
        body: <ActionConfirmBody kind="escalate" title="Could not connect" desc="Network error reaching the connection service. Try again." />,
        footer: <ModalBtn primary onClick={() => setModal(null)}>Close</ModalBtn>,
      })
    }
  }

  // Pull fresh data for an already-connected provider.
  async function sync(p: Provider) {
    if (!p.fn) return
    setSyncing(p.key)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }
      const res = await fetch(`${SUPA_URL}/functions/v1/${p.fn}?action=sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'sync', force: true }),
      })
      const data = await res.json()
      const inserted = data?.inserted ?? 0
      const signals = data?.signalCount ?? data?.signals ?? data?.signalsRaised ?? 0
      // Slack with nothing selected: point the user at channel selection instead
      // of reporting an empty sync.
      if (p.key === 'slack' && data?.tracked_channels === 0) {
        setModal({
          title: 'Choose channels first',
          body: <ActionConfirmBody kind="connect" title="No channels selected" desc="Popsicle needs to know which Slack channels to read. Choose channels, then Popsicle will start pulling signals." />,
          footer: <ModalBtn primary onClick={() => openSlackChannels(p)}>Choose channels</ModalBtn>,
        })
        return
      }
      setModal({
        title: 'Sync complete',
        body: <ActionConfirmBody kind="success" title={`${p.name} synced`} desc={data?.stub
          ? `${p.name} is connected. Data ingestion for this provider is coming soon.`
          : `Pulled ${inserted} new item${inserted === 1 ? '' : 's'}${signals ? `, raised ${signals} signal${signals === 1 ? '' : 's'}` : ''}.`} />,
        footer: <ModalBtn primary onClick={() => { setModal(null); window.location.reload() }}>Done</ModalBtn>,
      })
    } catch {
      setModal({
        title: 'Sync error',
        body: <ActionConfirmBody kind="escalate" title="Sync failed" desc="Could not reach the sync service. Try again in a moment." />,
        footer: <ModalBtn primary onClick={() => setModal(null)}>Close</ModalBtn>,
      })
    } finally {
      setSyncing(null)
    }
  }

  const liveCount = PROVIDERS.filter(p => active.includes(p.key)).length

  // Facts for the headline and the stat row, all drawn from real counts.
  const indexed30 = PROVIDERS.reduce((a, p) => a + (stats[p.key]?.thisMonth ?? 0), 0)
  const indexedAll = PROVIDERS.reduce((a, p) => a + (stats[p.key]?.total ?? 0), 0)
  // share of the last 30 days when we have it, all-time otherwise
  const shareBase = indexed30 > 0 ? indexed30 : indexedAll
  const leader = PROVIDERS
    .map(p => ({ name: p.name, n: (indexed30 > 0 ? stats[p.key]?.thisMonth : stats[p.key]?.total) ?? 0 }))
    .sort((a, b) => b.n - a.n)[0]
  const leaderShare = leader && shareBase > 0 ? Math.round((leader.n / shareBase) * 100) : 0
  // the two unconnected sources most worth naming, biggest gaps first
  const PITCH = ['salesforce', 'teams', 'outlook', 'gong', 'whatsapp', 'hubspot', 'slack', 'gmail', 'gcal', 'zoom', 'fireflies']
  const missing = PROVIDERS.filter(p => !active.includes(p.key))
    .sort((a, b) => PITCH.indexOf(a.key) - PITCH.indexOf(b.key)).slice(0, 2).map(p => p.short ?? p.name)
  const nothingLive = active.length === 0
  const NUMWORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
  const numWord = (n: number) => (n >= 0 && n <= 10 ? NUMWORD[n] : String(n))
  const feeding = indexed30 > 0 ? indexed30 : indexedAll
  const lastSync = (() => {
    const times = PROVIDERS.map(p => stats[p.key]?.lastSynced).filter(Boolean).map(t => new Date(t as string).getTime())
    if (!times.length) return null
    const mins = Math.round((Date.now() - Math.max(...times)) / 60000)
    return mins < 1 ? 'just now' : mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`
  })()

  // Actually call the disconnect edge action, then refresh.
  async function doDisconnect(p: Provider) {
    if (!p.fn) return
    setModal({
      title: 'Disconnecting',
      body: <ActionConfirmBody kind="connect" title={`Disconnecting ${p.name}`} desc="Revoking access and removing the connection..." />,
      footer: null,
    })
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }
      await fetch(`${SUPA_URL}/functions/v1/${p.fn}?action=disconnect`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'disconnect' }),
      })
      setModal({
        title: 'Disconnected',
        body: <ActionConfirmBody kind="success" title={`${p.name} disconnected`} desc="The connection has been removed. You can reconnect any time." />,
        footer: <ModalBtn primary onClick={() => { setModal(null); window.location.reload() }}>Done</ModalBtn>,
      })
    } catch {
      setModal({
        title: 'Error',
        body: <ActionConfirmBody kind="escalate" title="Could not disconnect" desc="Something went wrong. Try again in a moment." />,
        footer: <ModalBtn primary onClick={() => setModal(null)}>Close</ModalBtn>,
      })
    }
  }

  // Step 2: the confirmation guard against accidental taps.
  function confirmDisconnect(p: Provider) {
    setModal({
      title: 'Disconnect?',
      body: (
        <div style={{ textAlign: 'center', padding: '4px 4px 0' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(224,62,62,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Disconnect {p.name}?</div>
          <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.55, maxWidth: 320, margin: '0 auto' }}>Popsicle will stop reading from {p.name} and existing access will be revoked. Your past signals stay. You can reconnect any time.</div>
        </div>
      ),
      footer: (
        <>
          <ModalBtn onClick={() => detail(p)}>Cancel</ModalBtn>
          <button onClick={() => doDisconnect(p)} style={{ padding: '9px 18px', borderRadius: 10, background: 'var(--danger)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Yes, disconnect</button>
        </>
      ),
    })
  }

  // Slack channel picker: choose which channels Popsicle reads. On save, kick an
  // immediate sync so signals start flowing from the newly-tracked channels.
  function openSlackChannels(p: Provider) {
    setModal({
      title: 'Slack channels',
      body: (
        <SlackChannelPicker
          onCancel={() => detail(p)}
          onSaved={(count) => {
            if (count > 0) {
              // Close the picker and run a sync (shows its own result modal).
              setModal(null)
              sync(p)
            } else {
              setModal({
                title: 'Channels updated',
                body: <ActionConfirmBody kind="success" title="No channels tracked" desc="Popsicle will not read any Slack channels until you select some. Open Slack channels again to pick." />,
                footer: <ModalBtn primary onClick={() => setModal(null)}>Done</ModalBtn>,
              })
            }
          }}
        />
      ),
      footer: null,
    })
  }

  // The connected-integration detail sheet (stats + sync + disconnect).
  function detail(p: Provider, tOverride?: { slack?: boolean; hubspot?: boolean }) {
    const st = stats[p.key]
    const tNow = { ...resToggles, ...tOverride }
    const statBox = (val: React.ReactNode, label: string) => (
      <div style={{ flex: 1, background: 'var(--inset)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--t1)' }}>{val}</div>
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{label}</div>
      </div>
    )
    setModal({
      title: p.name,
      body: (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 12px' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--inset)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(1)', overflow: 'hidden' }}>
                <div style={{ transform: 'scale(1.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {LOGOS[p.key] ?? <span style={{ fontWeight: 800, color: 'var(--t2)', fontSize: 20 }}>{p.name[0]}</span>}
                </div>
              </div>
              <div style={{ position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: '50%', background: 'var(--ok)', border: '2.5px solid var(--surface, #fff)' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)' }}>{p.name}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>Connected</div>
            {st?.identity && <div style={{ fontSize: 11.5, color: 'var(--t2)', fontWeight: 700, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{st.identity}</div>}
          </div>
          <div style={{ fontSize: 13, color: 'var(--t2)', textAlign: 'center', lineHeight: 1.55, marginBottom: 18 }}>
            Popsicle is syncing from {p.name}. You can disconnect at any time.
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 8 }}>Activity</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            {statBox(st?.total ?? 0, 'Signals total')}
            {statBox(st?.thisMonth ?? 0, 'This month')}
          </div>
          {p.key === 'slack' ? (
            <>
            <button
              onClick={e => { e.stopPropagation(); setModal(null); setTimeout(() => openSlackChannels(p), 60) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--inset)', border: '1px solid var(--border)', cursor: 'pointer', marginBottom: 14, fontFamily: "'Outfit',sans-serif" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Choose channels</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>Pick which channels Popsicle reads</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
            <button
              onClick={() => { setModal(null); setBriefingOpen(true) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginTop: 8, borderRadius: 12, background: 'var(--inset)', border: '1px solid var(--border)', cursor: 'pointer', font: 'inherit' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Daily briefing settings</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>Post the top 5 risks to a channel every morning</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {statBox(p.fn === 'oauth-gcal' ? (st?.total ?? 0) : '0', p.fn === 'oauth-gcal' ? 'Events synced' : 'Items synced')}
              <div style={{ flex: 1 }} />
            </div>
          )}
          {(p.key === 'slack' || p.key === 'hubspot') && (
            <button
              onClick={async () => { const next = await flipResToggle(p); detail(p, { [p.key]: next } as { slack?: boolean; hubspot?: boolean }) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--inset)', border: '1px solid var(--border)', cursor: 'pointer', marginBottom: 14, fontFamily: "'Outfit',sans-serif" }}
            >
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{p.key === 'slack' ? 'Post ✓ when a signal is handled' : 'Log handled signals to the deal'}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>{p.key === 'slack' ? 'Appends "Handled by..." to the original Slack card' : 'Writes a Popsicle note on the matching HubSpot deal'}</div>
              </div>
              <ResSwitch on={!!tNow[p.key as 'slack' | 'hubspot']} />
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)' }} />{st?.high ?? 0} high</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--amber)' }} />{st?.watch ?? 0} watch</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)' }} />{st?.positive ?? 0} positive</span>
          </div>
          {st?.lastSignal && <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 10 }}>Last signal {fmtDate(st.lastSignal)}</div>}
        </div>
      ),
      footer: (
        <>
          <ModalBtn primary onClick={() => { setModal(null); sync(p) }}>{syncing === p.key ? 'Syncing...' : 'Sync now'}</ModalBtn>
          <button onClick={() => confirmDisconnect(p)} style={{ padding: '9px 18px', borderRadius: 10, background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Disconnect {p.name}</button>
        </>
      ),
    })
  }

  return (
    <div className="dsk-screen on">
      <PageHead
        eyebrow="Integrations"
        crumb={`${liveCount} active · ${PROVIDERS.length} available`}
        title={liveCount > 0
          ? <>
              {numWord(liveCount)} source{liveCount === 1 ? '' : 's'} feeding{' '}
              {feeding > 0 ? <><span style={{ color: 'var(--accent)' }}>{feeding.toLocaleString()} signal{feeding === 1 ? '' : 's'}</span></> : 'your pipeline'}
              {indexed30 > 0 ? <> in the last 30 days</> : null}.{' '}
              <span style={{ color: 'var(--ink-muted)' }}>
                {leader && leaderShare > 0 ? <>{leader.name} carries {leaderShare}% of the volume{missing.length ? '; ' : '.'}</> : null}
                {missing.length ? <>{missing.join(' and ')} {missing.length === 1 ? 'is' : 'are'} still unconnected.</> : null}
                {!leaderShare && !missing.length ? <>Every available source is connected.</> : null}
              </span>
            </>
          : <>No sources connected yet.{' '}<span style={{ color: 'var(--ink-muted)' }}>Connect Gmail or Slack and signals start arriving.</span></>}
      />
      {/* stats over the rule (design) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', paddingTop: 4, marginBottom: 20 }}>
        {[
          { n: String(liveCount), lbl: 'connected · all healthy', color: 'var(--good, #2f8f5b)' },
          { n: String(PROVIDERS.length - liveCount), lbl: 'available to connect', color: 'var(--accent, #E85A25)' },
          { n: indexedAll ? indexedAll.toLocaleString() : '--', lbl: 'signals indexed · all time', color: 'var(--ink)' },
          { n: indexed30 ? indexed30.toLocaleString() : '--', lbl: 'signals indexed · 30 days', color: 'var(--ink)' },
          { n: lastSync ?? '--', lbl: 'since last sync', color: lastSync ? 'var(--good, #2f8f5b)' : 'var(--ink-faint)' },
        ].map((st, i, arr) => (
          <div key={i} style={{ paddingRight: 32 }}>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.045em', fontSize: 40, lineHeight: 1, color: st.color, fontVariantNumeric: 'tabular-nums' }}>{st.n}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 8 }}>{st.lbl}</div>
          </div>
        ))}
      </div>

      {briefingOpen && <BriefingWindow onClose={() => setBriefingOpen(false)} />}
      {/* category label column + provider rows (design) */}
      {cats.map(cat => {
        const inCat = PROVIDERS.filter(p => p.cat === cat)
        const onCount = inCat.filter(p => active.includes(p.key)).length
        return (
          <div key={cat} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 24, marginTop: 'var(--gap-m)' }}>
            {/* rows carry 18px of top padding, so the label matches it */}
            <div style={{ paddingTop: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ink)' }}>{cat}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)', marginTop: 4 }}>{onCount} active</div>
            </div>
            <div>
              {inCat.map(p => {
                const on = active.includes(p.key)
                const live = !!p.fn
                return (
                  <div key={p.key} onClick={on ? () => { setSheet(p); setConfirmDc(false) } : undefined}
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px', alignItems: 'center', gap: 20, padding: '18px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: on ? 'pointer' : 'default' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</span>
                        {on && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good, #2f8f5b)' }} />}
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 3 }}>{p.desc}</div>
                      {on && (
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)', marginTop: 5 }}>
                          {stats[p.key]?.total ? `${stats[p.key]?.total} signals · ` : ''}{stats[p.key]?.lastSynced ? `synced ${new Date(stats[p.key]!.lastSynced!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'connected'}
                        </div>
                      )}
                    </div>
                    {on ? (
                      <button onClick={e => { e.stopPropagation(); setSheet(p); setConfirmDc(false) }}
                        className="btn-manage"
                        style={{ font: 'inherit', fontSize: 13, fontWeight: 600, padding: '9px 0', width: '100%', borderRadius: 0, border: '1px solid rgba(232,90,37,.28)', background: 'var(--accent-tint, #FFF1EA)', color: 'var(--accent, #E85A25)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Manage</button>
                    ) : live ? (
                      <button onClick={e => { e.stopPropagation(); connect(p) }} disabled={busy === p.key}
                        style={{ font: 'inherit', fontSize: 13, fontWeight: 600, padding: '9px 0', width: '100%', borderRadius: 0, border: 0, background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 6px 18px -6px rgba(255,107,53,.5)', opacity: busy === p.key ? .6 : 1 }}>
                        {busy === p.key ? 'Starting...' : 'Connect'}
                      </button>
                    ) : (
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-faint)', whiteSpace: 'nowrap', textAlign: 'center' }}>soon</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}


      {sheet && (() => {
        const p = sheet
        const st = stats[p.key]
        const on = active.includes(p.key)
        const isToggleable = p.key === 'slack' || p.key === 'hubspot'
        const fmtDate = (v?: string | null) => v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'
        const rows: Array<[string, string]> = [
          ['Status', on ? 'Connected and syncing' : 'Not connected'],
          ['Account', st?.identity || (on ? 'linked' : '--')],
          ['Signals raised', st ? String(st.total) : '--'],
          ['This month', st ? String(st.thisMonth) : '--'],
          ['Severity split', st ? `${st.high} high · ${st.watch} watch · ${st.positive} positive` : '--'],
          ['Last signal', fmtDate(st?.lastSignal)],
          ['Last synced', fmtDate(st?.lastSynced)],
          ['Connected', fmtDate(st?.connectedAt)],
        ]
        return (
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(14,13,11,.42)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 540, background: 'var(--paper, #FBF8F3)', padding: '36px 40px 40px', boxShadow: '0 40px 90px -30px rgba(14,13,11,.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '2.2px', textTransform: 'uppercase', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? 'var(--good, #2f8f5b)' : 'var(--ink-faint)' }} />integration
                </span>
                <button onClick={() => setSheet(null)} style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '2.2px', textTransform: 'uppercase', color: 'var(--ink-faint)', background: 'none', border: 0, cursor: 'pointer' }}>close</button>
              </div>

              <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 30, letterSpacing: '-.035em', margin: '12px 0 4px', color: 'var(--ink)' }}>{p.name}</h2>
              <div style={{ fontSize: 14, color: 'var(--ink-muted)' }}>{p.desc}</div>
              <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '22px 0 6px' }} />

              {rows.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '13px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                  <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>{k}</span>
                  <span style={{ fontSize: 14, color: 'var(--ink-muted)', textAlign: 'right' }}>{v}</span>
                </div>
              ))}

              {on && isToggleable && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '16px 2px 16px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                  <div>
                    <div style={{ fontSize: 14.5, color: 'var(--ink)' }}>{p.key === 'slack' ? 'Post ✓ when a signal is handled' : 'Log handled signals to the deal'}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{p.key === 'slack' ? 'Appends "Handled by…" to the original card' : 'Writes a Popsicle note on the matching deal'}</div>
                  </div>
                  <button onClick={async () => { await flipResToggle(p) }}
                    style={{ width: 38, minWidth: 38, height: 22, borderRadius: 0, border: 0, padding: 0, cursor: 'pointer', position: 'relative', flex: '0 0 38px',
                      background: resToggles[p.key as 'slack' | 'hubspot'] ? 'linear-gradient(135deg,#FF8A50,#FF6B35)' : 'var(--border, #E5DFD4)' }}>
                    <span style={{ position: 'absolute', top: 3, left: resToggles[p.key as 'slack' | 'hubspot'] ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .18s ease', boxShadow: '0 1px 2px rgba(14,13,11,.2)' }} />
                  </button>
                </div>
              )}

              {confirmDc && (
                <div style={{ marginTop: 18, padding: '14px 16px', border: '1px solid rgba(196,61,43,.25)', background: 'rgba(196,61,43,.05)' }}>
                  <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55 }}>Disconnect {p.name}? Popsicle stops reading this source. Signals already raised stay where they are.</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <button onClick={() => { setSheet(null); doDisconnect(p) }}
                      style={{ font: 'inherit', fontSize: 13, fontWeight: 600, padding: '9px 20px', borderRadius: 0, border: 0, background: 'var(--critical, #c43d2b)', color: '#fff', cursor: 'pointer' }}>Yes, disconnect</button>
                    <button onClick={() => setConfirmDc(false)}
                      style={{ font: 'inherit', fontSize: 13, fontWeight: 500, padding: '9px 20px', borderRadius: 0, border: 0, background: 'transparent', color: 'var(--ink-muted)', cursor: 'pointer' }}>Keep it</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 26, flexWrap: 'wrap' }}>
                {on ? (
                  <>
                    <button onClick={() => sync(p)} disabled={syncing === p.key}
                      style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '11px 24px', borderRadius: 0, border: 0, background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', cursor: 'pointer', boxShadow: '0 6px 18px -6px rgba(255,107,53,.5)', opacity: syncing === p.key ? .7 : 1 }}>
                      {syncing === p.key ? 'Syncing…' : 'Sync now'}
                    </button>
                    <button onClick={() => connect(p)}
                      style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '11px 22px', borderRadius: 0, border: '1px solid var(--border)', background: 'var(--raised, #FFFDFA)', color: 'var(--ink)', cursor: 'pointer' }}>Reconnect</button>
                    {p.key === 'slack' && (
                      <button onClick={() => { setSheet(null); setTimeout(() => openSlackChannels(p), 60) }}
                        style={{ font: 'inherit', fontSize: 13.5, fontWeight: 500, padding: '11px 22px', borderRadius: 0, border: 0, background: 'var(--inset, #F0EDE7)', color: 'var(--ink-muted)', cursor: 'pointer' }}>Channels</button>
                    )}
                    {p.key === 'slack' && (
                      <button onClick={() => { setSheet(null); setTimeout(() => setBriefingOpen(true), 60) }}
                        style={{ font: 'inherit', fontSize: 13.5, fontWeight: 500, padding: '11px 22px', borderRadius: 0, border: 0, background: 'var(--inset, #F0EDE7)', color: 'var(--ink)', cursor: 'pointer' }}>
                        Daily briefing
                      </button>
                    )}
                    <button onClick={() => setConfirmDc(true)}
                      style={{ font: 'inherit', fontSize: 13.5, fontWeight: 500, padding: '11px 18px', borderRadius: 0, border: 0, background: 'transparent', color: 'var(--critical, #c43d2b)', cursor: 'pointer', marginLeft: 'auto' }}>Disconnect</button>
                  </>
                ) : (
                  <button onClick={() => { setSheet(null); connect(p) }} disabled={!p.fn}
                    style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '11px 26px', borderRadius: 0, border: 0, background: p.fn ? 'linear-gradient(135deg,#FF8A50,#FF6B35)' : 'var(--inset)', color: p.fn ? '#fff' : 'var(--ink-faint)', cursor: p.fn ? 'pointer' : 'default' }}>
                    {p.fn ? `Connect ${p.name}` : 'Not available yet'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      <A360Modal config={modal} onClose={() => setModal(null)} />
    </div>
  )
}
