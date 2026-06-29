'use client'

import { useState } from 'react'
import { A360Modal, ModalBtn, ModalConfig, ActionConfirmBody } from '@/components/account/A360Modal'

const chevron = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
const syncIco = <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 2v6h-6M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6M21 12a9 9 0 01-15 6.7L3 16"/></svg>

// Brand logos as inline SVG (ported from prototype)
export const LOGOS: Record<string, React.ReactNode> = {
  gmail: <svg width="20" height="15" viewBox="0 0 24 18"><rect width="24" height="18" rx="2.5" fill="#fff"/><rect x=".5" y=".5" width="23" height="17" rx="2" fill="none" stroke="#ddd" strokeWidth=".5"/><path d="M2 2l10 7.5L22 2" stroke="#EA4335" strokeWidth="2.2" fill="none" strokeLinecap="round"/></svg>,
  outlook: <svg width="20" height="20" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#0078D4"/><rect x="10" y="28" width="50" height="44" rx="4" fill="#fff" fillOpacity=".95"/><text x="35" y="56" textAnchor="middle" fontFamily="Calibri,Arial,sans-serif" fontSize="22" fontWeight="700" fill="#0078D4">Oa</text><rect x="60" y="36" width="32" height="28" rx="3" fill="#5BA3E0"/><path d="M60 38l16 10 16-10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>,
  linkedin: <svg width="20" height="20" viewBox="0 0 48 48"><rect width="48" height="48" rx="6" fill="#0A66C2"/><rect x="9" y="20" width="7" height="20" rx="1" fill="#fff"/><circle cx="12.5" cy="13" r="4" fill="#fff"/><path d="M22 20h6v3.2c1-1.8 3.2-3.7 6.5-3.7 6 0 8.5 3.5 8.5 9V40h-7V28.5c0-2.8-.8-4.5-3-4.5-2.8 0-4.5 2.2-4.5 5.5V40H22V20z" fill="#fff"/></svg>,
  teams: <svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#5059C9"/><rect x="2" y="6" width="13" height="14" rx="2" fill="#7B83EB"/><text x="8.5" y="17" textAnchor="middle" fontFamily="Arial" fontSize="11" fontWeight="900" fill="#fff">T</text><circle cx="19" cy="8" r="2.5" fill="#fff"/></svg>,
  slack: <svg width="20" height="20" viewBox="0 0 200 200"><rect width="200" height="200" rx="44" fill="#fff"/><rect x="55" y="55" width="35" height="90" rx="17.5" fill="#E01E5A"/><rect x="55" y="55" width="90" height="35" rx="17.5" fill="#36C5F0"/><rect x="110" y="55" width="35" height="90" rx="17.5" fill="#2EB67D"/><rect x="55" y="110" width="90" height="35" rx="17.5" fill="#ECB22E"/><circle cx="72.5" cy="72.5" r="17.5" fill="#E01E5A"/><circle cx="127.5" cy="72.5" r="17.5" fill="#36C5F0"/><circle cx="127.5" cy="127.5" r="17.5" fill="#2EB67D"/><circle cx="72.5" cy="127.5" r="17.5" fill="#ECB22E"/></svg>,
  whatsapp: <svg width="20" height="20" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#25D366"/><path d="M34.5 29.3c-.5-.2-2.8-1.4-3.3-1.5-.4-.2-.8-.2-1.1.2-.3.5-1.2 1.5-1.5 1.8-.3.3-.5.4-1 .1-.5-.2-2-.7-3.8-2.3-1.4-1.2-2.3-2.8-2.6-3.2-.3-.5 0-.7.2-1 .2-.2.5-.5.7-.8.2-.3.3-.5.4-.8.1-.3 0-.6-.1-.8-.1-.2-1.1-2.7-1.5-3.7-.4-.9-.8-.8-1.1-.8h-.9c-.3 0-.8.1-1.2.6-.4.4-1.6 1.6-1.6 3.8s1.6 4.4 1.8 4.7c.2.3 3.2 4.9 7.8 6.9 4.5 1.9 4.5 1.3 5.3 1.2.8-.1 2.8-1.1 3.2-2.2.4-1.1.4-2 .3-2.2z" fill="#fff"/></svg>,
  hubspot: <svg width="20" height="20" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#FF7A59"/><circle cx="68" cy="28" r="11" fill="none" stroke="#fff" strokeWidth="6"/><line x1="68" y1="39" x2="68" y2="50" stroke="#fff" strokeWidth="6" strokeLinecap="round"/><circle cx="50" cy="65" r="14" fill="none" stroke="#fff" strokeWidth="6"/><line x1="50" y1="51" x2="50" y2="39" stroke="#fff" strokeWidth="6" strokeLinecap="round"/><line x1="23" y1="65" x2="36" y2="65" stroke="#fff" strokeWidth="6" strokeLinecap="round"/><circle cx="20" cy="65" r="9" fill="none" stroke="#fff" strokeWidth="6"/></svg>,
  salesforce: <svg width="22" height="16" viewBox="0 0 66 46"><path d="M27.7 7.5a13.2 13.2 0 019.8-4.4c5 0 9.4 2.8 11.7 6.9a14.2 14.2 0 015.4-1c7.9 0 14.3 6.5 14.3 14.5S62.5 38 54.6 38c-.9 0-1.8-.1-2.7-.3A10.4 10.4 0 0142 43.2c-1.8 0-3.6-.5-5.1-1.3A12.8 12.8 0 0124.8 48a12.7 12.7 0 01-11.5-7.4A10.5 10.5 0 010 31.2c0-4.6 2.9-8.5 7-10.1a13 13 0 01-.5-3.6C6.5 10 12 4.5 18.8 4.5c3.4 0 6.4 1.2 8.9 3z" fill="#00A1E0"/></svg>,
  zoho: <svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#E42527"/><text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff" fontFamily="Arial">Z</text></svg>,
  fireflies: <svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#7C3AED"/><text x="12" y="16.5" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff" fontFamily="Arial">F.ai</text></svg>,
  gong: <svg width="20" height="20" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#7B2FBE"/><text x="50" y="72" textAnchor="middle" fontFamily="Georgia,Times,serif" fontSize="62" fontWeight="700" fill="#fff">g</text></svg>,
  gmeet: <svg width="20" height="20" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#fff"/><rect x="4" y="13" width="11" height="11" rx="2" fill="#4285F4"/><rect x="4" y="26" width="11" height="9" rx="2" fill="#34A853"/><rect x="17" y="21" width="9" height="14" rx="2" fill="#FBBC04"/><rect x="17" y="13" width="9" height="8" rx="2" fill="#EA4335"/><path d="M30 17.5l14-8v29l-14-8v-13z" fill="#34A853"/><rect x="26" y="17" width="6" height="14" rx="1" fill="#1E8E3E"/></svg>,
  miitel: <svg width="20" height="20" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#fff"/><rect x="4" y="18" width="5" height="10" rx="2.5" fill="#4FC3F7"/><rect x="11" y="13" width="5" height="15" rx="2.5" fill="#2196F3"/><rect x="18" y="9" width="5" height="22" rx="2.5" fill="#00BCD4"/><rect x="25" y="14" width="5" height="14" rx="2.5" fill="#2196F3"/><rect x="32" y="19" width="5" height="9" rx="2.5" fill="#00E5FF"/></svg>,
  zoom: <svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#2D8CFF"/><path d="M6.5 8.5v7a1.5 1.5 0 001.5 1.5h5a1.5 1.5 0 001.5-1.5v-7a1.5 1.5 0 00-1.5-1.5H8a1.5 1.5 0 00-1.5 1.5z" fill="#fff"/><path d="M14.5 10.5l3-2v7l-3-2" fill="#fff"/></svg>,
  calendly: <svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#006BFF"/><circle cx="12" cy="12" r="6" fill="none" stroke="#fff" strokeWidth="2"/><path d="M12 9v3l2 2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  gcal: <svg width="20" height="20" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#fff" stroke="#E0E0E0" strokeWidth="2"/><rect x="1" y="14" width="98" height="28" fill="#1A73E8"/><rect x="1" y="38" width="98" height="4" fill="#E8EAED"/><rect x="27" y="1" width="12" height="20" rx="6" fill="#1A73E8"/><rect x="61" y="1" width="12" height="20" rx="6" fill="#1A73E8"/><text x="50" y="82" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="34" fontWeight="700" fill="#3C4043">17</text></svg>,
  mscal: <svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#0078D4"/><rect x="2" y="2" width="9" height="9" rx="1" fill="#fff"/><rect x="13" y="2" width="9" height="9" rx="1" fill="#fff" opacity=".6"/><rect x="2" y="13" width="9" height="9" rx="1" fill="#fff" opacity=".6"/><rect x="13" y="13" width="9" height="9" rx="1" fill="#fff" opacity=".4"/></svg>,
  gdrive: <svg width="20" height="20" viewBox="0 0 24 24"><path d="M8.5 2.5L1.2 14.8h5.5l7.3-12.3H8.5z" fill="#0066DA"/><path d="M22.8 14.8L15.5 2.5h-5.5l7.3 12.3h5.5z" fill="#00AC47"/><path d="M1.2 14.8l3.5 6.2h14.6l3.5-6.2H1.2z" fill="#FFBA00"/></svg>,
  notion: <svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#1C1C1C"/><text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff" fontFamily="Arial">N</text></svg>,
  freshdesk: <svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#28A745"/><path d="M7 12h10M12 7v10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  snowflake: <svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#29B5E8"/><path d="M12 4v16M4 12h16M6.3 6.3l11.4 11.4M17.7 6.3L6.3 17.7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  stripe: <svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#635BFF"/><path d="M10.5 9.5c0-.8.7-1.1 1.8-1.1 1.6 0 3.5.5 4.7 1.2V6.4c-1.3-.5-2.5-.7-4.7-.7-3.8 0-6.3 2-6.3 5.2 0 5.1 7 4.3 7 6.5 0 .9-.8 1.2-2 1.2-1.7 0-3.8-.7-5.5-1.7v3.2c1.8.8 3.7 1.1 5.5 1.1 4 0 6.7-2 6.7-5.3 0-5.4-7-4.5-7-6.4z" fill="#fff"/></svg>,
  zendesk: <svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#03363D"/><text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fff" fontFamily="Arial">ZD</text></svg>,
}

