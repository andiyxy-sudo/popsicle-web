'use client'

import { Integration } from '@/types'
import { integrationLabel } from '@/lib/utils'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

interface IntegrationsClientProps {
  integrations: Integration[]
  userId: string
}

interface ProviderConfig {
  provider: string
  description: string
  icon: React.ReactNode
  available: boolean
  category: 'communication' | 'meetings' | 'crm'
}

const PROVIDERS: ProviderConfig[] = [
  {
    provider: 'gmail',
    description: 'Read email threads to detect deal signals and contact activity.',
    available: true,
    category: 'communication',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.8" fill="none"/>
        <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.8" fill="none"/>
      </svg>
    ),
  },
  {
    provider: 'gcal',
    description: 'Sync meetings and calendar events to track engagement cadence.',
    available: true,
    category: 'meetings',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.8"/>
        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.8"/>
        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.8"/>
      </svg>
    ),
  },
  {
    provider: 'slack',
    description: 'Ingest channel messages and post signal alerts to a Slack channel.',
    available: true,
    category: 'communication',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/>
        <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/>
        <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/>
        <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/>
        <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
        <path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/>
        <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/>
      </svg>
    ),
  },
  {
    provider: 'zoom',
    description: 'Ingest call transcripts and analyze buyer sentiment, objections, and commitments.',
    available: true,
    category: 'meetings',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
  },
  {
    provider: 'hubspot',
    description: 'Sync deals, contacts, and pipeline stages from HubSpot CRM.',
    available: false,
    category: 'crm',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 12h8M12 8v8"/>
      </svg>
    ),
  },
  {
    provider: 'salesforce',
    description: 'Pull opportunity data from Salesforce to enrich account context.',
    available: false,
    category: 'crm',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M18 20V10M12 20V4M6 20v-6"/>
      </svg>
    ),
  },
]

function getOAuthUrl(provider: string): string {
  const state = Math.random().toString(36).slice(2)
  return `${SUPA_URL}/functions/v1/oauth-${provider}?action=authorize&state=${state}`
}

export function IntegrationsClient({ integrations, userId }: IntegrationsClientProps) {
  const intMap = Object.fromEntries(integrations.map(i => [i.provider, i]))

  const byCategory = {
    communication: PROVIDERS.filter(p => p.category === 'communication'),
    meetings: PROVIDERS.filter(p => p.category === 'meetings'),
    crm: PROVIDERS.filter(p => p.category === 'crm'),
  }

  return (
    <div>
      {(Object.entries(byCategory) as [string, ProviderConfig[]][]).map(([cat, providers]) => (
        <div key={cat} style={{ marginBottom: 36 }}>
          <h2 style={{
            fontSize: 11, fontWeight: 700, color: 'var(--t4)',
            textTransform: 'uppercase', letterSpacing: '1.5px',
            fontFamily: "'DM Mono', monospace", marginBottom: 12,
          }}>
            {cat === 'communication' ? 'Communication' : cat === 'meetings' ? 'Meetings' : 'CRM'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {providers.map(p => {
              const existing = intMap[p.provider]
              const isConnected = existing?.is_active
              const needsReconnect = existing?.needs_reconnect

              return (
                <div key={p.provider} style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--r)',
                  padding: '20px',
                  boxShadow: 'var(--sh-sm)',
                  border: needsReconnect
                    ? '1px solid var(--amber-bd)'
                    : isConnected
                    ? '1px solid var(--ok-bd)'
                    : '1px solid var(--border-soft)',
                  opacity: !p.available ? 0.6 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                      background: isConnected && !needsReconnect ? 'var(--ok-bg)' : 'var(--inset)',
                      border: `1px solid ${isConnected && !needsReconnect ? 'var(--ok-bd)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isConnected && !needsReconnect ? 'var(--ok)' : 'var(--t3)',
                    }}>
                      {p.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>
                          {integrationLabel(p.provider)}
                        </h3>
                        {!p.available && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '2px 7px',
                            borderRadius: 6, background: 'var(--inset)',
                            border: '1px solid var(--border)', color: 'var(--t4)',
                            fontFamily: "'DM Mono', monospace", textTransform: 'uppercase',
                          }}>
                            Coming soon
                          </span>
                        )}
                        {needsReconnect && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '2px 7px',
                            borderRadius: 6, background: 'var(--amber-bg)',
                            border: '1px solid var(--amber-bd)', color: 'var(--amber)',
                            fontFamily: "'DM Mono', monospace", textTransform: 'uppercase',
                          }}>
                            Reconnect
                          </span>
                        )}
                        {isConnected && !needsReconnect && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '2px 7px',
                            borderRadius: 6, background: 'var(--ok-bg)',
                            border: '1px solid var(--ok-bd)', color: 'var(--ok)',
                            fontFamily: "'DM Mono', monospace", textTransform: 'uppercase',
                          }}>
                            Connected
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5, marginBottom: 14 }}>
                        {p.description}
                      </p>
                      {p.available && (
                        <button
                          onClick={() => {
                            if (!needsReconnect && isConnected) return
                            window.location.href = getOAuthUrl(p.provider)
                          }}
                          style={{
                            padding: '7px 16px',
                            borderRadius: 'var(--r-sm)',
                            border: 'none',
                            fontSize: 12, fontWeight: 600,
                            cursor: isConnected && !needsReconnect ? 'default' : 'pointer',
                            fontFamily: "'Outfit', sans-serif",
                            background: needsReconnect
                              ? 'var(--amber)'
                              : isConnected
                              ? 'var(--inset)'
                              : 'var(--o)',
                            color: needsReconnect || isConnected ? (needsReconnect ? '#fff' : 'var(--t3)') : '#fff',
                            transition: 'all .15s',
                          }}
                        >
                          {needsReconnect ? 'Reconnect' : isConnected ? 'Connected' : 'Connect'}
                        </button>
                      )}
                      {existing?.team_name && (
                        <p style={{ marginTop: 8, fontSize: 11, color: 'var(--t4)' }}>
                          Workspace: {existing.team_name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
