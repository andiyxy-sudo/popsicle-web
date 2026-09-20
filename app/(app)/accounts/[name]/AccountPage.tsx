'use client'

import { healthTone, formatWhen } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'

// Account 360 as a full page, matching the design: breadcrumb, name + ARR,
// four stats with a health sparkline, five tabs, and an Overview built from
// the account's real signals. Demo accounts read from the bundled dataset;
// real accounts read the get_account_360 RPC.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DEMO_PEOPLE, DEMO_CONTRACTS, DEMO_EXTRA, DEMO_COMMS, DEMO_TIMELINE, DEMO_RISK_LINES } from '@/lib/demo-dataset'

// Demo slices for this one account arrive as props from the server page, so
// the client bundle never includes the whole demo dataset.
export type DemoSlices = { people?: (typeof DEMO_PEOPLE)[string]; contracts?: (typeof DEMO_CONTRACTS)[string]; extra?: (typeof DEMO_EXTRA)[string]; comms?: (typeof DEMO_COMMS)[string]; timeline?: (typeof DEMO_TIMELINE)[string]; riskLines?: (typeof DEMO_RISK_LINES)[string] }
import { RiskFlagSheet, buildFlag, type RiskFlag } from '@/components/account/RiskFlagSheet'

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
type ThreadItem = { who: string; role?: string; via: string; when: string; text: string; tone: 'positive' | 'neutral' | 'negative' | 'internal'; mine?: boolean; label?: string }
type RailItem = { title: string; body?: string; when: string; kind: 'positive' | 'watch' | 'negative' | 'call' | 'info'; tags?: string[]; onClick?: () => void; done?: boolean }

const CHANNEL: Record<string, { label: string; glyph: string; color: string }> = {
  gmail: { label: 'Gmail', glyph: 'M', color: '#c43d2b' }, outlook: { label: 'Outlook', glyph: 'O', color: '#2f6f9f' }, whatsapp: { label: 'WhatsApp', glyph: 'W', color: '#25a45a' },
  slack: { label: 'Slack', glyph: 'S', color: '#7C5CFC' }, phone: { label: 'Phone', glyph: 'P', color: '#0E0D0B' }, zoom: { label: 'Zoom', glyph: 'Z', color: '#2f6f9f' },
  linkedin: { label: 'LinkedIn', glyph: 'in', color: '#2f6f9f' }, hubspot: { label: 'HubSpot', glyph: 'H', color: '#E85A25' }, fireflies: { label: 'Fireflies', glyph: 'F', color: '#7C5CFC' }, gcal: { label: 'Calendar', glyph: 'C', color: '#2f6f9f' },
}
const TONE_META = {
  positive: { c: 'var(--good, #2f8f5b)', t: 'Positive signal' },
  neutral: { c: 'var(--warn, #d38b1d)', t: 'Neutral signal' },
  negative: { c: 'var(--critical, #c43d2b)', t: 'Negative signal' },
  internal: { c: 'var(--ink-faint, #A09C97)', t: 'Internal' },
} as const

