'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { A360Modal, ModalBtn, ModalConfig, ActionConfirmBody } from '@/components/account/A360Modal'
import { LOGOS } from './IntegrationsShowcase'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Providers whose OAuth + ingestion are live (reusing the Android backend).
// fn = the edge function slug. Others are shown as "coming soon".
type Provider = { key: string; name: string; desc: string; cat: string; fn?: string }
const PROVIDERS: Provider[] = [
  { key: 'gmail', name: 'Gmail', desc: 'Reads sales threads · Detects tone & ghosting', cat: 'Email', fn: 'oauth-gmail' },
  { key: 'outlook', name: 'Outlook', desc: 'Microsoft 365 email · Same AI analysis', cat: 'Email' },
  { key: 'slack', name: 'Slack', desc: 'Shared channels · Flags quiet conversations', cat: 'Messaging', fn: 'oauth-slack' },
  { key: 'whatsapp', name: 'WhatsApp Business', desc: 'Buyer message patterns & sentiment', cat: 'Messaging' },
  { key: 'gcal', name: 'Google Calendar', desc: 'Meeting cadence · Engagement drop detection', cat: 'Calendar', fn: 'oauth-gcal' },
  { key: 'hubspot', name: 'HubSpot', desc: 'Deal data sync · Churn probability signals', cat: 'CRM' },
  { key: 'salesforce', name: 'Salesforce', desc: 'Bi-directional sync · Opportunity health', cat: 'CRM' },
  { key: 'gong', name: 'Gong', desc: 'Revenue intelligence · Call insights', cat: 'Voice & Meetings' },
  { key: 'zoom', name: 'Zoom', desc: 'Call transcripts · Buyer sentiment analysis', cat: 'Voice & Meetings', fn: 'oauth-zoom' },
]

const CAT_ORDER = ['Email', 'Messaging', 'Calendar', 'CRM', 'Voice & Meetings']

export type ProviderStat = {
  total: number; thisMonth: number; high: number; watch: number; positive: number
  lastSignal: string | null; connectedAt: string | null; lastSynced: string | null
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
  const cats = CAT_ORDER.filter(c => PROVIDERS.some(p => p.cat === c))

  // Kick off real OAuth: ask the edge function for the consent URL (with our JWT
  // + platform=web), then send the browser there. The function will 302 back to
  // /integrations/callback when done.
  async function connect(p: Provider) {
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
      const signals = data?.signalCount ?? data?.signalsRaised ?? 0
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
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(42,157,92,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--ok)' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)' }}>{p.name}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>Connected</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--t2)', textAlign: 'center', lineHeight: 1.55, marginBottom: 18 }}>
            Popsicle is syncing from {p.name}. You can disconnect at any time.
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 8 }}>Activity</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            {statBox(st?.total ?? 0, 'Signals total')}
            {statBox(st?.thisMonth ?? 0, 'This month')}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            {statBox(p.fn === 'oauth-gcal' ? (st?.total ?? 0) : '0', p.fn === 'oauth-gcal' ? 'Events synced' : 'Items synced')}
            <div style={{ flex: 1 }} />
          </div>
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
