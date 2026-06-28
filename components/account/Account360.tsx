'use client'

import { useState, useEffect } from 'react'
import { A360Modal, ModalBtn, ModalConfig } from './A360Modal'

export interface SigItem { sev: 'danger' | 'warn' | 'ok'; msg: string; time: string; via: string }
export interface CommItem { from: string; role: string; msg: string; time: string; via: string; dir: 'in' | 'out'; signal?: string; signalColor?: string }
export interface PersonItem { name: string; role: string; badge?: string; badgeColor?: string; status: string; statusColor: string; last: string; eng: number; desc?: string }
export interface TimelineItem { title: string; time: string; desc: string; color: string }
export interface ContractItem { name: string; type: string; status: string; statusColor: string; value: string; po: string; start: string; end: string; invoice: string }

export interface A360Data {
  id: string
  name: string
  contact: string
  stage: string
  arr: string
  health: number
  signals: number
  daysDark: number | string
  risk: string
  rep: string
  lastTouch: string
  monogram?: string
  tags?: [string, string][]
  brief?: string[]
  briefTypes?: ('danger' | 'warn' | 'ok')[]
  healthBars?: { label: string; val: number; color: string }[]
  sigItems?: SigItem[]
  comms?: CommItem[]
  people?: PersonItem[]
  timeline?: TimelineItem[]
  contracts?: ContractItem[]
}

function riskClass(risk: string) {
  const r = risk.toUpperCase()
  if (r === 'HIGH') return 'rhi'
  if (r === 'MEDIUM' || r === 'MED') return 'rmd'
  return 'rlo'
}
function healthColor(h: number) { return h < 40 ? 'var(--danger)' : h < 65 ? 'var(--amber)' : 'var(--ok)' }
function healthStroke(h: number) { return h < 40 ? '#F87171' : h < 65 ? '#FBBF24' : '#4ADE80' }

const viaIcon = (via: string) => {
  if (via === 'Slack') return <svg width="16" height="16" viewBox="0 0 128 128"><path d="M27.2 80.7c0 7.3-6 13.3-13.3 13.3S.6 88 .6 80.7s6-13.3 13.3-13.3h13.3v13.3z" fill="#E01E5A"/><path d="M47.2 27.2c-7.3 0-13.3-6-13.3-13.3S39.9.6 47.2.6s13.3 6 13.3 13.3v13.3H47.2z" fill="#36C5F0"/><path d="M100.7 47.2c0-7.3 6-13.3 13.3-13.3s13.3 6 13.3 13.3-6 13.3-13.3 13.3h-13.3V47.2z" fill="#2EB67D"/><path d="M80.7 100.7c7.3 0 13.3 6 13.3 13.3s-6 13.3-13.3 13.3-13.3-6-13.3-13.3v-13.3h13.3z" fill="#ECB22E"/></svg>
  if (via === 'WhatsApp') return <svg width="16" height="16" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#25D366"/><path d="M34.5 29.3c-.5-.2-2.8-1.4-3.3-1.5-.4-.2-.8-.2-1.1.2-.3.5-1.2 1.5-1.5 1.8-.3.3-.5.4-1 .1-.5-.2-2-.7-3.8-2.3-1.4-1.2-2.3-2.8-2.6-3.2-.3-.5 0-.7.2-1 .2-.2.5-.5.7-.8.2-.3.3-.5.4-.8.1-.3 0-.6-.1-.8-.1-.2-1.1-2.7-1.5-3.7-.4-.9-.8-.8-1.1-.8h-.9c-.3 0-.8.1-1.2.6-.4.4-1.6 1.6-1.6 3.8s1.6 4.4 1.8 4.7c.2.3 3.2 4.9 7.8 6.9 4.5 1.9 4.5 1.3 5.3 1.2.8-.1 2.8-1.1 3.2-2.2.4-1.1.4-2 .3-2.2z" fill="#fff"/></svg>
  if (via === 'Zoom') return <svg width="16" height="16" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#2D8CFF"/><path d="M14 18h12c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H14c-1.1 0-2-.9-2-2v-8c0-1.1.9-2 2-2zm18 2l6-4v16l-6-4V20z" fill="#fff"/></svg>
  return <svg width="16" height="13" viewBox="0 0 24 18"><rect width="24" height="18" rx="2.5" fill="#fff"/><rect x=".5" y=".5" width="23" height="17" rx="2" fill="none" stroke="#ddd" strokeWidth=".5"/><path d="M2 2l10 7.5L22 2" stroke="#EA4335" strokeWidth="2.2" fill="none" strokeLinecap="round"/></svg>
}

