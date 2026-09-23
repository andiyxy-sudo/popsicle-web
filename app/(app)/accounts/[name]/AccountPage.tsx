'use client'

import { healthTone, formatWhen } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { X } from '@/components/explain/Explain'
import { useEscape } from '@/components/ui/useEscape'
import { TranscriptModal, type Transcript } from '@/components/account/TranscriptModal'
import { ThreadModal, type ThreadSource } from '@/components/account/ThreadModal'

// Account 360 as a full page, matching the design: breadcrumb, name + ARR,
// four stats with a health sparkline, five tabs, and an Overview built from
// the account's real signals. Demo accounts read from the bundled dataset;
// real accounts read the get_account_360 RPC.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DEMO_PEOPLE, DEMO_CONTRACTS, DEMO_EXTRA, DEMO_COMMS, DEMO_TIMELINE, DEMO_RISK_LINES } from '@/lib/demo-dataset'

// Demo slices for this one account arrive as props from the server page, so
// the client bundle never includes the whole demo dataset.
export type DemoSlices = { transcripts?: Record<string, Transcript>; threads?: Record<string, ThreadSource>; people?: (typeof DEMO_PEOPLE)[string]; contracts?: (typeof DEMO_CONTRACTS)[string]; extra?: (typeof DEMO_EXTRA)[string]; comms?: (typeof DEMO_COMMS)[string]; timeline?: (typeof DEMO_TIMELINE)[string]; riskLines?: (typeof DEMO_RISK_LINES)[string] }
import { RiskFlagSheet, buildFlag, type RiskFlag } from '@/components/account/RiskFlagSheet'
import { MergedTimeline } from '@/components/account/MergedTimeline'
import { LOGOS } from '@/app/(app)/integrations/IntegrationsShowcase'

type Sig = { id: string; account_name?: string | null; signal_type?: string | null; severity?: string | null; title?: string | null; description?: string | null; risk_amount?: number | null; source_integration?: string | null; source_message_id?: string | null; created_at?: string | null; status?: string | null; handled_at?: string | null; handled_action?: string | null; is_dismissed?: boolean | null; ai_analysis?: Record<string, unknown> | null }
type Msg = { id: string; account_name?: string | null; integration?: string | null; sender?: string | null; subject?: string | null; content?: string | null; received_at?: string | null; direction?: string | null }
type Acct = { id?: string; name: string; domain?: string | null; value?: number | null; stage?: string | null; owner?: string | null; health_score?: number | null; risk_level?: string | null; close_date?: string | null; last_contact_date?: string | null; contact_name?: string }

