'use client'

import { healthTone } from '@/lib/utils'

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
                style={{ font: 'inherit', fontSize: 14, fontWeight: 600, padding: '14px 0', borderRadius: 999, border: 0, background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', cursor: 'pointer', boxShadow: '0 8px 22px -10px rgba(255,107,53,.6)' }}>
                Ask Popsicle about this account
              </button>
              <button onClick={() => open[0] ? router.push(`/signals?signal=${open[0].id}&action=reply`) : router.push('/signals')}
                style={{ font: 'inherit', fontSize: 14, fontWeight: 600, padding: '14px 0', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--raised, #FFFDFA)', color: 'var(--ink)', cursor: 'pointer' }}>
                Draft email
              </button>
              <button onClick={() => setTab('timeline')}
                style={{ font: 'inherit', fontSize: 14, fontWeight: 500, padding: '14px 0', borderRadius: 999, border: 0, background: 'var(--inset, #F0EDE7)', color: 'var(--ink-muted)', cursor: 'pointer' }}>
                View timeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMMS */}
      {tab === 'comms' && demo.comms && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 4 }}>Recent communications</div>
          {demo.comms.map((c, i) => {
            const tone = c.tone === 'positive' ? 'var(--good, #2f8f5b)' : c.tone === 'negative' ? 'var(--critical, #c43d2b)' : 'var(--warn, #d38b1d)'
            return (
              <div key={i} style={{ padding: '18px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)' }}>{c.who}</span>
                  <span style={{ fontSize: 13.5, color: 'var(--ink-muted)' }}>{c.role} · via {c.via}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{c.when}</span>
                </div>
                <div style={{ marginTop: 9, paddingLeft: 14, borderLeft: `2px solid ${tone}`, fontSize: 15, lineHeight: 1.65, color: 'var(--ink)' }}>&ldquo;{c.quote}&rdquo;</div>
                <div style={{ fontSize: 12.5, color: tone, marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: tone }} />{c.tone} signal
                </div>
              </div>
            )
          })}
        </div>
      )}
      {tab === 'comms' && !demo.comms && (() => {
        const sorted = [...messages].filter(m => m.received_at).sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)))
        if (!sorted.length) return <div style={{ padding: '30px 0', fontSize: 14, color: 'var(--ink-faint)' }}>No correspondence recorded for this account.</div>
        const dayLabel = (iso: string) => {
          const d = new Date(iso); const t = new Date(); t.setHours(0, 0, 0, 0)
          const y = new Date(t); y.setDate(y.getDate() - 1)
          const dd = new Date(d); dd.setHours(0, 0, 0, 0)
          if (dd.getTime() === t.getTime()) return 'Today'
          if (dd.getTime() === y.getTime()) return 'Yesterday'
          return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        }
        const initials = (n: string) => n.split(/[\s.@]+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase()
        let lastDay = ''
        return (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13.5, color: 'var(--ink-faint)', marginBottom: 8 }}>
              {sorted.length} message{sorted.length === 1 ? '' : 's'} · newest first · {sorted.filter(m => (m.direction || '').toLowerCase() === 'outbound').length} sent by you
            </div>
            {sorted.map(m => {
              const day = mounted ? dayLabel(m.received_at!) : ''
              const showDay = !!day && day !== lastDay
              if (showDay) lastDay = day
              const out = (m.direction || '').toLowerCase() === 'outbound'
              const who = out ? 'You' : ((m.sender || '').replace(/<.*>/, '').split('@')[0].replace(/[._]/g, ' ').trim() || 'Them')
              return (
                <div key={m.id}>
                  {showDay && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '30px 0 14px' }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{day}</span>
                      <span style={{ flex: 1, height: 1, background: 'var(--hairline, #EFEAE1)' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 14, padding: '14px 0' }}>
                    <span style={{ width: 32, height: 32, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center',
                      fontSize: 11, fontWeight: 700, letterSpacing: '.02em',
                      background: out ? 'var(--accent, #E85A25)' : 'var(--inset, #F0EDE7)', color: out ? '#fff' : 'var(--ink-muted)' }}>
                      {initials(who)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', textTransform: 'capitalize' }}>{who}</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '1.1px', textTransform: 'uppercase', color: out ? 'var(--accent)' : 'var(--ink-faint)' }}>
                          {out ? 'sent' : 'received'} · {m.integration}
                        </span>
                        <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>
                          {mounted && m.received_at ? new Date(m.received_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      {m.subject && <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginTop: 4 }}>{m.subject}</div>}
                      {m.content && (
                        <div style={{ fontSize: 14.5, color: 'var(--ink-muted)', lineHeight: 1.7, marginTop: 5, paddingLeft: 14, borderLeft: `2px solid ${out ? 'rgba(232,90,37,.28)' : 'var(--hairline, #EFEAE1)'}` }}>
                          {m.content}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* TIMELINE */}
      {tab === 'timeline' && demo.timeline && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>Deal timeline</div>
          {demo.timeline.map((t, i) => {
            const c = t.kind === 'negative' ? 'var(--critical, #c43d2b)' : t.kind === 'watch' ? 'var(--warn, #d38b1d)' : t.kind === 'call' ? 'var(--blue, #2f6f9f)' : 'var(--good, #2f8f5b)'
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '14px minmax(0,1fr) auto', gap: 14, alignItems: 'baseline', padding: '16px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', border: `2px solid ${c}`, alignSelf: 'center' }} />
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)' }}>{t.title}</div>
                  <div style={{ fontSize: 14.5, color: 'var(--ink-muted)', lineHeight: 1.62, marginTop: 4 }}>{t.body}</div>
                  {t.tags && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 9 }}>
                      {t.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 11.5, color: 'var(--ink-muted)', background: 'var(--inset, #F0EDE7)', borderRadius: 999, padding: '3px 10px' }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{t.when}</span>
              </div>
            )
          })}
        </div>
      )}
      {tab === 'timeline' && !demo.timeline && (() => {
        const sorted = [...signals].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        if (!sorted.length) return <div style={{ padding: '30px 0', fontSize: 14, color: 'var(--ink-faint)' }}>No signals on this account yet.</div>
        const monthOf = (iso?: string | null) => iso && mounted ? new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''
        let lastMonth = ''
        return (
          <div style={{ marginTop: 20 }}>
            {(() => {
              const done = sorted.filter(x => x.status === 'handled')
              if (!done.length) return null
              return (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ink-faint)', paddingBottom: 10, borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>Actions taken on this account · {done.length}</div>
                  {done.map(x => (
                    <div key={`log-${x.id}`} style={{ display: 'grid', gridTemplateColumns: '58px minmax(0,1fr) auto', gap: 12, alignItems: 'baseline', padding: '11px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{mounted && x.handled_at ? new Date(x.handled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                      <span style={{ fontSize: 14, color: 'var(--ink)' }}><span style={{ color: 'var(--good, #2f8f5b)', fontWeight: 600 }}>{x.handled_action || 'Handled'}</span><span style={{ color: 'var(--ink-faint)' }}> · </span><span style={{ color: 'var(--ink-muted)' }}>{x.title}</span></span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: 'var(--ink-faint)' }}>{x.source_integration ? `via ${x.source_integration}` : ''}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
            <div style={{ fontSize: 13.5, color: 'var(--ink-faint)', marginBottom: 6 }}>
              {sorted.length} signal{sorted.length === 1 ? '' : 's'} · {sorted.filter(x => x.status === 'handled').length} handled · newest first
            </div>
            {sorted.map(sg => {
              const c = sg.severity === 'high' ? 'var(--critical, #c43d2b)' : sg.severity === 'positive' ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)'
              const handled = sg.status === 'handled'
              const mth = monthOf(sg.created_at)
              const showMonth = !!mth && mth !== lastMonth
              if (showMonth) lastMonth = mth
              return (
                <div key={sg.id}>
                  {showMonth && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '28px 0 10px' }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{mth}</span>
                      <span style={{ flex: 1, height: 1, background: 'var(--hairline, #EFEAE1)' }} />
                    </div>
                  )}
                  <div onClick={() => router.push(`/signals?signal=${sg.id}`)}
                    style={{ display: 'grid', gridTemplateColumns: '58px 14px minmax(0,1fr) auto', gap: 12, alignItems: 'baseline', padding: '15px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer', opacity: handled ? .6 : 1 }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>
                      {mounted && sg.created_at ? new Date(sg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: handled ? 'transparent' : c, border: `2px solid ${c}`, alignSelf: 'center' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>
                        {handled && <span style={{ color: 'var(--good, #2f8f5b)' }}>✓ </span>}{sg.title}
                      </div>
                      {sg.description && sg.description !== sg.title && (
                        <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.6, marginTop: 4 }}>{sg.description}</div>
                      )}
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.1px', textTransform: 'uppercase', color: 'var(--ink-faint)', marginTop: 6 }}>
                        {TYPE_LABELS[sg.signal_type || ''] || 'signal'} · {sg.source_integration || 'unknown'}
                      </div>
                    </div>
                    {sg.risk_amount ? <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: c, whiteSpace: 'nowrap' }}>{money(sg.risk_amount)}</span> : <span />}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}