export function Account360() {
  const [data, setData] = useState<A360Data | null>(null)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('overview')
  const [modal, setModal] = useState<ModalConfig | null>(null)
  const [expandedComm, setExpandedComm] = useState<number | null>(null)
  const [ringOffset, setRingOffset] = useState(163.4) // start empty

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent).detail as A360Data
      if (detail) { setData(detail); setTab('overview'); setOpen(true); setExpandedComm(null) }
    }
    window.addEventListener('open-a360', onOpen as EventListener)
    return () => window.removeEventListener('open-a360', onOpen as EventListener)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !modal) setOpen(false) }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, modal])

  // Animate the health ring sweep when the panel opens with data
  useEffect(() => {
    if (open && data) {
      const circ = 2 * Math.PI * 26
      const target = circ - (circ * data.health) / 100
      // start empty
      setRingOffset(circ)
      // sweep to target on the next paint
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setRingOffset(target))
      })
      return () => cancelAnimationFrame(id)
    } else {
      setRingOffset(2 * Math.PI * 26) // reset empty when closed
    }
  }, [open, data])

  function askAI(prompt: string) {
    setOpen(false)
    setTimeout(() => window.dispatchEvent(new CustomEvent('open-ai', { detail: { prompt } })), 120)
  }

  if (!data) return null

  const hc = healthColor(data.health)
  const hstroke = healthStroke(data.health)
  const circ = 2 * Math.PI * 26
  const mono = data.monogram || data.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  // ---------- modal builders ----------
  function successModal(title: string, desc: string) {
    setModal({
      title,
      body: <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '8px 0' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(22,163,74,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>{desc}</div>
      </div>,
      footer: <ModalBtn primary onClick={() => setModal(null)}>Done</ModalBtn>,
    })
  }

  function logNoteModal() {
    let noteText = ''
    let noteType = 'Call Summary'
    setModal({
      title: `Log Note — ${data!.name}`,
      body: <LogNoteBody accountName={data!.name} onChange={(t, ty) => { noteText = t; noteType = ty }} />,
      footer: <>
        <ModalBtn onClick={() => setModal(null)}>Cancel</ModalBtn>
        <ModalBtn onClick={() => { if (noteText.trim()) shareNoteModal(noteType, noteText) }}>Share</ModalBtn>
        <ModalBtn primary onClick={() => { if (noteText.trim()) successModal('Note Saved ✓', `${noteType} added to ${data!.name} account history.`) }}>Save Note</ModalBtn>
      </>,
    })
  }

  function shareNoteModal(noteType: string, noteText: string) {
    setModal({
      title: `Share Note — ${data!.name}`,
      body: <ShareNoteBody accountName={data!.name} noteType={noteType} noteText={noteText} onShared={(who) => successModal('Note Shared ✓', `${noteType} for ${data!.name} shared with ${who}. They will get a notification.`)} />,
      footer: null,
    })
  }

  function playbookModal() {
    const risk = data!.risk.toUpperCase()
    let plays: { n: string; t: string; d: string; c: string; bg: string }[]
    if (risk === 'HIGH') {
      plays = [
        { n: '1', t: 'Exec Sponsor Call', d: 'Schedule VP/CRO-level call within 48h. Frame as "strategic alignment" not "save the deal".', c: 'var(--danger)', bg: '224,62,62' },
        { n: '2', t: 'Value Reinforcement', d: 'Send ROI summary + case study within 24h. Quantify cost of switching.', c: 'var(--amber)', bg: '232,133,10' },
        { n: '3', t: 'Multi-thread Engagement', d: 'Engage 2+ stakeholders. Use champion to influence decision maker internally.', c: 'var(--ok)', bg: '42,157,92' },
      ]
    } else if (risk === 'MEDIUM' || risk === 'MED') {
      plays = [
        { n: '1', t: 'Unblock the Bottleneck', d: 'Identify specific stall point (legal, budget, timeline) and address directly.', c: 'var(--amber)', bg: '232,133,10' },
        { n: '2', t: 'Phased Approach', d: 'Offer smaller initial commitment to reduce perceived risk.', c: 'var(--ok)', bg: '42,157,92' },
      ]
    } else {
      plays = [
        { n: '1', t: 'Maintain Momentum', d: 'Keep engagement cadence. Respond within 2h to all communications.', c: 'var(--ok)', bg: '42,157,92' },
        { n: '2', t: 'Expand the Deal', d: 'Identify upsell opportunities based on product usage patterns.', c: 'var(--ok)', bg: '42,157,92' },
      ]
    }
    setModal({
      title: `Playbook — ${data!.name} (${risk} Risk)`,
      body: <div>
        <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--t2)' }}>AI-recommended plays based on {data!.signals} signals and {data!.stage} stage.</div>
        {plays.map((p, i) => (
          <div key={i} style={{ padding: 12, background: `rgba(${p.bg},.04)`, border: `1px solid rgba(${p.bg},.1)`, borderRadius: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: p.c, marginBottom: 4 }}>{p.n}. {p.t}</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{p.d}</div>
          </div>
        ))}
      </div>,
      footer: <>
        <ModalBtn onClick={() => setModal(null)}>Dismiss</ModalBtn>
        <ModalBtn primary onClick={() => successModal('Playbook Activated ✓', 'Popsicle AI will sequence each play automatically. First action queued now.')}>Activate Playbook</ModalBtn>
      </>,
    })
  }

  function scheduleCallModal() {
    setModal({
      title: 'Schedule Call',
      body: <ScheduleCallBody contact={data!.contact.split(' · ')[0]} acct={data!.name} onConfirm={(dt, tm) => {
        setModal({
          title: 'Confirmed',
          body: <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(22,163,74,.1)', border: '2px solid rgba(22,163,74,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-.3px', marginBottom: 6 }}>Call scheduled</div>
            <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 4 }}>with <strong>{data!.contact.split(' · ')[0]}</strong></div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ok)', marginBottom: 20 }}>{dt} at {tm}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(22,163,74,.05)', border: '1px solid rgba(22,163,74,.15)', borderRadius: 10, padding: '14px 16px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--t2)' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Calendar invite sent to <strong>{data!.contact.split(' · ')[0]}</strong></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--t2)' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg>Your calendar has been updated</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--t2)' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg>Reminder set 30 minutes before</div>
            </div>
          </div>,
          footer: <ModalBtn primary onClick={() => setModal(null)}>Done</ModalBtn>,
        })
      }} />,
      footer: null,
    })
  }

  function battleCardModal() {
    const rows = [
      ['Real-time signals', '✓ Live', 'Batch only', '✗'],
      ['Channels covered', '7 sources', 'Calls only', 'CRM only'],
      ['AI response kits', '✓ Auto-generated', '✗', '✗'],
      ['WhatsApp monitoring', '✓', '✗', '✗'],
      ['Revenue Loop', '✓ Unique', '✗', '✗'],
      ['Churn prediction', '94% accuracy', '72%', '68%'],
    ]
    setModal({
      title: `Battle Card — ${data!.name}`,
      body: <div>
        <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--t3)' }}>Sending to <strong style={{ color: 'var(--t1)' }}>{data!.contact.split(' · ')[0]}</strong> · competitive intelligence briefing</div>
        <div style={{ background: 'linear-gradient(135deg,rgba(255,107,53,.04),rgba(255,107,53,.02))', border: '1.5px solid rgba(255,107,53,.15)', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(255,107,53,.12),rgba(255,107,53,.06))', padding: '12px 16px', borderBottom: '1px solid rgba(255,107,53,.1)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--o)', letterSpacing: '1.2px', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>Competitive Intelligence</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--t1)', letterSpacing: '-.3px' }}>Popsicle vs Gong vs Clari</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: 'rgba(255,107,53,.06)' }}>
              <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 800, color: 'var(--t2)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: '1px solid rgba(255,107,53,.1)' }}>Capability</th>
              <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--o)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: '1px solid rgba(255,107,53,.1)' }}>Popsicle</th>
              <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--t3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: '1px solid rgba(255,107,53,.1)' }}>Gong</th>
              <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--t3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: '1px solid rgba(255,107,53,.1)' }}>Clari</th>
            </tr></thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '' : 'rgba(255,107,53,.02)', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                  <td style={{ padding: '9px 14px', fontWeight: 600, color: 'var(--t1)' }}>{row[0]}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 800, color: row[1].startsWith('✓') ? 'var(--ok)' : 'var(--o)' }}>{row[1]}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: row[2] === '✗' ? 'var(--danger)' : 'var(--t3)' }}>{row[2]}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: row[3] === '✗' ? 'var(--danger)' : 'var(--t3)' }}>{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', background: 'rgba(22,163,74,.04)', borderTop: '1px solid rgba(22,163,74,.1)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--ok)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}>Key Win Argument</div>
            <div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.6 }}>Popsicle catches signals <strong>3x faster</strong> than Gong and monitors <strong>7 channels</strong> Clari cannot access. This month alone we detected {data!.signals} {data!.name} signals that Gong would have missed.</div>
          </div>
        </div>
      </div>,
      footer: <>
        <ModalBtn onClick={() => setModal(null)}>Cancel</ModalBtn>
        <ModalBtn primary onClick={() => successModal('Battle Card Sent ✓', `Battle card delivered to ${data!.name}. CRO notified. Click tracking enabled.`)}>Send to Contact</ModalBtn>
      </>,
    })
  }

  function pricingDeckModal() {
    setModal({
      title: `Pricing Deck — ${data!.name}`,
      body: <PricingDeckBody />,
      footer: <>
        <ModalBtn onClick={() => setModal(null)}>Cancel</ModalBtn>
        <ModalBtn primary onClick={() => successModal('Proposal Sent ✓', `3-option pricing deck sent to ${data!.name}. Click tracking enabled, you will be notified when viewed.`)}>Send Proposal</ModalBtn>
      </>,
    })
  }

  function escalateModal() {
    const contact = data!.contact.split(' · ')[0]
    const steps = ['Notify your CRO with AI-generated risk brief', `Send executive summary to ${contact} via email`, 'Flag account in Salesforce as At Risk', 'Block renewal auto-renewal pending resolution', 'Schedule emergency account review call']
    setModal({
      title: `Escalate Risk — ${data!.name}`,
      body: <div>
        <div style={{ background: 'rgba(220,38,38,.04)', border: '1px solid rgba(220,38,38,.15)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>Risk escalation: {data!.name}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>This will notify your CRO and flag the account for executive intervention.</div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t4)', fontFamily: "'DM Mono',monospace", letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>Escalation path</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--inset)', borderRadius: 9 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(220,38,38,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'var(--danger)', fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>{i + 1}</div>
              <span style={{ fontSize: 12.5, color: 'var(--t1)' }}>{step}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--t3)', fontStyle: 'italic' }}>Escalations are logged and shared with your team automatically.</div>
      </div>,
      footer: <>
        <ModalBtn onClick={() => setModal(null)}>Cancel</ModalBtn>
        <ModalBtn danger onClick={() => successModal('Escalated to CRO ✓', `${data!.name} risk brief sent. Exec-to-exec recommended within 24h. AI monitoring escalated.`)}>Escalate Now</ModalBtn>
      </>,
    })
  }

  const actions = [
    { label: 'Draft Follow-up', primary: true, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="22 7 12 13 2 7"/></svg>, onClick: () => askAI(`Draft a follow-up email to ${data!.contact} at ${data!.name}`) },
    { label: 'Schedule Call', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, onClick: scheduleCallModal },
    { label: 'Battle Card', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, onClick: battleCardModal },
    { label: 'Escalate Risk', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, onClick: escalateModal },
    { label: 'Pricing Deck', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>, onClick: pricingDeckModal },
    { label: 'Log Note', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>, onClick: logNoteModal },
    { label: 'Run Playbook', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>, onClick: playbookModal },
    { label: 'Ask AI', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, onClick: () => askAI(`Analyse ${data!.name} and recommend next steps`) },
  ]

  const SEC = (t: string) => <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', marginBottom: 10, fontFamily: "'DM Mono',monospace" }}>{t}</div>

  return (
    <>
      <div className={`a360-backdrop${open ? ' on' : ''}`} onClick={() => setOpen(false)}></div>
      <div className={`a360-panel${open ? ' open' : ''}`}>
        {/* Hero */}
        <div className="a360-hero-bg">
          <div className="a360-hero-inner">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div className="a360-monogram" style={{ background: 'linear-gradient(135deg,#4A90D9,#7C3AED)' }}>{mono}</div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-.5px', color: 'var(--t1)', marginBottom: 3 }}>{data.name}</div>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>{data.contact}</span>
                    <span className="rp rmd" style={{ fontSize: 7.5, background: 'var(--o-bg)', color: 'var(--o)', borderColor: 'var(--o-border)' }}>{data.stage.toUpperCase()}</span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-1px', color: hc, lineHeight: 1 }}>{data.arr}</div>
                <div style={{ fontSize: 10, letterSpacing: '.1px', color: 'var(--t4)', marginTop: 3 }}>ARR</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0 14px', borderTop: '1px solid var(--border-soft)' }}>
              <div className="a360-hring">
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" strokeWidth="5"/>
                  <circle cx="32" cy="32" r="26" fill="none" stroke={hstroke} strokeWidth="5.5" strokeDasharray={circ} strokeDashoffset={ringOffset} strokeLinecap="round" transform="rotate(-90 32 32)" style={{ transition: 'stroke-dashoffset .85s cubic-bezier(.22,1,.36,1)', filter: `drop-shadow(0 0 4px ${hstroke}66)` }} />
                </svg>
                <div className="a360-hring-val">
                  <span className="a360-hring-num" style={{ color: hc }}>{data.health}</span>
                  <span className="a360-hring-lbl" style={{ color: 'var(--t4)' }}>score</span>
                </div>
              </div>
              <div style={{ display: 'flex', flex: 1, gap: 0 }}>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border-soft)', padding: '0 10px' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--t1)' }}>{data.signals}</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2 }}>signals</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border-soft)', padding: '0 10px' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: typeof data.daysDark === 'number' && data.daysDark > 3 ? 'var(--danger)' : 'var(--t1)' }}>{data.daysDark}</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2 }}>days dark</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border-soft)', padding: '0 10px' }}>
                  <span className={`rp ${riskClass(data.risk)}`} style={{ fontSize: 9 }}>{data.risk.toUpperCase()}</span>
                  <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 4 }}>risk</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border-soft)', padding: '0 10px' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)' }}>{data.rep}</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2 }}>rep</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 14, fontSize: 11, color: 'var(--t4)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>{data.lastTouch}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="a360-tabs">
          {['overview', 'signals', 'comms', 'people', 'timeline', 'contracts'].map(t => (
            <div key={t} className={`a360-tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</div>
          ))}
        </div>

        {/* Body + actions */}
        <div className="a360-two-col" style={{ height: 'calc(100vh - 280px)' }}>
          <div className="a360-main-col">
            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div>
                {data.brief && data.brief.length > 0 && (
                  <div style={{ marginBottom: 18 }}>{SEC('AI Risk Signals')}
                    {data.brief.map((b, i) => {
                      const type = data.briefTypes?.[i] || 'danger'
                      const rgb = type === 'danger' ? '224,62,62' : type === 'warn' ? '232,133,10' : '42,157,92'
                      const dot = type === 'danger' ? 'var(--danger)' : type === 'warn' ? 'var(--warn)' : 'var(--ok)'
                      return (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: `rgba(${rgb},.04)`, border: `1px solid rgba(${rgb},.1)`, borderRadius: 10, marginBottom: 6, alignItems: 'flex-start' }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 5 }}></div>
                          <div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.55 }}>{b}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {data.healthBars && data.healthBars.length > 0 && (
                  <div style={{ marginBottom: 18 }}>{SEC('Health Breakdown')}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {data.healthBars.map((hb, i) => (
                        <div key={i} style={{ padding: '10px 12px', background: 'var(--inset)', borderRadius: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{hb.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: hb.color }}>{hb.val}%</span>
                          </div>
                          <div className="pbar" style={{ height: 5 }}><div className="pbar-fill" style={{ width: `${hb.val}%`, background: hb.color }}></div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>{SEC('Deal Progress')}
                  <div className="pbar" style={{ height: 8 }}><div className="pbar-fill" style={{ width: `${data.health}%`, background: data.health < 40 ? 'var(--danger)' : data.health < 60 ? 'linear-gradient(90deg,var(--warn),var(--o))' : 'var(--ok)' }}></div></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--t3)' }}>
                    <span>Discovery</span><span>Negotiation</span><span>Closing</span><span>Won</span>
                  </div>
                </div>
              </div>
            )}

            {/* SIGNALS */}
            {tab === 'signals' && (
              <div>
                {(data.sigItems && data.sigItems.length > 0) ? data.sigItems.map((s, i) => {
                  const c = s.sev === 'danger' ? 'var(--danger)' : s.sev === 'warn' ? 'var(--warn)' : 'var(--ok)'
                  const bg = s.sev === 'danger' ? '224,62,62' : s.sev === 'warn' ? '232,133,10' : '42,157,92'
                  const lb = s.sev === 'danger' ? 'CRITICAL' : s.sev === 'warn' ? 'WARNING' : 'POSITIVE'
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: 14, background: 'var(--inset)', borderRadius: 12, marginBottom: 8, borderLeft: `3px solid ${c}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.55, marginBottom: 8 }}>{s.msg}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: `rgba(${bg},.08)`, color: c, border: `1px solid rgba(${bg},.15)`, fontFamily: "'DM Mono',monospace" }}>{lb}</span>
                          <span style={{ fontSize: 10, color: 'var(--t3)' }}>{s.time} ago · {s.via}</span>
                        </div>
                      </div>
                    </div>
                  )
                }) : <Empty label="No signals on file for this account" />}
              </div>
            )}

            {/* COMMS */}
            {tab === 'comms' && (
              <div>
                {SEC('Recent Communications')}
                {(data.comms && data.comms.length > 0) ? data.comms.map((c, ci) => {
                  if (c.dir === 'out') {
                    return (
                      <div key={ci} style={{ borderRadius: 'var(--r)', boxShadow: 'var(--sh-sm)', overflow: 'hidden', marginBottom: 8, borderLeft: '3px solid var(--o)' }}>
                        <div style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--o)' }}>You</span>
                            <span style={{ fontSize: 10, color: 'var(--t3)' }}>{c.time} · {c.via}</span>
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.55 }}>&quot;{c.msg}&quot;</div>
                        </div>
                      </div>
                    )
                  }
                  const sigColor = c.signalColor || 'var(--t3)'
                  const sigLabel = c.signal || 'Signal'
                  const isExp = expandedComm === ci
                  return (
                    <div key={ci} style={{ borderRadius: 'var(--r)', boxShadow: 'var(--sh-sm)', overflow: 'hidden', marginBottom: 8, background: 'var(--surface)' }}>
                      <div style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{viaIcon(c.via)}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 700 }}>{c.from}</span>
                              <span style={{ fontSize: 10, color: 'var(--t3)' }}>{c.time}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 8 }}>{c.role} · via {c.via}</div>
                            <div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.55, background: 'var(--inset)', padding: '8px 10px', borderRadius: 8, borderLeft: `2.5px solid ${sigColor}` }}>&quot;{c.msg}&quot;</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px 8px', borderTop: '1px solid var(--border)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: sigColor, fontFamily: "'DM Mono',monospace" }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sigColor, display: 'inline-block', flexShrink: 0 }}></span>{sigLabel} signal
                        </span>
                        <div style={{ flex: 1 }}></div>
                        <div onClick={() => setExpandedComm(isExp ? null : ci)} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--o)' }}>Actions</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round" style={{ transition: 'transform .2s', transform: isExp ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                      </div>
                      {isExp && (
                        <div style={{ padding: '0 14px 12px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => askAI(`Draft a reply to ${c.from}'s ${c.via} message at ${data!.name}`)} style={{ flex: 1, padding: 8, borderRadius: 10, background: 'var(--o)', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Draft Reply</button>
                            <button onClick={() => askAI(`Analyse the ${c.via} from ${c.from} at ${data!.name} and recommend next steps`)} style={{ flex: 1, padding: 8, borderRadius: 10, background: 'rgba(255,107,53,.08)', color: 'var(--o)', border: '1.5px solid rgba(255,107,53,.22)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Ask AI</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                }) : <Empty label="No communications logged yet" />}
              </div>
            )}

            {/* PEOPLE */}
            {tab === 'people' && (
              <div>
                {(data.people && data.people.length > 0) ? data.people.map((p, i) => (
                  <div key={i} style={{ padding: 16, background: 'var(--inset)', borderRadius: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'var(--t2)' }}>{p.name.split(' ').map(w => w[0]).join('')}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>{p.name}</span>
                          {p.badge && <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 20, background: 'rgba(0,0,0,.04)', color: p.badgeColor || 'var(--t3)', border: '1px solid rgba(0,0,0,.06)', letterSpacing: '.5px' }}>{p.badge}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--t3)' }}>{p.role} · Last active {p.last}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: p.eng > 60 ? 'var(--ok)' : p.eng > 35 ? 'var(--warn)' : 'var(--danger)' }}>{p.eng}%</div>
                        <div style={{ fontSize: 9, color: 'var(--t3)' }}>engagement</div>
                      </div>
                    </div>
                    {p.desc && <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.55, padding: '8px 0 0', borderTop: '1px solid var(--border)' }}>{p.desc}</div>}
                  </div>
                )) : <Empty label="No contacts mapped for this account" />}
              </div>
            )}

            {/* TIMELINE */}
            {tab === 'timeline' && (
              <div>
                {(data.timeline && data.timeline.length > 0) ? data.timeline.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14, flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0, marginTop: 4 }}></div>
                      {i < data.timeline!.length - 1 && <div style={{ flex: 1, width: 1, background: 'var(--border)', margin: '4px 0' }}></div>}
                    </div>
                    <div style={{ flex: 1, paddingBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{t.title}</span>
                        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{t.time}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.55 }}>{t.desc}</div>
                    </div>
                  </div>
                )) : <Empty label="No timeline events yet" />}
              </div>
            )}

            {/* CONTRACTS */}
            {tab === 'contracts' && (
              <div>
                {(data.contracts && data.contracts.length > 0) ? data.contracts.map((ct, i) => (
                  <div key={i} style={{ padding: 16, background: 'var(--inset)', borderRadius: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>{ct.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--t3)' }}>{ct.type}</div>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 20, color: ct.statusColor, background: 'rgba(0,0,0,.03)', border: '1px solid rgba(0,0,0,.06)' }}>{ct.status}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                      {[['Value', ct.value], ['PO Number', ct.po], ['Start', ct.start], ['End', ct.end]].map(([k, v], j) => (
                        <div key={j}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>{k}</div>
                          <div style={{ fontSize: j === 0 ? 15 : 12, fontWeight: j === 0 ? 900 : 600, color: 'var(--t1)', fontFamily: j === 1 ? "'DM Mono',monospace" : 'inherit' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '8px 10px', background: 'var(--surface)', borderRadius: 8, fontSize: 11, color: 'var(--t2)' }}>{ct.invoice}</div>
                  </div>
                )) : <Empty label="No contracts on file" />}
              </div>
            )}
          </div>

          {/* Action column */}
          <div className="a360-action-col">
            <div className="a360-action-label">Recommended Actions</div>
            {actions.map((a, i) => (
              <button key={i} className={`a360-action-btn${a.primary ? ' primary' : ''}`} onClick={a.onClick}>
                {a.icon}{a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <A360Modal config={modal} onClose={() => setModal(null)} />
    </>
  )
}

function Empty({ label }: { label: string }) {
  return <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>{label}</div>
}

function LogNoteBody({ accountName, onChange }: { accountName: string; onChange: (text: string, type: string) => void }) {
  const [text, setText] = useState('')
  const [type, setType] = useState('Call Summary')
  const types = ['Call Summary', 'Meeting Note', 'Internal Update', 'Follow-up', 'Risk Flag', 'Other']
  useEffect(() => { onChange(text, type) }, [text, type, onChange])
  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--t2)' }}>Add a note to <strong>{accountName}</strong> account history.</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 7 }}>Note</div>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Type your note..." style={{ width: '100%', minHeight: 110, fontSize: 13, color: 'var(--t1)', lineHeight: 1.6, fontFamily: "'Outfit',sans-serif", border: '1.5px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--inset)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', display: 'block', marginBottom: 14 }} />
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 7 }}>Type</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {types.map(t => {
          const active = t === type
          return <div key={t} onClick={() => setType(t)} style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${active ? 'var(--o)' : 'var(--border)'}`, background: active ? 'rgba(255,107,53,.08)' : 'var(--inset)', fontSize: 11, fontWeight: 600, color: active ? 'var(--o)' : 'var(--t2)', cursor: 'pointer' }}>{t}</div>
        })}
      </div>
    </div>
  )
}

