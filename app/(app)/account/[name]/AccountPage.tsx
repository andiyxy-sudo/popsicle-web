'use client'

// Account 360 as a full page, matching the design: breadcrumb, name + ARR,
// four stats with a health sparkline, five tabs, and an Overview built from
// the account's real signals. Demo accounts read from the bundled dataset;
// real accounts read the get_account_360 RPC.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DEMO_ACCOUNTS, DEMO_SIGNALS, DEMO_MESSAGES, DEMO_PEOPLE, DEMO_CONTRACTS } from '@/lib/demo-dataset'

type Sig = { id: string; account_name?: string | null; signal_type?: string | null; severity?: string | null; title?: string | null; description?: string | null; risk_amount?: number | null; source_integration?: string | null; source_message_id?: string | null; created_at?: string | null; status?: string | null; is_dismissed?: boolean | null; ai_analysis?: Record<string, unknown> | null }
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

export function AccountPage({ accountName }: { accountName: string }) {
  const router = useRouter()
  const [tab, setTab] = useState<'overview' | 'comms' | 'people' | 'timeline' | 'contracts'>('overview')
  const [acct, setAcct] = useState<Acct | null>(null)
  const [signals, setSignals] = useState<Sig[]>([])
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    let dead = false
    async function load() {
      const demo = DEMO_ACCOUNTS.find(a => a.name === accountName) as Acct | undefined
      if (demo) {
        if (dead) return
        setAcct(demo)
        setSignals((DEMO_SIGNALS as unknown as Sig[]).filter(s => s.account_name === accountName))
        setMessages((DEMO_MESSAGES as unknown as Msg[]).filter(m => m.account_name === accountName).slice(0, 40))
        setLoading(false)
        return
      }
      const supa = createClient()
      const { data: { user } } = await supa.auth.getUser()
      if (!user) return
      const { data: a } = await supa.from('accounts').select('*').eq('user_id', user.id).eq('name', accountName).maybeSingle()
      if (!a) { if (!dead) setLoading(false); return }
      const payload = await supa.rpc('get_account_360', { p_account_id: a.id })
      const p = (payload.data ?? {}) as { messages?: Msg[]; signals?: Sig[] }
      if (dead) return
      setAcct(a as Acct)
      setSignals(p.signals ?? [])
      setMessages(p.messages ?? [])
      setLoading(false)
    }
    load()
    return () => { dead = true }
  }, [accountName])

  const open = useMemo(() => signals.filter(s => !s.is_dismissed && (!s.status || s.status === 'open')), [signals])
  const risk = (acct?.risk_level || (open.some(s => s.severity === 'high') ? 'high' : open.some(s => s.severity === 'watch') ? 'medium' : 'low')).toLowerCase()
  const riskColor = risk === 'high' ? 'var(--critical, #c43d2b)' : risk === 'medium' ? 'var(--warn, #d38b1d)' : 'var(--good, #2f8f5b)'
  const health = acct?.health_score ?? 50
  const daysDark = acct?.last_contact_date && mounted ? Math.floor((Date.now() - new Date(acct.last_contact_date).getTime()) / 86400000) : null
  const people = DEMO_PEOPLE[accountName] ?? []
  const contracts = DEMO_CONTRACTS[accountName] ?? []

  // health sparkline: trend implied by open severities over time
  const spark = useMemo(() => {
    const pts = [0, 1, 2, 3, 4, 5, 6].map(i => {
      const base = health + (open.filter(s => s.severity === 'high').length * 3) * (6 - i) / 6
      return Math.max(5, Math.min(100, base + (i % 2 === 0 ? 3 : -2)))
    })
    return pts.map((v, i) => `${(i / 6) * 120},${34 - (v / 100) * 28}`).join(' L')
  }, [health, open])

  const flags = open.slice(0, 3).map(s => ({
    label: TYPE_LABELS[s.signal_type || ''] || s.title || 'Signal',
    color: s.severity === 'high' ? 'var(--critical, #c43d2b)' : s.severity === 'positive' ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)',
  }))

  const breakdown = [
    { k: 'Engagement', v: Math.max(5, Math.min(100, health - open.filter(s => s.signal_type === 'silent_stall').length * 18)) },
    { k: 'Product fit', v: Math.max(20, Math.min(100, 60 + open.filter(s => s.severity === 'positive').length * 12)) },
    { k: 'Legal', v: Math.max(10, Math.min(100, 80 - open.filter(s => s.signal_type === 'legal_loopin').length * 40)) },
    { k: 'Financial', v: Math.max(10, Math.min(100, 75 - open.filter(s => s.signal_type === 'price_flinch').length * 35)) },
  ]

  if (loading) return <div className="dsk-screen on"><div style={{ padding: '60px 0', fontSize: 14, color: 'var(--ink-faint)' }}>Loading account…</div></div>
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
      {/* breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 36, gap: 16 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          <span onClick={() => router.push('/portfolio')} style={{ color: 'var(--accent)', cursor: 'pointer' }}>← Portfolio</span>
          <span style={{ margin: '0 8px' }}>/</span>Account 360
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: riskColor, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: riskColor }} />{risk} risk
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
        {stat('Renewal', acct.close_date && mounted ? new Date(acct.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--', acct.stage || '')}
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
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 26 }}>
              {flags.map((f, i) => (
                <span key={i} style={{ fontSize: 13.5, color: f.color, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: f.color }} />{f.label}
                </span>
              ))}
              {flags.length === 0 && <span style={{ fontSize: 13.5, color: 'var(--ink-faint)' }}>No open flags.</span>}
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.8px', textTransform: 'uppercase', color: 'var(--accent)', paddingBottom: 12, borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>AI risk signals</div>
            {open.length === 0 && <div style={{ padding: '22px 0', fontSize: 14, color: 'var(--ink-faint)' }}>Nothing open on this account.</div>}
            {open.map(s => (
              <div key={s.id} onClick={() => router.push(`/signals?signal=${s.id}`)}
                style={{ display: 'flex', gap: 14, padding: '18px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 8, flex: 'none', background: s.severity === 'high' ? 'var(--critical, #c43d2b)' : s.severity === 'positive' ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)' }} />
                <div style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink)' }}>{s.description || s.title}</div>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 16 }}>Health breakdown</div>
            {breakdown.map(b => (
              <div key={b.k} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 7 }}>
                  <span style={{ color: 'var(--ink)' }}>{b.k}</span>
                  <span style={{ color: b.v < 40 ? 'var(--critical, #c43d2b)' : b.v < 70 ? 'var(--warn, #d38b1d)' : 'var(--good, #2f8f5b)' }}>{b.v}%</span>
                </div>
                <div style={{ height: 3, background: 'var(--hairline, #EFEAE1)', position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${b.v}%`, background: b.v < 40 ? 'var(--critical, #c43d2b)' : b.v < 70 ? 'var(--warn, #d38b1d)' : 'var(--good, #2f8f5b)' }} />
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
      {tab === 'comms' && (
        <div style={{ marginTop: 26 }}>
          {messages.length === 0 && <div style={{ padding: '30px 0', fontSize: 14, color: 'var(--ink-faint)' }}>No correspondence recorded.</div>}
          {messages.map(m => (
            <div key={m.id} style={{ padding: '18px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{(m.sender || '').replace(/<.*>/, '').trim() || 'Message'}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{m.integration}{m.direction ? ` · ${m.direction}` : ''}</span>
                <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>
                  {mounted && m.received_at ? new Date(m.received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>
              {m.subject && <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-muted)', marginTop: 4 }}>{m.subject}</div>}
              {m.content && <div style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, marginTop: 4 }}>{m.content}</div>}
            </div>
          ))}
        </div>
      )}

      {/* PEOPLE */}
      {tab === 'people' && (
        <div style={{ marginTop: 26 }}>
          {people.length === 0 && <div style={{ padding: '30px 0', fontSize: 14, color: 'var(--ink-faint)' }}>No contact roles recorded for this account.</div>}
          {people.map(p => (
            <div key={p.name} style={{ padding: '20px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</span>
                <span style={{ fontSize: 13.5, color: 'var(--ink-muted)' }}>{p.role}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '1.2px', color: p.badge === 'CHAMPION' ? 'var(--good, #2f8f5b)' : p.badge === 'INFLUENCER' ? 'var(--blue, #2f6f9f)' : 'var(--critical, #c43d2b)' }}>{p.badge}</span>
                <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{p.last}</span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, marginTop: 6 }}>{p.desc}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                <span style={{ width: 200, height: 3, background: 'var(--hairline, #EFEAE1)', position: 'relative' }}>
                  <span style={{ position: 'absolute', inset: 0, width: `${p.eng}%`, background: p.eng >= 70 ? 'var(--good, #2f8f5b)' : p.eng >= 40 ? 'var(--warn, #d38b1d)' : 'var(--critical, #c43d2b)' }} />
                </span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{p.eng}% engaged · {p.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TIMELINE */}
      {tab === 'timeline' && (
        <div style={{ marginTop: 26 }}>
          {signals.length === 0 && <div style={{ padding: '30px 0', fontSize: 14, color: 'var(--ink-faint)' }}>No signals on this account yet.</div>}
          {signals.map(s => (
            <div key={s.id} onClick={() => router.push(`/signals?signal=${s.id}`)}
              style={{ display: 'flex', gap: 16, padding: '18px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer' }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)', width: 64, flex: 'none', paddingTop: 3 }}>
                {mounted && s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
              </span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 8, flex: 'none', background: s.severity === 'high' ? 'var(--critical, #c43d2b)' : s.severity === 'positive' ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{s.title}</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 3, lineHeight: 1.55 }}>{s.description}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 6 }}>
                  {TYPE_LABELS[s.signal_type || ''] || 'signal'} · via {s.source_integration || 'unknown'}{s.status === 'handled' ? ' · handled' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CONTRACTS */}
      {tab === 'contracts' && (
        <div style={{ marginTop: 26 }}>
          {contracts.length === 0 && <div style={{ padding: '30px 0', fontSize: 14, color: 'var(--ink-faint)' }}>No contracts on file for this account.</div>}
          {contracts.map(c => (
            <div key={c.name} style={{ padding: '20px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '1.2px', color: c.status.includes('DUE') || c.status.includes('PENDING') || c.status.includes('NEGOTIATION') || c.status.includes('REVIEW') ? 'var(--warn, #d38b1d)' : 'var(--good, #2f8f5b)' }}>{c.status}</span>
                <span style={{ marginLeft: 'auto', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-.03em', color: 'var(--ink)' }}>{c.value}</span>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 4 }}>{c.type}</div>
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 10, fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>
                <span>{c.po}</span><span>{c.start} → {c.end}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 8 }}>{c.invoice}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
