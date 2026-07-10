'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { A360Modal, ModalBtn, ModalConfig, ActionConfirmBody } from '@/components/account/A360Modal'
import { LOGOS } from './IntegrationsShowcase'
import { SlackChannelPicker } from './SlackChannels'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Providers whose OAuth + ingestion are live (reusing the Android backend).
// fn = the edge function slug. Others are shown as "coming soon".
type Provider = { key: string; name: string; desc: string; cat: string; fn?: string; token?: boolean }
const PROVIDERS: Provider[] = [
  { key: 'gmail', name: 'Gmail', desc: 'Reads sales threads · Detects tone & ghosting', cat: 'Email', fn: 'oauth-gmail' },
  { key: 'outlook', name: 'Outlook', desc: 'Microsoft 365 email · Same AI analysis', cat: 'Email' },
  { key: 'slack', name: 'Slack', desc: 'Shared channels · Flags quiet conversations', cat: 'Messaging', fn: 'oauth-slack' },
  { key: 'whatsapp', name: 'WhatsApp Business', desc: 'Buyer message patterns & sentiment', cat: 'Messaging' },
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

export function IntegrationsReal({ active, stats = {} }: { active: string[]; stats?: Record<string, ProviderStat> }) {
  const [modal, setModal] = useState<ModalConfig | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)

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

  const liveCount = PROVIDERS.filter(p => p.fn && active.includes(p.key)).length

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
  function detail(p: Provider) {
    const st = stats[p.key]
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
            <button
              onClick={() => openSlackChannels(p)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--inset)', border: '1px solid var(--border)', cursor: 'pointer', marginBottom: 14, fontFamily: "'Outfit',sans-serif" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Choose channels</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>Pick which channels Popsicle reads</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {statBox(p.fn === 'oauth-gcal' ? (st?.total ?? 0) : '0', p.fn === 'oauth-gcal' ? 'Events synced' : 'Items synced')}
              <div style={{ flex: 1 }} />
            </div>
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
      <div className="page-hdr"><h1>Integrations</h1><p>{liveCount} active · connect Gmail, Calendar, Slack, or Zoom to start pulling real signals</p></div>
      {cats.map(cat => (
        <div key={cat}>
          <div className="int-cat"><span className="int-cat-label">{cat}</span></div>
          <div className="int-grid" style={{ marginBottom: 10 }}>
            {PROVIDERS.filter(p => p.cat === cat).map(p => {
              const on = active.includes(p.key)
              const live = !!p.fn
              return (
                <div key={p.key} className={`int-card${on ? ' connected' : ''}`} onClick={on ? () => detail(p) : undefined} style={on ? { cursor: 'pointer' } : undefined}>
                  <div className="int-ico" style={{ background: 'var(--inset)' }}>{LOGOS[p.key] ?? <span style={{ fontWeight: 800, color: 'var(--t2)', fontSize: 13 }}>{p.name[0]}</span>}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>{p.desc}</div>
                  </div>
                  {on ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="int-signal" style={{ cursor: 'pointer' }}>Connected</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  ) : live ? (
                    <button onClick={() => connect(p)} disabled={busy === p.key} style={{ padding: '4px 12px', borderRadius: 8, background: 'rgba(255,107,53,.08)', border: '1px solid rgba(255,107,53,.2)', color: 'var(--o)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit'", opacity: busy === p.key ? 0.6 : 1 }}>{busy === p.key ? 'Starting...' : 'Connect'}</button>
                  ) : (
                    <span style={{ padding: '4px 12px', borderRadius: 8, background: 'var(--inset)', border: '1px solid var(--border)', color: 'var(--t4)', fontSize: 11, fontWeight: 700, fontFamily: "'Outfit'", whiteSpace: 'nowrap' }}>Coming soon</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <A360Modal config={modal} onClose={() => setModal(null)} />
    </div>
  )
}