function ScheduleCallBody({ contact, acct, onConfirm }: { contact: string; acct: string; onConfirm: (dt: string, tm: string) => void }) {
  const [calDate, setCalDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d })
  const [selected, setSelected] = useState<Date | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dshort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const times = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM']

  const y = calDate.getFullYear(), m = calDate.getMonth()
  const first = new Date(y, m, 1).getDay()
  const total = new Date(y, m + 1, 0).getDate()
  const now = new Date(); now.setHours(0, 0, 0, 0)

  const ready = !!(selected && time)

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 20 }}>Scheduling with <strong style={{ color: 'var(--t1)' }}>{contact}</strong> at <strong style={{ color: 'var(--t1)' }}>{acct}</strong></div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t4)', marginBottom: 7 }}>Date</div>
      <div style={{ background: 'var(--inset)', border: '1.5px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div onClick={() => setCalDate(new Date(y, m - 1, 1))} style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, color: 'var(--t2)' }}>‹</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{months[m]} {y}</div>
          <div onClick={() => setCalDate(new Date(y, m + 1, 1))} style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, color: 'var(--t2)' }}>›</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, textAlign: 'center', marginBottom: 5 }}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} style={{ fontSize: 10, fontWeight: 600, color: 'var(--t4)', padding: '2px 0', fontFamily: "'DM Mono',monospace" }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, textAlign: 'center' }}>
          {Array.from({ length: first }).map((_, i) => <div key={`e${i}`}></div>)}
          {Array.from({ length: total }).map((_, i) => {
            const d = i + 1
            const dt = new Date(y, m, d); dt.setHours(0, 0, 0, 0)
            const past = dt < now
            const sel = selected && dt.toDateString() === selected.toDateString()
            const isToday = dt.toDateString() === now.toDateString()
            return (
              <div key={d} onClick={() => { if (!past) setSelected(dt) }} style={{ padding: '5px 2px', borderRadius: 7, fontSize: 11, fontWeight: sel ? 700 : 400, background: sel ? 'var(--o)' : isToday ? 'rgba(255,107,53,.12)' : 'transparent', color: sel ? '#fff' : past ? 'var(--t4)' : 'var(--t1)', border: `1px solid ${sel ? 'var(--o)' : isToday ? 'rgba(255,107,53,.3)' : 'transparent'}`, cursor: past ? 'default' : 'pointer', opacity: past ? .3 : 1 }}>{d}</div>
            )
          })}
        </div>
        {selected && <div style={{ marginTop: 10, padding: '6px 12px', background: 'rgba(255,107,53,.06)', border: '1px solid rgba(255,107,53,.18)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--o)', textAlign: 'center' }}>{dshort[selected.getDay()]}, {months[selected.getMonth()]} {selected.getDate()}</div>}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t4)', marginBottom: 7 }}>Time</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {times.map(t => {
          const on = time === t
          return <div key={t} onClick={() => setTime(t)} style={{ padding: '6px 14px', borderRadius: 20, background: on ? 'var(--o)' : 'var(--inset)', color: on ? '#fff' : 'var(--t2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${on ? 'var(--o)' : 'transparent'}` }}>{t}</div>
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button disabled={!ready} onClick={() => { if (ready && selected && time) onConfirm(`${dshort[selected.getDay()]}, ${months[selected.getMonth()]} ${selected.getDate()}`, time) }} style={{ padding: '9px 18px', borderRadius: 10, background: 'var(--o)', color: '#fff', border: '1px solid var(--od)', fontSize: 13, fontWeight: 700, cursor: ready ? 'pointer' : 'default', fontFamily: "'Outfit',sans-serif", opacity: ready ? 1 : .4 }}>Confirm →</button>
      </div>
    </div>
  )
}