function CommsThread({ items, account, onAsk, onDraft }: { items: ThreadItem[]; account: string; onAsk: (q: string) => void; onDraft?: () => void }) {
  const viaSet = Array.from(new Set(items.map(i => CHANNEL[i.via.toLowerCase()]?.label ?? i.via)))
  const counts = { positive: items.filter(i => i.tone === 'positive').length, negative: items.filter(i => i.tone === 'negative').length, neutral: items.filter(i => i.tone === 'neutral').length }
  const initials = (n: string) => n.replace(/^#/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '·'
  return (
    <div style={{ marginTop: 22 }}>
      {/* summary strip */}
      <div className="g2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', paddingBottom: 14, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 21, letterSpacing: '-.03em', color: 'var(--ink)' }}>Recent communications</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span>{items.length} messages</span>
          {counts.positive > 0 && <span style={{ color: TONE_META.positive.c }}>{counts.positive} positive</span>}
          {counts.neutral > 0 && <span style={{ color: TONE_META.neutral.c }}>{counts.neutral} neutral</span>}
          {counts.negative > 0 && <span style={{ color: TONE_META.negative.c }}>{counts.negative} negative</span>}
          <span>via {viaSet.join(' · ')}</span>
        </div>
      </div>
      {/* thread */}
      <div style={{ position: 'relative', marginTop: 8 }}>
        <span aria-hidden style={{ position: 'absolute', left: 21, top: 30, bottom: 30, width: 1, background: 'var(--hairline, #EFEAE1)' }} />
        {items.map((m, i) => {
          const tone = TONE_META[m.tone]
          const ch = CHANNEL[m.via.toLowerCase()] ?? { label: m.via, glyph: m.via.slice(0, 1).toUpperCase(), color: '#5C5855' }
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr)', gap: 18, padding: '22px 0', position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 14, color: m.mine ? '#fff' : tone.c, background: m.mine ? 'var(--ink, #0E0D0B)' : 'var(--paper, #FBF8F3)', border: `2px solid ${m.mine ? 'var(--ink, #0E0D0B)' : tone.c}`, position: 'relative', zIndex: 1 }}>{m.mine ? 'ME' : initials(m.who)}</span>
                <span title={ch.label} style={{ position: 'absolute', right: -4, bottom: -2, width: 18, height: 18, borderRadius: 4, background: ch.color, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700, zIndex: 2, border: '2px solid var(--paper, #FBF8F3)' }}>{ch.glyph}</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)' }}>{m.mine ? 'You' : m.who}</span>
                  {m.role && <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{m.role}</span>}
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>via {ch.label}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{m.when}</span>
                </div>
                <div style={{ marginTop: 10, padding: '14px 18px', background: m.mine ? 'transparent' : 'var(--inset, #F4F0E8)', border: m.mine ? '1px solid var(--hairline, #EFEAE1)' : '1px solid transparent', borderLeft: `3px solid ${tone.c}`, fontSize: 15, lineHeight: 1.65, color: 'var(--ink)', maxWidth: 720 }}>
                  {m.label && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 6 }}>{m.label}</div>}
                  &ldquo;{m.text}&rdquo;
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: tone.c, display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: tone.c }} />{tone.t}</span>
                  <span onClick={() => onAsk(`In the message from ${m.who} at ${account} via ${ch.label} ("${m.text.slice(0, 80)}…"), what does it mean for the deal and how should I reply?`)} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}>Ask AI about this →</span>
                  {onDraft && !m.mine && <span onClick={onDraft} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-muted)', cursor: 'pointer' }}>Draft reply</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div onClick={() => onAsk(`Summarise the recent communications with ${account}: who said what, the tone, and the one thing I should do next.`)} style={{ display: 'inline-block', fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginTop: 10, cursor: 'pointer' }}>Ask AI to summarise this thread →</div>
    </div>
  )
}