interface Card { key: string; name: string; desc: string; iconBg: string; iconBorder?: boolean; connected?: boolean; count?: number }
interface Cat { label: string; count: string; icon: React.ReactNode; cards: Card[] }

const wm = (border = false) => border ? { background: 'rgba(255,255,255,.95)', border: '1.5px solid rgba(0,0,0,.07)' } : undefined

const CATS: Cat[] = [
  { label: 'Email', count: '1 active', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8l10 6 10-6"/></svg>, cards: [
    { key: 'gmail', name: 'Gmail', desc: 'Reads sales threads · Detects tone & ghosting', iconBg: 'rgba(234,67,53,.06)', connected: true, count: 372 },
    { key: 'outlook', name: 'Outlook', desc: 'Microsoft 365 email · Same AI analysis', iconBg: '', iconBorder: true },
  ] },
  { label: 'Messaging', count: '3 active', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, cards: [
    { key: 'linkedin', name: 'LinkedIn', desc: 'Connection signals · Champion activity tracking', iconBg: '', iconBorder: true, connected: true, count: 128 },
    { key: 'teams', name: 'Microsoft Teams', desc: 'Chat & channel signal monitoring', iconBg: 'rgba(80,89,201,.06)' },
    { key: 'slack', name: 'Slack', desc: 'Shared channels · Flags quiet conversations', iconBg: '', iconBorder: true, connected: true, count: 152 },
    { key: 'whatsapp', name: 'WhatsApp Business', desc: 'Buyer message patterns & sentiment', iconBg: 'rgba(37,211,102,.06)', connected: true, count: 251 },
  ] },
  { label: 'CRM', count: '1 active', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>, cards: [
    { key: 'hubspot', name: 'HubSpot', desc: 'Deal data sync · Churn probability signals', iconBg: '', iconBorder: true, connected: true, count: 94 },
    { key: 'salesforce', name: 'Salesforce', desc: 'Bi-directional sync · Opportunity health', iconBg: 'rgba(0,161,224,.06)' },
    { key: 'zoho', name: 'Zoho CRM', desc: 'Pipeline sync · Deal stage tracking', iconBg: 'rgba(228,37,39,.06)' },
  ] },
  { label: 'Voice & Meetings', count: '2 active', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>, cards: [
    { key: 'fireflies', name: 'Fireflies.ai', desc: 'Auto-transcribe · Extract action items', iconBg: 'rgba(124,58,237,.06)' },
    { key: 'gong', name: 'Gong', desc: 'Revenue intelligence · Call insights', iconBg: '', iconBorder: true, connected: true, count: 58 },
    { key: 'gmeet', name: 'Google Meet', desc: 'Meeting transcription · Engagement scoring', iconBg: '', iconBorder: true },
    { key: 'miitel', name: 'MiiTel', desc: 'Voice analytics · Hesitation & objection detection', iconBg: '', iconBorder: true },
    { key: 'zoom', name: 'Zoom', desc: 'Call transcripts · Buyer sentiment analysis', iconBg: 'rgba(45,140,255,.06)', connected: true, count: 72 },
  ] },
  { label: 'Calendar', count: '3 available', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>, cards: [
    { key: 'calendly', name: 'Calendly', desc: 'Auto-detect bookings & cancellations', iconBg: 'rgba(0,107,255,.06)' },
    { key: 'gcal', name: 'Google Calendar', desc: 'Meeting cadence · Engagement drop detection', iconBg: '', iconBorder: true },
    { key: 'mscal', name: 'Microsoft Calendar', desc: 'Outlook sync · Meeting frequency analysis', iconBg: 'rgba(0,120,212,.06)' },
  ] },
  { label: 'Productivity', count: '2 available', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, cards: [
    { key: 'gdrive', name: 'Google Drive', desc: 'Proposals · Contracts · Shared docs', iconBg: 'rgba(66,133,244,.06)' },
    { key: 'notion', name: 'Notion', desc: 'Deal notes · Meeting summaries · Account wikis', iconBg: 'rgba(28,28,28,.06)' },
  ] },
  { label: 'Support & Data', count: '4 available', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, cards: [
    { key: 'freshdesk', name: 'Freshdesk', desc: 'Ticket volume · Churn correlation', iconBg: 'rgba(40,167,69,.06)' },
    { key: 'snowflake', name: 'Snowflake', desc: 'Data warehouse · Product usage enrichment', iconBg: 'rgba(41,181,232,.06)' },
    { key: 'stripe', name: 'Stripe', desc: 'Payment status · Failed payment alerts', iconBg: 'rgba(99,91,255,.06)' },
    { key: 'zendesk', name: 'Zendesk', desc: 'Support ticket sentiment · Escalation alerts', iconBg: 'rgba(3,54,61,.06)' },
  ] },
]

