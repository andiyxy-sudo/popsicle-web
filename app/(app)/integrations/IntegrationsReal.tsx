'use client'

import { useState } from 'react'
import { A360Modal, ModalBtn, ModalConfig, ActionConfirmBody } from '@/components/account/A360Modal'

// Same catalog as the showcase, but connected-state is driven by the live integrations table.
const PROVIDERS: { key: string; name: string; desc: string; cat: string }[] = [
  { key: 'gmail', name: 'Gmail', desc: 'Reads sales threads · Detects tone & ghosting', cat: 'Email' },
  { key: 'outlook', name: 'Outlook', desc: 'Microsoft 365 email · Same AI analysis', cat: 'Email' },
  { key: 'slack', name: 'Slack', desc: 'Shared channels · Flags quiet conversations', cat: 'Messaging' },
  { key: 'whatsapp', name: 'WhatsApp Business', desc: 'Buyer message patterns & sentiment', cat: 'Messaging' },
  { key: 'hubspot', name: 'HubSpot', desc: 'Deal data sync · Churn probability signals', cat: 'CRM' },
  { key: 'salesforce', name: 'Salesforce', desc: 'Bi-directional sync · Opportunity health', cat: 'CRM' },
  { key: 'gong', name: 'Gong', desc: 'Revenue intelligence · Call insights', cat: 'Voice & Meetings' },
  { key: 'zoom', name: 'Zoom', desc: 'Call transcripts · Buyer sentiment analysis', cat: 'Voice & Meetings' },
]

export function IntegrationsReal({ active }: { active: string[] }) {
  const [modal, setModal] = useState<ModalConfig | null>(null)
  const cats = Array.from(new Set(PROVIDERS.map(p => p.cat)))

  function connect(name: string) {
    setModal({
      title: 'Connecting',
      body: <ActionConfirmBody kind="connect" title={`Connect ${name}`} desc="Redirecting to OAuth. Connection will be active within 2 minutes." />,
      footer: <ModalBtn primary onClick={() => setModal(null)}>Done</ModalBtn>,
    })
  }

  return (
    <div className="dsk-screen on">
      <div className="page-hdr"><h1>Integrations</h1><p>{active.length} active · connect more tools to widen signal coverage</p></div>
      {cats.map(cat => (
        <div key={cat}>
          <div className="int-cat"><span className="int-cat-label">{cat}</span></div>
          <div className="int-grid" style={{ marginBottom: 10 }}>
            {PROVIDERS.filter(p => p.cat === cat).map(p => {
              const on = active.includes(p.key)
              return (
                <div key={p.key} className={`int-card${on ? ' connected' : ''}`}>
                  <div className="int-ico" style={{ background: 'var(--inset)', fontWeight: 800, color: 'var(--t2)', fontSize: 13 }}>{p.name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>{p.desc}</div>
                  </div>
                  {on ? <span className="int-signal" style={{ cursor: 'default' }}>Connected</span>
                    : <button onClick={() => connect(p.name)} style={{ padding: '4px 12px', borderRadius: 8, background: 'rgba(255,107,53,.08)', border: '1px solid rgba(255,107,53,.2)', color: 'var(--o)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit'" }}>Connect</button>}
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