function TimelineRail({ items, account, onAsk }: { items: RailItem[]; account: string; onAsk: (q: string) => void }) {
  const KIND = {
    positive: { c: 'var(--good, #2f8f5b)', g: '✓' }, watch: { c: 'var(--warn, #d38b1d)', g: '!' }, negative: { c: 'var(--critical, #c43d2b)', g: '↓' },
    call: { c: 'var(--blue, #2f6f9f)', g: '☎' }, info: { c: 'var(--ink-faint, #A09C97)', g: '·' },
  } as const
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, paddingBottom: 14, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 21, letterSpacing: '-.03em', color: 'var(--ink)' }}>Deal timeline</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{items.length} events · newest first</div>
      </div>
      <div style={{ position: 'relative', marginTop: 6 }}>
        <span aria-hidden style={{ position: 'absolute', left: 15, top: 34, bottom: 34, width: 1, background: 'var(--hairline, #EFEAE1)' }} />
        {items.map((t, i) => {
          const k = KIND[t.kind]
          const tinted = t.kind === 'negative' || t.kind === 'watch'
          return (
            <div key={i} onClick={t.onClick} style={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr)', gap: 18, padding: '18px 0', cursor: t.onClick ? 'pointer' : 'default' }}>
              <span style={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--paper, #FBF8F3)', border: `2px solid ${k.c}`, color: k.c, fontSize: 13, fontWeight: 700, position: 'relative', zIndex: 1, opacity: t.done ? .55 : 1 }}>{k.g}</span>
              <div style={{ padding: tinted ? '14px 18px' : '2px 0 0', background: tinted ? (t.kind === 'negative' ? 'rgba(196,61,43,.06)' : 'rgba(211,139,29,.08)') : 'transparent', borderLeft: tinted ? `3px solid ${k.c}` : 0, opacity: t.done ? .7 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{t.when}</span>
                </div>
                {t.body && <div style={{ fontSize: 14.5, color: 'var(--ink-muted)', lineHeight: 1.65, marginTop: 5, maxWidth: 720 }}>{t.body}</div>}
                {t.tags && t.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    {t.tags.map(tag => <span key={tag} style={{ fontSize: 11.5, color: 'var(--ink-muted)', background: 'var(--paper, #FBF8F3)', border: '1px solid var(--hairline, #EFEAE1)', padding: '3px 10px' }}>{tag}</span>)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div onClick={() => onAsk(`Walk me through the deal timeline for ${account}: what changed, in what order, and where the risk was introduced.`)} style={{ display: 'inline-block', fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginTop: 10, cursor: 'pointer' }}>Ask AI what changed →</div>
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
          <span style={{ color: riskColor }}>{health}</span>
          <svg width="120" height="34" viewBox="0 0 120 34" style={{ overflow: 'visible' }}>
            <path d={`M${spark}`} fill="none" stroke={riskColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </>, open.length ? `${open.length} open signal${open.length === 1 ? '' : 's'}` : 'no open signals')}
        {stat('Churn risk', `${Math.max(0, Math.min(100, 100 - health))}%`, health >= 70 ? 'low' : health >= 40 ? 'medium' : 'high', healthTone(health))}
        {stat('Renewal', extra?.expiry ?? (acct.close_date && mounted ? new Date(acct.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'), acct.stage || '')}
        {extra && stat('Trend', extra.trend, `rep score ${extra.repScore}`, extra.trend.startsWith('+') ? 'var(--good, #2f8f5b)' : 'var(--critical, #c43d2b)')}
        {stat('Exposure', money(open.reduce((a, s) => a + (Number(s.risk_amount) || 0), 0)), `${open.filter(s => s.severity === 'high').length} critical`, riskColor)}
        {stat('Last touch', daysDark != null ? (daysDark === 0 ? 'today' : `${daysDark}d ago`) : '--', acct.owner ? `owner ${acct.owner}` : '')}
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 26, marginTop: 34, borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
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
        <CommsThread account={accountName} onAsk={q => router.push(`/ask?q=${encodeURIComponent(q)}`)} onDraft={open[0] ? () => router.push(`/signals?signal=${open[0].id}&action=reply`) : undefined}
          items={demo.comms.map(c => ({ who: c.who, role: c.role, via: c.via, when: c.when, text: c.quote, tone: (c.who.startsWith('#') ? 'internal' : c.tone === 'positive' ? 'positive' : c.tone === 'negative' ? 'negative' : 'neutral') as ThreadItem['tone'], mine: /^(Andy G|Mike Ross|Jamie Torres)$/.test(c.who) }))} />
      )}
      {tab === 'comms' && !demo.comms && (() => {
        const sorted = [...messages].filter(m => m.received_at).sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)))
        if (!sorted.length) return <EmptyState line="No correspondence recorded yet." hint="Messages appear here as soon as a connected inbox or chat sees this account." />
        const items: ThreadItem[] = sorted.map(m => {
          const out = (m.direction || '').toLowerCase() === 'outbound'
          const who = out ? 'You' : ((m.sender || '').replace(/<.*>/, '').split('@')[0].replace(/[._]/g, ' ').trim() || 'Them')
          return { who, via: m.integration || 'gmail', when: mounted && m.received_at ? formatWhen(m.received_at) : '', text: (m.content || m.subject || '').replace(/\s+/g, ' ').trim().slice(0, 600), tone: out ? 'neutral' : 'neutral', mine: out, label: m.subject && m.content ? m.subject : undefined }
        })
        return <CommsThread account={accountName} items={items} onAsk={q => router.push(`/ask?q=${encodeURIComponent(q)}`)} onDraft={open[0] ? () => router.push(`/signals?signal=${open[0].id}&action=reply`) : undefined} />
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

      {tab === 'timeline' && demo.timeline && (
        <TimelineRail account={accountName} onAsk={q => router.push(`/ask?q=${encodeURIComponent(q)}`)}
          items={demo.timeline.map(t => ({ title: t.title, body: t.body, when: t.when, tags: t.tags, kind: (t.kind === 'negative' ? 'negative' : t.kind === 'watch' ? 'watch' : t.kind === 'call' ? 'call' : 'positive') as RailItem['kind'] }))} />
      )}
      {tab === 'timeline' && !demo.timeline && (() => {
        const sorted = [...signals].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        if (!sorted.length) return <EmptyState line="No timeline yet." hint="Every signal, call and commitment on this account lands here in order." />
        const items: RailItem[] = sorted.map(sg => ({
          title: sg.title || 'Signal', body: sg.description || undefined,
          when: mounted && sg.created_at ? formatWhen(sg.created_at) : '',
          kind: (sg.status === 'handled' ? 'positive' : sg.severity === 'high' ? 'negative' : sg.severity === 'positive' ? 'positive' : /call|meeting/.test(sg.signal_type || '') ? 'call' : 'watch') as RailItem['kind'],
          tags: [sg.source_integration ? `via ${sg.source_integration}` : null, sg.risk_amount ? `$${Math.round(Number(sg.risk_amount) / 1000)}K at risk` : null, sg.status === 'handled' ? (sg.handled_action || 'handled') : null].filter(Boolean) as string[],
          done: sg.status === 'handled', onClick: () => router.push(`/signals?signal=${sg.id}`),
        }))
        return <TimelineRail account={accountName} items={items} onAsk={q => router.push(`/ask?q=${encodeURIComponent(q)}`)} />
      })()}
    </div>
  )
}
