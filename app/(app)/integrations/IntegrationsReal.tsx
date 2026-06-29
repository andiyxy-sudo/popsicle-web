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

export function IntegrationsReal({ active }: { active: string[] }) {
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
                <div key={p.key} className={`int-card${on ? ' connected' : ''}`}>
                  <div className="int-ico" style={{ background: 'var(--inset)' }}>{LOGOS[p.key] ?? <span style={{ fontWeight: 800, color: 'var(--t2)', fontSize: 13 }}>{p.name[0]}</span>}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}{!live && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t4)', marginLeft: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>soon</span>}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>{p.desc}</div>
                  </div>
                  {on ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="int-signal" style={{ cursor: 'default' }}>Connected</span>
                      <button onClick={() => sync(p)} disabled={syncing === p.key} style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--inset)', border: '1px solid var(--border)', fontSize: 10, fontWeight: 600, color: 'var(--t2)', cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>{syncing === p.key ? 'Syncing...' : 'Sync'}</button>
                    </div>
                  ) : (
                    <button onClick={() => connect(p)} disabled={busy === p.key} style={{ padding: '4px 12px', borderRadius: 8, background: 'rgba(255,107,53,.08)', border: '1px solid rgba(255,107,53,.2)', color: 'var(--o)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit'", opacity: busy === p.key ? 0.6 : 1 }}>{busy === p.key ? 'Starting...' : 'Connect'}</button>
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