function PricingDeckBody() {
  const [sel, setSel] = useState(0)
  const opts = [
    { c: 'var(--ok)', bg: 'rgba(42,157,92,.04)', bd: 'rgba(42,157,92,.2)', title: 'Option A: Phased Start', tag: '62% close rate', desc: '60% commitment now, expand after ROI proven. Lowest barrier to entry.' },
    { c: 'var(--o)', bg: 'rgba(255,107,53,.04)', bd: 'rgba(255,107,53,.2)', title: 'Option B: Annual Discount', tag: 'Best value', desc: '12% discount on annual commitment. Full platform access.' },
    { c: 'var(--blue)', bg: 'rgba(59,111,222,.04)', bd: 'rgba(59,111,222,.2)', title: 'Option C: Pilot Program', tag: '78% conversion', desc: '3-month pilot at 40% of full price. Low risk entry.' },
  ]
  return (
    <div>
      <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--t2)' }}>AI-prepared phased pricing options based on deal context.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {opts.map((o, i) => {
          const on = sel === i
          return (
            <div key={i} onClick={() => setSel(i)} style={{ padding: 14, background: on ? o.bg : 'var(--inset)', border: `2px solid ${on ? o.c : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', transition: 'all .15s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: o.c }}>{o.title}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: o.c, background: `${o.bg}`, padding: '2px 8px', borderRadius: 20 }}>{o.tag}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{o.desc}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ShareNoteBody({ accountName, noteType, noteText, onShared }: { accountName: string; noteType: string; noteText: string; onShared: (who: string) => void }) {
  const colleagues = [
    { name: 'Mike Ross', role: 'Account Executive', initials: 'MR' },
    { name: 'Jamie Torres', role: 'Sales Engineer', initials: 'JT' },
    { name: 'Lini July', role: 'Sales Manager', initials: 'LJ' },
    { name: 'Gabby Intan', role: 'Revenue Ops', initials: 'GI' },
  ]
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (n: string) => setPicked(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n])
  return (
    <div>
      <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--t2)' }}>Share this <strong>{noteType}</strong> on <strong>{accountName}</strong> with your team.</div>
      <div style={{ padding: '10px 12px', background: 'var(--inset)', borderRadius: 10, fontSize: 12, color: 'var(--t2)', lineHeight: 1.55, marginBottom: 16, border: '1px solid var(--border-soft)', maxHeight: 80, overflow: 'auto' }}>{noteText}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 8 }}>Share with</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {colleagues.map(c => {
          const on = picked.includes(c.name)
          return (
            <div key={c.name} onClick={() => toggle(c.name)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', background: on ? 'rgba(255,107,53,.06)' : 'var(--inset)', border: `1.5px solid ${on ? 'var(--o)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', transition: 'all .15s' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--t2)', flexShrink: 0 }}>{c.initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>{c.role}</div>
              </div>
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${on ? 'var(--o)' : 'var(--border)'}`, background: on ? 'var(--o)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button disabled={picked.length === 0} onClick={() => onShared(picked.length === 1 ? picked[0] : `${picked.length} colleagues`)} style={{ padding: '9px 18px', borderRadius: 10, background: 'var(--o)', color: '#fff', border: '1px solid var(--od)', fontSize: 13, fontWeight: 700, cursor: picked.length ? 'pointer' : 'default', fontFamily: "'Outfit',sans-serif", opacity: picked.length ? 1 : .4 }}>Share Note</button>
      </div>
    </div>
  )
}