export function IntegrationsShowcase() {
  const [modal, setModal] = useState<ModalConfig | null>(null)
  const [synced, setSynced] = useState<Record<string, boolean>>({})

  function connect() {
    setModal({
      title: 'Connecting',
      body: <ActionConfirmBody kind="connect" title="Connection Started" desc="Redirecting to OAuth. Connection will be active within 2 minutes." />,
      footer: <ModalBtn primary onClick={() => setModal(null)}>Done</ModalBtn>,
    })
  }
  function sync(key: string) {
    setSynced(s => ({ ...s, [key]: true }))
    setTimeout(() => setSynced(s => ({ ...s, [key]: false })), 1400)
  }

  return (
    <div className="dsk-screen on">
      <div className="page-hdr"><h1>Integrations</h1><p>7 active · <span style={{ fontWeight: 700, color: 'var(--o)' }}>847 signals</span> indexed · 18 more available to connect</p></div>

      {CATS.map(cat => (
        <div key={cat.label}>
          <div className="int-cat">
            <div className="int-cat-ico">{cat.icon}</div>
            <span className="int-cat-label">{cat.label}</span>
            <span className="int-cat-count">{cat.count}</span>
            {chevron}
          </div>
          <div className="int-grid" style={{ marginBottom: 10 }}>
            {cat.cards.map(card => (
              <div key={card.key} className={`int-card${card.connected ? ' connected' : ''}`}>
                <div className="int-ico" style={card.iconBorder ? wm(true) : { background: card.iconBg }}>{LOGOS[card.key]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{card.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--t3)' }}>{card.desc}</div>
                </div>
                {card.connected ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <span className="int-signal" style={{ cursor: 'default' }}>✓{card.count}</span>
                      <span style={{ fontSize: 10, color: 'var(--t4)' }}>{synced[card.key] ? 'just now' : '2m ago'}</span>
                    </div>
                    <button onClick={() => sync(card.key)} title="Sync now" style={{ marginLeft: 6, padding: '3px 9px', borderRadius: 7, background: 'var(--inset)', border: '1px solid var(--border)', fontSize: 10, fontWeight: 600, color: 'var(--t2)', cursor: 'pointer', fontFamily: 'Outfit,sans-serif', display: 'flex', alignItems: 'center', gap: 3 }}>{syncIco}{synced[card.key] ? 'Syncing' : 'Sync'}</button>
                  </>
                ) : (
                  <button onClick={connect} style={{ padding: '4px 12px', borderRadius: 8, background: 'rgba(255,107,53,.08)', border: '1px solid rgba(255,107,53,.2)', color: 'var(--o)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit'" }}>Connect</button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <A360Modal config={modal} onClose={() => setModal(null)} />
    </div>
  )
}