const TYPE_LABELS: Record<string, string> = {
  silent_stall: 'Silent stall', competitor_mention: 'Competitor', legal_loopin: 'Legal loop-in', price_flinch: 'Price flinch',
  champion_change: 'Champion change', timeline_slip: 'Timeline slip', reengaged: 'Re-engaged', call_objection: 'Objection',
  call_sentiment_drop: 'Sentiment drop', call_buying_signal: 'Buying signal', call_commitment: 'Commitment',
  call_summary: 'Call summary', meeting_cancelled: 'Meeting cancelled', meeting_declined: 'Meeting declined',
  deal_stage_backward: 'Stage backward', commitment_overdue: 'Commitment overdue',
}
const money = (v?: number | null) => !v ? '--' : v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${v}`


// ---------------------------------------------------------------------------
// Comms thread and timeline rail, shared by demo and live branches.
// ---------------------------------------------------------------------------
type ThreadItem = { who: string; role?: string; via: string; when: string; text: string; tone: 'positive' | 'neutral' | 'negative' | 'internal'; mine?: boolean; label?: string; source?: ThreadSource }
type RailItem = { title: string; body?: string; when: string; kind: 'positive' | 'watch' | 'negative' | 'call' | 'info'; tags?: string[]; onClick?: () => void; done?: boolean; transcript?: Transcript }

const CHANNEL: Record<string, { label: string; glyph: string; color: string }> = {
  gmail: { label: 'Gmail', glyph: 'M', color: '#c43d2b' }, outlook: { label: 'Outlook', glyph: 'O', color: '#2f6f9f' }, whatsapp: { label: 'WhatsApp', glyph: 'W', color: '#25a45a' },
  slack: { label: 'Slack', glyph: 'S', color: '#7C5CFC' }, phone: { label: 'Phone', glyph: 'P', color: 'var(--d-ink, #0E0D0B)' }, zoom: { label: 'Zoom', glyph: 'Z', color: '#2f6f9f' },
  linkedin: { label: 'LinkedIn', glyph: 'in', color: '#2f6f9f' }, hubspot: { label: 'HubSpot', glyph: 'H', color: '#E85A25' }, fireflies: { label: 'Fireflies', glyph: 'F', color: '#7C5CFC' }, gcal: { label: 'Calendar', glyph: 'C', color: '#2f6f9f' },
}
const TONE_META = {
  positive: { c: 'var(--good, #2f8f5b)', t: 'Positive signal' },
  neutral: { c: 'var(--warn, #d38b1d)', t: 'Neutral signal' },
  negative: { c: 'var(--critical, #c43d2b)', t: 'Negative signal' },
  internal: { c: 'var(--ink-faint, #A09C97)', t: 'Internal' },
} as const

function ChannelIcon({ via, size = 14 }: { via: string; size?: number }) {
  const k = via.toLowerCase()
  const st = { width: size, height: size, display: 'block' } as const
  if (k === 'gmail' || k === 'outlook') return <svg viewBox="0 0 24 24" style={st} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="0" /><path d="M3 7l9 6 9-6" /></svg>
  if (k === 'slack') return <svg viewBox="0 0 24 24" style={st} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 4v16M15 4v16M4 9h16M4 15h16" /></svg>
  if (k === 'whatsapp') return <svg viewBox="0 0 24 24" style={st} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z" /></svg>
  if (k === 'phone' || k === 'zoom' || k === 'fireflies') return <svg viewBox="0 0 24 24" style={st} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.7a2 2 0 0 1 1.9 2z" /></svg>
  return <svg viewBox="0 0 24 24" style={st} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /></svg>
}

function CommsThread({ items, account, onAsk, onDraft }: { items: ThreadItem[]; account: string; onAsk: (q: string) => void; onDraft?: () => void }) {
  const [openSrc, setOpenSrc] = useState<ThreadSource | null>(null)
  const chan = (via: string) => CHANNEL[via.toLowerCase()] ?? { label: via, glyph: via.slice(0, 1).toUpperCase(), color: 'var(--ink-faint)' }
  const logo = (via: string) => LOGOS[via.toLowerCase()] ?? null            // the platform's own mark
  const viaSet = Array.from(new Set(items.map(i => chan(i.via).label)))
  const counts = { positive: items.filter(i => i.tone === 'positive').length, negative: items.filter(i => i.tone === 'negative').length, neutral: items.filter(i => i.tone === 'neutral').length }
  const total = Math.max(1, counts.positive + counts.neutral + counts.negative)
  const TONE_WORD: Record<string, string> = { positive: 'Momentum', neutral: 'Waiting', negative: 'Concern', internal: 'Internal' }

  // who is talking: one line per person, from their own messages
  const days = (when: string) => { const m = /(\d+)\s*([dhwm])/i.exec(when || ''); if (!m) return 0; const n = Number(m[1]); const u = m[2].toLowerCase(); return u === 'h' ? n / 24 : u === 'w' ? n * 7 : u === 'm' ? n * 30 : n }
  const people = Array.from(new Map(items.filter(i => !i.mine && i.who).map(i => [i.who, i])).keys()).map(who => {
    const mine = items.filter(i => i.who === who && !i.mine)
    const last = mine[0]
    const neg = mine.filter(i => i.tone === 'negative').length, pos = mine.filter(i => i.tone === 'positive').length
    const role = last?.role ?? ''
    const kind = /cfo|ceo|coo|cro|chief|vp|head|director|founder/i.test(role) ? 'decision maker' : pos > neg && pos > 0 ? 'champion' : ''
    const tone = last?.tone ?? 'neutral'
    const line = neg > 0
      ? `${neg === 1 ? 'One concern' : `${neg} concerns`} raised, last message ${last?.when ?? ''}`
      : pos > 0 ? `Actively helping, last note ${last?.when ?? ''}` : `Waiting, last note ${last?.when ?? ''}`
    return { who, role, kind, line, tone, quiet: days(last?.when ?? '') }
  })
  const quietest = [...people].sort((a, b) => b.quiet - a.quiet)[0]

  return (
    <div style={{ marginTop: 'var(--gap-m)' }}>
      <div className="cm-head">
        <div>
          <h2>Recent communications</h2>
          <div className="cm-sub">{items.length} message{items.length === 1 ? '' : 's'} · {people.length} {people.length === 1 ? 'person' : 'people'} · {viaSet.join(', ')}</div>
        </div>
        <div className="cm-meter">
          <div className="cm-meter-bar">
            {counts.positive > 0 && <span style={{ flex: counts.positive / total, background: TONE_META.positive.c }} />}
            {counts.neutral > 0 && <span style={{ flex: counts.neutral / total, background: TONE_META.neutral.c }} />}
            {counts.negative > 0 && <span style={{ flex: counts.negative / total, background: TONE_META.negative.c }} />}
          </div>
          <div className="cm-meter-key">
            {counts.positive > 0 && <span style={{ color: TONE_META.positive.c }}>{counts.positive} momentum</span>}
            {counts.neutral > 0 && <span style={{ color: TONE_META.neutral.c }}>{counts.neutral} waiting</span>}
            {counts.negative > 0 && <span style={{ color: TONE_META.negative.c }}>{counts.negative} concern</span>}
          </div>
        </div>
      </div>

      <div className="cm-cols">
        <div>
          {items.map((m, i) => {
            const tone = TONE_META[m.tone], ch = chan(m.via)
            return (
              <div key={i} className="cm-msg">
                <div className="cm-msg-top">
                  <span className="cm-dot" style={{ background: tone.c }} />
                  <span className="cm-who">{m.mine ? 'You' : m.who}</span>
                  {(m.role || m.mine) && <span className="cm-role">{m.mine ? 'you' : m.role}</span>}
                  <span className="cm-chan" title={ch.label}>{logo(m.via) ?? <span className="cm-chan-txt">{ch.glyph}</span>}</span>
                  <span className="cm-when">{m.when}</span>
                  <span className="cm-tone" style={{ color: tone.c }}>{TONE_WORD[m.tone] ?? m.tone}</span>
                </div>
                {m.label && <div className="cm-label">{m.label}</div>}
                <p className="cm-text">{m.text}</p>
                <div className="cm-acts">
                  <button onClick={() => onAsk(`In the message from ${m.mine ? 'me' : m.who} at ${account} via ${ch.label} ("${m.text.slice(0, 80)}…"), what does it mean for the deal and how should I reply?`)}>Ask about this</button>
                  {m.source && <button onClick={() => setOpenSrc(m.source!)}>Open thread</button>}
                  {onDraft && !m.mine && <button onClick={onDraft}>Draft reply</button>}
                </div>
              </div>
            )
          })}
          <button className="cm-summary" onClick={() => onAsk(`Summarise the recent communications with ${account}: who said what, the tone, and the one thing I should do next.`)}>
            Ask Popsicle to summarise this thread →
          </button>
        </div>

        <aside className="cm-rail">
          <div className="cm-rail-k">Who is talking</div>
          {people.map(p => (
            <div key={p.who} className="cm-person">
              <div className="cm-person-n">{p.who}</div>
              <div className="cm-person-r">{[p.role, p.kind].filter(Boolean).join(' · ')}</div>
              <div className="cm-person-l" style={{ color: TONE_META[p.tone as keyof typeof TONE_META].c }}>{p.line}</div>
            </div>
          ))}
          {quietest && quietest.quiet >= 2 && (
            <>
              <div className="cm-rail-k" style={{ marginTop: 16 }}>Quiet since</div>
              <p className="cm-quiet">No message from <b>{quietest.who}</b> for <b style={{ color: 'var(--critical, #c43d2b)' }}>{Math.round(quietest.quiet)} days</b>.</p>
            </>
          )}
        </aside>
      </div>
      {openSrc && <ThreadModal t={openSrc} onClose={() => setOpenSrc(null)} onAsk={onAsk} />}
    </div>
  )
}

function TimelineRail({ items, account, onAsk }: { items: RailItem[]; account: string; onAsk: (q: string) => void }) {
  const [openTr, setOpenTr] = useState<Transcript | null>(null)
  useEscape(!!openTr, () => setOpenTr(null))
  const KIND = {
    positive: { c: 'var(--good, #2f8f5b)', g: '✓', label: 'Progress' }, watch: { c: 'var(--warn, #d38b1d)', g: '!', label: 'Watch' },
    negative: { c: 'var(--critical, #c43d2b)', g: '↓', label: 'Risk' }, call: { c: 'var(--blue, #2f6f9f)', g: '☎', label: 'Call' }, info: { c: 'var(--ink-faint, #A09C97)', g: '·', label: 'Note' },
  } as const
  const risk = items.filter(t => t.kind === 'negative' || t.kind === 'watch').length
  return (
    <div style={{ marginTop: 'var(--gap-m)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', paddingBottom: 16, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
        <div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 21, letterSpacing: '-.03em', color: 'var(--ink)' }}>Deal timeline</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)', marginTop: 6 }}>{items.length} events · newest first{risk ? ` · ${risk} raised risk` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '.6px', textTransform: 'uppercase' }}>
          {(['positive', 'watch', 'negative', 'call'] as const).filter(k => items.some(t => t.kind === k)).map(k => (
            <span key={k} style={{ color: KIND[k].c, display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: KIND[k].c }} />{KIND[k].label}</span>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: 4, maxWidth: 860 }}>
        {/* the spine */}
        <span aria-hidden style={{ position: 'absolute', left: 79, top: 26, bottom: 26, width: 1, background: 'var(--hairline, #EFEAE1)' }} />
        {items.map((t, i) => {
          const k = KIND[t.kind]
          const heavy = t.kind === 'negative' || t.kind === 'watch'
          return (
            <div key={i} onClick={() => { if (t.transcript) setOpenTr(t.transcript); else t.onClick?.() }} className="rail-row" style={{ display: 'grid', gridTemplateColumns: '68px 24px minmax(0,1fr)', gap: 22, alignItems: 'start', padding: '18px 0', cursor: (t.onClick || t.transcript) ? 'pointer' : 'default' }}>
              {/* date gutter, so the eye reads time down the left */}
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)', textAlign: 'right', paddingTop: 5, whiteSpace: 'nowrap' }}>{t.when}</span>
              <span style={{ position: 'relative', display: 'grid', placeItems: 'center', paddingTop: 2 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', background: heavy ? k.c : 'var(--paper, #FBF8F3)', border: `1.5px solid ${k.c}`, color: heavy ? '#fff' : k.c, fontSize: 11, fontWeight: 700, opacity: t.done ? .5 : 1, zIndex: 1 }}>{k.g}</span>
              </span>
              <div style={{ minWidth: 0, opacity: t.done ? .65 : 1, paddingLeft: heavy ? 16 : 0, borderLeft: heavy ? `2px solid ${k.c}` : 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-.01em', textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
                  {t.transcript && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>Open transcript →</span>}
                </div>
                {t.body && <div style={{ fontSize: 14.5, color: 'var(--ink-muted)', lineHeight: 1.65, marginTop: 5, maxWidth: 640 }}>{t.body}</div>}
                {t.tags && t.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 9, fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                    {t.tags.map(tag => <span key={tag}>{tag}</span>)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {openTr && <TranscriptModal t={openTr} onClose={() => setOpenTr(null)} onAsk={onAsk} />}
      <div onClick={() => onAsk(`Walk me through the deal timeline for ${account}: what changed, in what order, and where the risk was introduced.`)} style={{ display: 'inline-block', fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginTop: 14, cursor: 'pointer' }}>Ask Popsicle what changed →</div>
    </div>
  )
}

export function AccountPage({ accountName, account, signals, messages, demo = {} }: { accountName: string; account: Acct | null; signals: Sig[]; messages: Msg[]; demo?: DemoSlices }) {
  const router = useRouter()
  const [tab, setTab] = useState<'overview' | 'comms' | 'people' | 'timeline' | 'contracts'>('overview')
  const acct = account
  const [flag, setFlag] = useState<RiskFlag | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])


  const open = useMemo(() => signals.filter(s => !s.is_dismissed && (!s.status || s.status === 'open')), [signals])
  const risk = (acct?.risk_level || (open.some(s => s.severity === 'high') ? 'high' : open.some(s => s.severity === 'watch') ? 'medium' : 'low')).toLowerCase()
  const riskColor = risk === 'high' ? 'var(--critical, #c43d2b)' : risk === 'medium' ? 'var(--warn, #d38b1d)' : 'var(--good, #2f8f5b)'
  const health = acct?.health_score ?? 50
  const daysDark = acct?.last_contact_date && mounted ? Math.floor((Date.now() - new Date(acct.last_contact_date).getTime()) / 86400000) : null
  const people = demo.people ?? []
  const contracts = demo.contracts ?? []

  // health sparkline: trend implied by open severities over time
  const spark = useMemo(() => {
    const pts = [0, 1, 2, 3, 4, 5, 6].map(i => {
      const base = health + (open.filter(s => s.severity === 'high').length * 3) * (6 - i) / 6
      return Math.max(5, Math.min(100, base + (i % 2 === 0 ? 3 : -2)))
    })
    return pts.map((v, i) => `${(i / 6) * 120},${34 - (v / 100) * 28}`).join(' L')
  }, [health, open])

  const flags = open.slice(0, 4).map(s => ({
    sig: s,
    label: TYPE_LABELS[s.signal_type || ''] || s.title || 'Signal',
    color: s.severity === 'high' ? 'var(--critical, #c43d2b)' : s.severity === 'positive' ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)',
  }))

  const extra = demo.extra
  const breakdown = extra ? extra.breakdown.map(b => ({ k: b.k, v: b.v })) : [
    { k: 'Engagement', v: Math.max(5, Math.min(100, health - open.filter(s => s.signal_type === 'silent_stall').length * 18)) },
    { k: 'Product fit', v: Math.max(20, Math.min(100, 60 + open.filter(s => s.severity === 'positive').length * 12)) },
    { k: 'Legal', v: Math.max(10, Math.min(100, 80 - open.filter(s => s.signal_type === 'legal_loopin').length * 40)) },
    { k: 'Financial', v: Math.max(10, Math.min(100, 75 - open.filter(s => s.signal_type === 'price_flinch').length * 35)) },
  ]

  if (!acct) return (
    <div className="dsk-screen on">
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Account 360</div>
      <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 34, letterSpacing: '-.035em', margin: '18px 0 0' }}>{accountName} not found.</h1>
    </div>
  )

  const stat = (label: string, value: React.ReactNode, sub?: React.ReactNode, color?: string) => (
    <div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{label}</div>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 27, letterSpacing: '-.035em', color: color || 'var(--ink)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 5 }}>{sub}</div>}
    </div>
  )

  return (
    <div className="dsk-screen on">
      <RiskFlagSheet flag={flag} onClose={() => setFlag(null)} />
      {/* breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 36, gap: 16 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          <span onClick={() => router.push('/portfolio')} style={{ color: 'var(--accent)', cursor: 'pointer' }}>← Portfolio</span>
          <span style={{ margin: '0 8px' }}>/</span>Account 360
        </div>
        <div onClick={() => setFlag(buildFlag(accountName, open, risk, href => router.push(href)))} title="Why this risk"
          style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: riskColor, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: riskColor }} />{risk} risk →
        </div>
      </div>

      {/* name + ARR */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginTop: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(32px,3.6vw,46px)', letterSpacing: '-.04em', margin: 0, lineHeight: 1.05, color: 'var(--ink)' }}>{acct.name}</h1>
          <div style={{ fontSize: 14, color: 'var(--ink-muted)', marginTop: 8 }}>
            {[acct.contact_name, acct.stage, acct.owner].filter(Boolean).join('  ·  ')}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(28px,3.2vw,40px)', letterSpacing: '-.04em', color: riskColor, lineHeight: 1 }}>{money(acct.value)}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)', marginTop: 6 }}>ARR</div>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '26px 0 26px' }} />

      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 28 }}>
        {stat('Health', <>
          <span style={{ color: riskColor }}><X m="account_health" account={accountName}>{health}</X></span>
          <svg width="120" height="34" viewBox="0 0 120 34" style={{ overflow: 'visible' }}>
            <path d={`M${spark}`} fill="none" stroke={riskColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </>, open.length ? `${open.length} open signal${open.length === 1 ? '' : 's'}` : 'no open signals')}
        {stat('Churn risk', `${Math.max(0, Math.min(100, 100 - health))}%`, health >= 70 ? 'low' : health >= 40 ? 'medium' : 'high', healthTone(health))}
        {stat('Renewal', extra?.expiry ?? (acct.close_date && mounted ? new Date(acct.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'), acct.stage || '')}
        {extra && stat('Trend', extra.trend, `rep score ${extra.repScore}`, extra.trend.startsWith('+') ? 'var(--good, #2f8f5b)' : 'var(--critical, #c43d2b)')}
        {stat('Exposure', <X m="account_arr" account={accountName}>{money(Math.max(0, ...open.filter(s => s.severity !== 'positive').map(s => Number(s.risk_amount) || 0)))}</X>, `${open.filter(s => s.severity === 'high').length} critical`, riskColor)}
        {stat('Last touch', daysDark != null ? (daysDark === 0 ? 'today' : `${daysDark}d ago`) : '--', acct.owner ? `owner ${acct.owner}` : '')}
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 26, marginTop: 'var(--gap-m)', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
        {(['overview', 'comms', 'people', 'timeline', 'contracts'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ font: 'inherit', fontSize: 15, fontWeight: tab === t ? 600 : 400, color: tab === t ? 'var(--accent)' : 'var(--ink-muted)', background: 'none', border: 0, borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent', padding: '0 0 12px', cursor: 'pointer', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(240px,1fr)', gap: 56, marginTop: 30 }}>
          <div>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', paddingBottom: 22, marginBottom: 26, borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
              {flags.map((f, i) => (
                <span key={i} onClick={() => setFlag(buildFlag(accountName, [f.sig], risk, href => router.push(href)))}
                  title="Why this flag"
                  style={{ fontSize: 13.5, color: f.color, display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', paddingBottom: 2 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: f.color }} />{f.label}
                </span>
              ))}
              {flags.length === 0 && <span style={{ fontSize: 13.5, color: 'var(--ink-faint)' }}>No open flags.</span>}
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.8px', textTransform: 'uppercase', color: 'var(--accent)', paddingBottom: 12, borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>AI risk signals</div>
            {demo.riskLines?.map((r, i) => {
              const c = r.tone === 'high' ? 'var(--critical, #c43d2b)' : r.tone === 'watch' ? 'var(--warn, #d38b1d)' : 'var(--good, #2f8f5b)'
              return (
                <div key={`rl${i}`} style={{ display: 'flex', gap: 14, padding: '16px 0', borderTop: i === 0 ? 0 : '1px solid var(--hairline, #EFEAE1)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 8, flex: 'none', background: c }} />
                  <div style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink)' }}>{r.text}</div>
                </div>
              )
            })}
            {!demo.riskLines && open.length === 0 && <div style={{ padding: '22px 0', fontSize: 14, color: 'var(--ink-faint)' }}>Nothing open on this account.</div>}
            {!demo.riskLines && open.map(s => (
              <div key={s.id} onClick={() => router.push(`/signals?signal=${s.id}`)}
                style={{ display: 'flex', gap: 14, padding: '18px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 8, flex: 'none', background: s.severity === 'high' ? 'var(--critical, #c43d2b)' : s.severity === 'positive' ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)' }} />
                <div className="read-prose read-prose-ink">{s.description || s.title}</div>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 16 }}>Health breakdown</div>
            {breakdown.map(b => (
              <div key={b.k} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 7 }}>
                  <span style={{ color: 'var(--ink)' }}>{b.k}</span>
                  <span style={{ color: healthTone(b.v) }}>{b.v}%</span>
                </div>
                <div style={{ height: 3, background: 'var(--hairline, #EFEAE1)', position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${b.v}%`, background: healthTone(b.v) }} />
                </div>
              </div>
            ))}
            <div style={{ display: 'grid', gap: 10, marginTop: 30 }}>
              <button onClick={() => router.push(`/ask?q=${encodeURIComponent(`What is happening with ${acct.name} and what should I do next?`)}`)}
                style={{ font: 'inherit', fontSize: 14, fontWeight: 600, padding: '14px 0', borderRadius: 'var(--toggle-radius, 0px)', border: 0, background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', cursor: 'pointer', boxShadow: '0 8px 22px -10px rgba(255,107,53,.6)' }}>
                Ask Popsicle about this account
              </button>
              <button onClick={() => open[0] ? router.push(`/signals?signal=${open[0].id}&action=reply`) : router.push('/signals')}
                style={{ font: 'inherit', fontSize: 14, fontWeight: 600, padding: '14px 0', borderRadius: 'var(--toggle-radius, 0px)', border: '1px solid var(--border)', background: 'var(--raised, #FFFDFA)', color: 'var(--ink)', cursor: 'pointer' }}>
                Draft email
              </button>
              <button onClick={() => setTab('timeline')}
                style={{ font: 'inherit', fontSize: 14, fontWeight: 500, padding: '14px 0', borderRadius: 'var(--toggle-radius, 0px)', border: 0, background: 'var(--inset, #F0EDE7)', color: 'var(--ink-muted)', cursor: 'pointer' }}>
                View timeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMMS */}
      {tab === 'comms' && demo.comms && (
        <CommsThread account={accountName} onAsk={q => router.push(`/ask?q=${encodeURIComponent(q)}&account=${encodeURIComponent(accountName)}`)} onDraft={open[0] ? () => router.push(`/signals?signal=${open[0].id}&action=reply`) : undefined}
          items={demo.comms.map(c => ({ who: c.who, role: c.role, via: c.via, when: c.when, text: c.quote, tone: (c.who.startsWith('#') ? 'internal' : c.tone === 'positive' ? 'positive' : c.tone === 'negative' ? 'negative' : 'neutral') as ThreadItem['tone'], mine: /^(Andy G|Mike Ross|Jamie Torres)$/.test(c.who), source: demo.threads?.[c.who] }))} />
      )}
      {tab === 'comms' && !demo.comms && (() => {
        const sorted = [...messages].filter(m => m.received_at).sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)))
        if (!sorted.length) return <EmptyState line="No correspondence recorded yet." hint="Messages appear here as soon as a connected inbox or chat sees this account." />
        const items: ThreadItem[] = sorted.map(m => {
          const out = (m.direction || '').toLowerCase() === 'outbound'
          const who = out ? 'You' : ((m.sender || '').replace(/<.*>/, '').split('@')[0].replace(/[._]/g, ' ').trim() || 'Them')
          return { who, via: m.integration || 'gmail', when: mounted && m.received_at ? formatWhen(m.received_at) : '', text: (m.content || m.subject || '').replace(/\s+/g, ' ').trim().slice(0, 600), tone: out ? 'neutral' : 'neutral', mine: out, label: m.subject && m.content ? m.subject : undefined }
        })
        return <CommsThread account={accountName} items={items} onAsk={q => router.push(`/ask?q=${encodeURIComponent(q)}&account=${encodeURIComponent(accountName)}`)} onDraft={open[0] ? () => router.push(`/signals?signal=${open[0].id}&action=reply`) : undefined} />
      })()}

      {tab === 'people' && (() => {
        if (!people.length) return <EmptyState line="No contacts mapped yet." hint="Contacts appear as Popsicle sees who writes, who is copied and who decides. You can add one from the account slide-over." />
        const badgeColor = (b: string) => /CHAMPION|SPONSOR|POWER/.test(b) ? 'var(--good, #2f8f5b)' : /BLOCKER|DECISION/.test(b) ? 'var(--critical, #c43d2b)' : /UNKNOWN/.test(b) ? 'var(--ink-faint)' : 'var(--warn, #d38b1d)'
        return (
          <div style={{ marginTop: 8 }}>
            {people.map(p => (
              <div key={p.name} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) 150px', gap: 18, alignItems: 'start', padding: '20px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                <span style={{ width: 44, height: 44, borderRadius: '50%', background: healthTone(p.eng), opacity: .9, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 14 }}>{p.name.split(' ').map(x => x[0]).join('').slice(0, 2)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</span>
                    <span style={{ fontSize: 13.5, color: 'var(--ink-muted)' }}>{p.role}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.2px', color: badgeColor(p.badge) }}>{p.badge}</span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.55, marginTop: 6, maxWidth: 620 }}>{p.desc}</div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}><span>{p.status}{p.last && p.last !== 'never' ? ` · ${p.last}` : ''}</span><span style={{ color: healthTone(p.eng) }}>{p.eng}%</span></div>
                  <div style={{ height: 3, background: 'var(--hairline, #EFEAE1)', marginTop: 8, position: 'relative' }}><span style={{ position: 'absolute', inset: 0, width: `${p.eng}%`, background: healthTone(p.eng) }} /></div>
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {tab === 'contracts' && (() => {
        if (!contracts.length) return <EmptyState line="No contracts on file." hint="Contracts show up here once HubSpot or your billing system is connected, or when a signed agreement is attached to the account." />
        const tone = (st: string) => /HOLD|BLOCK/.test(st) ? 'var(--critical, #c43d2b)' : /DUE|PENDING|AWAITING|REVIEW|LEGAL|SENT/.test(st) ? 'var(--warn, #d38b1d)' : 'var(--good, #2f8f5b)'
        return (
          <div style={{ marginTop: 8 }}>
            {contracts.map(c => (
              <div key={c.name} style={{ padding: '22px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.2px', color: tone(c.status) }}>{c.status}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: '-.03em', color: 'var(--ink)' }}>{c.value}</span>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 4 }}>{c.type}</div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 12, fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>
                  <span>{c.po}</span><span>{c.start} → {c.end}</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink-muted)', marginTop: 10, lineHeight: 1.55 }}>{c.invoice}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {tab === 'timeline' && <MergedTimeline account={accountName} signals={signals as never} />}
    </div>
  )
}
