'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LOGOS } from '../integrations/IntegrationsShowcase'
import type { Account, Signal } from '@/types'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'

interface Props {
  name: string
  accounts: Account[]
  signals: Signal[]
  integrationCount: number
}


// Pre-meeting brief: within 30 minutes of a mapped-account meeting, assemble
// the walk-in card: top open signals, last touch, outstanding commitments from
// the latest analyzed call, and days dark. Data: gcal_event_state (RLS-scoped,
// account_name pre-computed server-side). Renders nothing when no meeting is
// near - honest empty state.
interface BriefData {
  summary: string; startTs: string; account: string
  signals: Array<{ id: string; title: string | null; severity: string | null }>
  lastTouch: string | null; daysDark: number | null
  commitments: Array<{ who?: string; what?: string }>
}

function PreMeetingBrief() {
  const router = useRouter()
  const [brief, setBrief] = useState<BriefData | null>(null)

  useEffect(() => {
    let dead = false
    async function load() {
      const supa = createClient()
      const { data: { user } } = await supa.auth.getUser()
      if (!user || dead) return
      const now = Date.now()
      const { data: ev } = await supa.from('gcal_event_state')
        .select('event_id, start_ts, summary, account_name')
        .eq('user_id', user.id).not('account_name', 'is', null)
        .gte('start_ts', new Date(now - 5 * 60_000).toISOString())
        .lte('start_ts', new Date(now + 30 * 60_000).toISOString())
        .order('start_ts', { ascending: true }).limit(1).maybeSingle()
      if (!ev || dead) return
      const account = String(ev.account_name)
      const [sigRes, blRes, acctRes] = await Promise.all([
        supa.from('signals').select('id, title, severity')
          .eq('user_id', user.id).eq('account_name', account)
          .eq('is_dismissed', false).eq('is_snoozed', false)
          .or('status.is.null,status.eq.open')
          .order('created_at', { ascending: false }).limit(3),
        supa.from('account_baselines').select('last_message_at')
          .eq('user_id', user.id).eq('account_name', account).maybeSingle(),
        supa.from('accounts').select('id').eq('user_id', user.id).eq('name', account).maybeSingle(),
      ])
      let commitments: Array<{ who?: string; what?: string }> = []
      if (acctRes.data?.id) {
        const { data: tr } = await supa.from('zoom_transcripts')
          .select('commitments').eq('user_id', user.id).eq('account_id', acctRes.data.id)
          .not('analyzed_at', 'is', null).order('start_time', { ascending: false }).limit(1).maybeSingle()
        commitments = (tr?.commitments as Array<{ who?: string; what?: string }>) ?? []
      }
      const lastTouch = blRes.data?.last_message_at ?? null
      if (dead) return
      setBrief({
        summary: String(ev.summary || 'Meeting'), startTs: String(ev.start_ts), account,
        signals: (sigRes.data ?? []) as BriefData['signals'],
        lastTouch,
        daysDark: lastTouch ? Math.floor((now - new Date(lastTouch).getTime()) / 86400_000) : null,
        commitments: commitments.slice(0, 3),
      })
    }
    load()
    const t = setInterval(load, 5 * 60_000)
    return () => { dead = true; clearInterval(t) }
  }, [])

  if (!brief) return null
  const mins = Math.max(0, Math.round((new Date(brief.startTs).getTime() - Date.now()) / 60_000))
  return (
    <div className="dcard fade-in" style={{ marginBottom: 18, padding: 0, overflow: 'hidden', border: '1px solid rgba(255,107,53,.35)', boxShadow: '0 4px 18px rgba(255,107,53,.12)' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--o)', padding: '3px 10px', borderRadius: 20, letterSpacing: '.5px' }}>{mins <= 1 ? 'STARTING NOW' : `IN ${mins} MIN`}</span>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--t1)' }}>{brief.summary}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t3)' }}>{brief.account}</span>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--t4)', fontFamily: "'DM Mono',monospace" }}>
          {brief.daysDark != null ? `Last touch ${brief.daysDark === 0 ? 'today' : brief.daysDark + 'd ago'}` : 'No touches recorded'}
        </div>
      </div>
      <div style={{ padding: '12px 20px', display: 'grid', gridTemplateColumns: brief.commitments.length ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>Open signals</div>
          {brief.signals.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--t4)' }}>None open. Clean slate.</div>}
          {brief.signals.map(sg => (
            <div key={sg.id} onClick={() => router.push(`/signals?signal=${sg.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, cursor: 'pointer' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: sg.severity === 'high' ? 'var(--danger)' : sg.severity === 'positive' ? 'var(--ok)' : 'var(--amber)' }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--t2)' }}>{sg.title}</span>
            </div>
          ))}
        </div>
        {brief.commitments.length > 0 && (
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>Outstanding commitments</div>
            {brief.commitments.map((c, i) => (
              <div key={i} style={{ fontSize: 11.5, color: 'var(--t2)', marginBottom: 5, lineHeight: 1.45 }}><b>{c.who}:</b> {c.what}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


// Live activity: recent signal events only (not raw inbox traffic) - each
// entry is something Popsicle judged worth surfacing, with its source platform.
function ActivityFeed({ signals }: { signals: Signal[] }) {
  const items = signals
    .filter(sg => !sg.is_dismissed && sg.status !== 'deleted')
    .slice(0, 6)
  const ago = (iso: string | null) => {
    if (!iso) return ''
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 60) return `${Math.max(1, m)}m`
    if (m < 1440) return `${Math.floor(m / 60)}h`
    return `${Math.floor(m / 1440)}d`
  }
  if (!items.length) return <div style={{ padding: '24px 20px', fontSize: 11.5, color: 'var(--t4)', textAlign: 'center' }}>Activity appears as signals arrive.</div>
  return (
    <div style={{ padding: '10px 20px' }}>
      {items.map(sg => (
        <div key={sg.id} className="activity-item">
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{LOGOS[sg.source_integration || ''] ?? <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase' }}>{(sg.source_integration || '?').slice(0, 2)}</span>}</div>
          <div className="activity-body">{sg.status === 'handled' && <span style={{ color: 'var(--ok)', fontWeight: 900 }}>✓ </span>}{sg.account_name ? <strong>{sg.account_name}</strong> : null}{sg.account_name ? ' — ' : ''}{sg.title}</div>
          <div className="activity-time">{ago(sg.created_at)}</div>
        </div>
      ))}
    </div>
  )
}


// AI Confidence ring (header, demo position): average model confidence across
// analyzed signals, with a click/hover popover explaining the number. Hidden
// until at least one signal carries a confidence value - never a made-up %.
function ConfidenceRing({ signals }: { signals: Signal[] }) {
  const [open, setOpen] = useState(false)
  const confs = signals.map(sg => (sg.ai_analysis as { confidence?: number } | null)?.confidence).filter((c): c is number => typeof c === 'number')
  if (!confs.length) return null
  const pct = Math.round(confs.reduce((a, b) => a + b, 0) / confs.length)
  const color = pct >= 80 ? '#22C55E' : pct >= 60 ? 'var(--amber)' : 'var(--danger)'
  const C = 2 * Math.PI * 19
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
      onClick={() => setOpen(o => !o)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className="conf-ring" style={{ width: 46, height: 46 }}>
        <svg width="46" height="46" viewBox="0 0 46 46" style={{ overflow: 'visible' }}>
          <circle cx="23" cy="23" r="19" fill="none" stroke="rgba(34,197,94,.12)" strokeWidth="3.5"/>
          <circle cx="23" cy="23" r="19" fill="none" stroke={color} strokeWidth="3.5" strokeDasharray={String(C)} strokeDashoffset={String(C * (1 - pct / 100))} strokeLinecap="round" transform="rotate(-90 23 23)"/>
        </svg>
        <div className="conf-ring-val" style={{ fontSize: 11, fontWeight: 900, color }}>{pct}%</div>
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color }}>AI Confidence</div>
        <div style={{ fontSize: 9, color: 'var(--t3)' }}>{confs.length} signal{confs.length === 1 ? '' : 's'}</div>
      </div>
      {open && (() => {
        const hi = confs.filter(c => c >= 80).length
        const mid = confs.filter(c => c >= 60 && c < 80).length
        const lo = confs.filter(c => c < 60).length
        const bar = (label: string, n: number, clr: string) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--t3)', width: 64 }}>{label}</span>
            <div style={{ flex: 1, height: 5, borderRadius: 4, background: 'var(--inset)', overflow: 'hidden' }}>
              <div style={{ width: `${confs.length ? Math.round(n / confs.length * 100) : 0}%`, height: '100%', background: clr, borderRadius: 4 }}></div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--t2)', fontFamily: "'DM Mono',monospace", width: 14, textAlign: 'right' }}>{n}</span>
          </div>
        )
        return (
          <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 288, background: 'var(--surface, #fff)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 16px 44px rgba(15,12,9,.18)', padding: '16px 18px', zIndex: 120, cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color }}>{pct}%</span>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--t1)' }}>average AI confidence</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--t3)', lineHeight: 1.55, marginBottom: 10 }}>
              Across {confs.length} analyzed signal{confs.length === 1 ? '' : 's'}. Confidence reflects how clear the evidence was in the source conversation.
            </div>
            {bar('High ≥80%', hi, 'var(--ok)')}
            {bar('Medium', mid, 'var(--amber)')}
            {bar('Low <60%', lo, 'var(--danger)')}
            <div style={{ fontSize: 10, color: 'var(--t4)', lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
              Open low-confidence signals and check the quoted evidence before acting. Marking wrong ones as removed teaches detection.
            </div>
          </div>
        )
      })()}
    </div>
  )
}


// Shared health formula: 100 minus open risk, plus positive momentum.
function computeHealth(signals: Signal[], accounts: Account[]): number {
  const open = signals.filter(sg => !sg.is_dismissed && !sg.is_snoozed && (!sg.status || sg.status === 'open'))
  const nHigh = open.filter(sg => sg.severity === 'high').length
  const nWatch = open.filter(sg => sg.severity === 'watch').length
  const nPos = signals.filter(sg => sg.severity === 'positive').length
  const nRiskAcct = accounts.filter(a => a.risk_level === 'high').length
  return Math.max(20, Math.min(98, 100 - nHigh * 8 - nWatch * 3 - nRiskAcct * 6 + nPos * 2))
}

export function PulseReal({ name, accounts, signals, integrationCount }: Props) {
  // Health trend: snapshot today's score, compare to the latest prior day.
  const [healthDelta, setHealthDelta] = useState<{ pts: number; label: string } | null>(null)
  useEffect(() => {
    let dead = false
    async function snap() {
      const supa = createClient()
      const { data: { user } } = await supa.auth.getUser()
      if (!user || dead) return
      const today = new Date().toISOString().slice(0, 10)
      const health = computeHealth(signals, accounts)
      await supa.from('pulse_health_history').upsert({ user_id: user.id, day: today, health }, { onConflict: 'user_id,day' })
      const { data: prev } = await supa.from('pulse_health_history')
        .select('day, health').eq('user_id', user.id).lt('day', today)
        .order('day', { ascending: false }).limit(1).maybeSingle()
      if (dead || !prev) return
      const pts = health - Number(prev.health)
      const days = Math.round((new Date(today).getTime() - new Date(String(prev.day)).getTime()) / 86400000)
      const label = days <= 1 ? 'vs yesterday' : days <= 7 ? `vs ${days}d ago` : 'vs last visit'
      if (pts !== 0) setHealthDelta({ pts, label })
    }
    snap()
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const router = useRouter()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const pipelineValue = accounts.reduce((s, a) => s + (a.value ?? 0), 0)
  const atRisk = accounts.filter(a => a.risk_level === 'high')
  const atRiskValue = atRisk.reduce((s, a) => s + (a.value ?? 0), 0)
  const highSignals = signals.filter(s => s.severity === 'high').length
  const watchSignals = signals.filter(s => s.severity === 'watch').length
  const posSignals = signals.filter(s => s.severity === 'positive').length

  const empty = accounts.length === 0 && signals.length === 0

  if (empty) {
    return (
      <div className="dsk-screen on">
        <div className="page-hdr fade-in">
          <p style={{ marginBottom: 4, fontSize: 15, fontWeight: 600, color: 'var(--t2)' }}>{greeting}, {name}.</p>
          <h1 style={{ marginBottom: 0 }}>Revenue Pulse</h1>
        </div>
        <div className="dcard fade-in" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ opacity: .25, marginBottom: 16 }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="1.5" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Welcome to Popsicle</div>
          <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto 20px' }}>
            {integrationCount > 0
              ? 'Your integration is connected. Next, let Popsicle scan your inbox and find the accounts worth watching.'
              : 'Connect Gmail and Popsicle will scan your inbox, find your accounts, and start surfacing revenue signals automatically.'}
          </div>
          <button onClick={() => router.push('/welcome')} style={{ padding: '11px 22px', background: 'var(--o)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", boxShadow: '0 3px 14px rgba(255,107,53,.22)' }}>
            {integrationCount > 0 ? 'Find my accounts →' : 'Set up Popsicle →'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dsk-screen on">
      <div className="page-hdr fade-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ marginBottom: 4, fontSize: 15, fontWeight: 600, color: 'var(--t2)' }}>{greeting}, {name}.</p>
            <h1 style={{ marginBottom: 0 }}>Revenue Pulse</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: integrationCount > 0 ? 'var(--ok)' : 'var(--t4)', animation: integrationCount > 0 ? 'pulse 2s ease-in-out infinite' : undefined }}></div>
              <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>
                {integrationCount} integration{integrationCount === 1 ? '' : 's'} connected
              </span>
            </div>
            <ConfidenceRing signals={signals} />
          </div>
        </div>
      </div>

      <PreMeetingBrief />


      <div className="kpi-grid">
        {(() => {
          // Deterministic pipeline health: start at 100, subtract for open
          // risk, credit positive momentum. Honest bounds, no invented deltas.
          const health = computeHealth(signals, accounts)
          const confs = signals.map(sg => (sg.ai_analysis as { confidence?: number } | null)?.confidence).filter((c): c is number => typeof c === 'number')
          const aiConf = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null
          return (
            <div className="kpi-hero">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div className="kpi-hero-lbl" style={{ marginBottom: 0 }}>Pipeline Health Score</div>
                <button onClick={() => router.push('/ask')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', color: '#fff', fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Ask
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div className="kpi-hero-val">{health}</div>
                  <span style={{ fontSize: 20, color: 'rgba(255,255,255,.4)', fontWeight: 500 }}>/100</span>
                  {healthDelta && (
                    <span className="kpi-hero-badge" style={{ marginLeft: 4 }}>
                      {healthDelta.pts > 0 ? '▲ +' : '▼ '}{healthDelta.pts} pts {healthDelta.label}
                    </span>
                  )}
                </div>
                <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.18)' }}></div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>Pipeline Value</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-.5px', lineHeight: 1 }}>{formatCurrency(pipelineValue)}</div>
                </div>
              </div>
              <div className="kpi-hero-footer">
                <div className="kpi-hero-stat"><strong>{accounts.length}</strong>Accounts</div>
                <div className="kpi-hero-stat"><strong>{signals.length}</strong>Signals</div>
                <div className="kpi-hero-stat"><strong>{atRisk.length}</strong>At risk</div>
                {aiConf != null && <div className="kpi-hero-stat"><strong>{aiConf}%</strong>AI conf</div>}
              </div>
            </div>
          )
        })()}

        <div className="dcard kpi-support kpi-support-danger">
          <div className="dcard-title">Revenue at Risk</div>
          <div className="dcard-val" style={{ color: 'var(--danger)' }}>{atRiskValue > 0 ? formatCurrency(atRiskValue) : '--'}</div>
          <div className="dcard-sub">{atRisk.length} account{atRisk.length === 1 ? '' : 's'} flagged high risk</div>
        </div>

        <div className="dcard kpi-support kpi-support-blue">
          <div className="dcard-title">Active Signals</div>
          <div className="dcard-val">{signals.length}</div>
          {(() => {
            const today = new Date(); today.setHours(0, 0, 0, 0)
            const n = signals.filter(sg => sg.created_at && new Date(sg.created_at) >= today).length
            return <div className="dcard-sub">{n > 0 ? <><span className="dcard-delta delta-up">▲ {n} new</span> today</> : 'No new signals today'}</div>
          })()}
          <div style={{ display: 'flex', gap: 10, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--danger)' }}>{highSignals}</strong> High</span>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--amber)' }}>{watchSignals}</strong> Watch</span>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--ok)' }}>{posSignals}</strong> Pos</span>
          </div>
        </div>

        <div className="dcard kpi-support kpi-support-ok">
          <div className="dcard-title">Connected</div>
          <div className="dcard-val" style={{ color: integrationCount > 0 ? 'var(--ok)' : 'var(--t4)' }}>{integrationCount}</div>
          <div className="dcard-sub">integration{integrationCount === 1 ? '' : 's'} active</div>
        </div>
      </div>

      {/* AI Brief + Revenue Loop + Activity (showcase layout, real data) */}
      {(() => {
        const open = signals.filter(sg => !sg.is_dismissed && !sg.is_snoozed && (!sg.status || sg.status === 'open'))
        const handled = signals.filter(sg => sg.status === 'handled')
        const highs = open.filter(sg => sg.severity === 'high')
        const positives = signals.filter(sg => sg.severity === 'positive')
        const bySrc = new Set(open.map(sg => sg.source_integration).filter(Boolean))
        const riskByAcct = new Map<string, number>()
        for (const sg of open) if (sg.account_name && sg.risk_amount) riskByAcct.set(sg.account_name, (riskByAcct.get(sg.account_name) || 0) + Number(sg.risk_amount))
        const topRisk = Array.from(riskByAcct.entries()).sort((a, b) => b[1] - a[1])[0]
        const openAccts = new Set(open.map(sg => sg.account_name).filter(Boolean))
        const protectedVal = handled.reduce((a, sg) => a + (Number(sg.risk_amount) || 0), 0)
        const stalest = [...accounts].filter(a => a.last_contact_date).sort((a, b) => String(a.last_contact_date).localeCompare(String(b.last_contact_date)))[0]
        const daysDark = stalest?.last_contact_date ? Math.floor((Date.now() - new Date(stalest.last_contact_date).getTime()) / 86400000) : null

        const briefItems: Array<{ color: string; bg: string; bd: string; text: React.ReactNode }> = []
        if (highs[0]) briefItems.push({ color: 'var(--danger)', bg: 'rgba(224,62,62,.04)', bd: 'rgba(224,62,62,.1)', text: <>{highs[0].account_name ? <strong>{highs[0].account_name}: </strong> : null}{highs[0].title}</> })
        if (topRisk) briefItems.push({ color: 'var(--amber)', bg: 'rgba(232,133,10,.04)', bd: 'rgba(232,133,10,.1)', text: <><strong>{formatCurrency(topRisk[1])}</strong> at risk on {topRisk[0]} — highest exposure right now</> })
        if (positives[0]) briefItems.push({ color: 'var(--ok)', bg: 'rgba(42,157,92,.04)', bd: 'rgba(42,157,92,.1)', text: <>{positives[0].account_name ? <strong>{positives[0].account_name}: </strong> : null}{positives[0].title}</> })
        if (stalest && daysDark != null && daysDark > 14) briefItems.push({ color: 'var(--blue)', bg: 'rgba(59,111,222,.04)', bd: 'rgba(59,111,222,.1)', text: <><strong>{stalest.name}</strong> dark for {daysDark} days — worth a touch this week</> })

        const secHead = (icon: React.ReactNode, label: string) => (
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon}
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>{label}</span>
          </div>
        )
        const loopStep = (title: string, sub: string, n: string, color: string, done?: boolean) => (
          <div className="loop-step" style={done ? { background: 'rgba(42,157,92,.06)', borderColor: 'rgba(42,157,92,.15)' } : undefined}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>{sub}</div></div>
            <span style={{ fontSize: 18, fontWeight: 900, color }}>{n}</span>
          </div>
        )

        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 320px', gap: 20, marginBottom: 24 }}>
            <div className="dcard fade-in fade-in-3" style={{ padding: 0, overflow: 'hidden' }}>
              {secHead(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, 'AI Brief')}
              <div style={{ padding: '14px 20px' }}>
                {briefItems.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--t4)', textAlign: 'center', padding: '14px 0' }}>All quiet. The brief fills in as signals arrive.</div>}
                {briefItems.map((b, i) => (
                  <div key={i} className="ai-brief-item" style={{ background: b.bg, border: `1px solid ${b.bd}`, borderRadius: 10 }}>
                    <div className="ai-brief-dot" style={{ background: b.color }}></div>
                    <div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.55 }}>{b.text}</div>
                  </div>
                ))}
                <div onClick={() => router.push('/ask')} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 11.5, fontWeight: 700, color: 'var(--o)', cursor: 'pointer' }}>Ask AI to expand on any insight →</div>
              </div>
            </div>

            <div className="dcard fade-in fade-in-4" style={{ padding: 0, overflow: 'hidden' }}>
              {secHead(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>, 'Revenue Loop')}
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {loopStep('Signals', bySrc.size ? `Across ${Array.from(bySrc).map(x => String(x)).join(' · ')}` : 'Open right now', String(open.length), 'var(--danger)')}
                <div className="loop-connector"></div>
                {loopStep('Accounts flagged', 'With at least one open signal', String(openAccts.size), 'var(--amber)')}
                <div className="loop-connector"></div>
                {loopStep('Handled', 'Actions you have taken', String(handled.length), 'var(--o)')}
                <div className="loop-connector"></div>
                {loopStep('Value acted on', 'At-risk $ on handled signals', protectedVal > 0 ? formatCurrency(protectedVal) : '$0', 'var(--ok)', true)}
              </div>
            </div>

            <div className="dcard fade-in fade-in-5" style={{ padding: 0, overflow: 'hidden' }}>
              {secHead(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, 'Activity')}
              <ActivityFeed signals={signals} />
            </div>
          </div>
        )
      })()}

      {/* Accounts needing attention */}
      {(() => {
        const open = signals.filter(sg => !sg.is_dismissed && !sg.is_snoozed && (!sg.status || sg.status === 'open'))
        const topSig = new Map<string, { title: string | null; severity: string | null }>()
        for (const sg of open) if (sg.account_name && !topSig.has(sg.account_name)) topSig.set(sg.account_name, { title: sg.title ?? null, severity: sg.severity ?? null })
        const rows = accounts
          .map(a => {
            const sg = topSig.get(a.name)
            const dark = a.last_contact_date ? Math.floor((Date.now() - new Date(a.last_contact_date).getTime()) / 86400000) : null
            return { a, sg, dark, score: (sg?.severity === 'high' ? 3 : sg ? 2 : 0) + ((dark ?? 0) > 21 ? 1 : 0) }
          })
          .filter(r => r.score > 0)
          .sort((x, y) => y.score - x.score || (Number(y.a.value) || 0) - (Number(x.a.value) || 0))
          .slice(0, 6)
        if (!rows.length) return null
        return (
          <div className="dcard fade-in fade-in-5" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Accounts Needing Attention</span>
              </div>
              <span className="see-all" onClick={() => router.push('/portfolio')} style={{ cursor: 'pointer' }}>View portfolio →</span>
            </div>
            <table className="dtable">
              <thead><tr><th>Account</th><th>Value</th><th>Stage</th><th>Top Signal</th><th>Last Touch</th></tr></thead>
              <tbody>
                {rows.map(({ a, sg, dark }) => (
                  <tr key={a.id} onClick={() => router.push(`/accounts?open=${encodeURIComponent(a.name)}`)} style={{ cursor: 'pointer' }}>
                    <td><div style={{ fontWeight: 700 }}>{a.name}</div>{a.owner && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{a.owner}</div>}</td>
                    <td style={{ fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>{a.value ? formatCurrency(Number(a.value)) : '--'}</td>
                    <td style={{ fontSize: 12, color: 'var(--t2)' }}>{a.stage || '--'}</td>
                    <td style={{ fontSize: 12, color: sg?.severity === 'high' ? 'var(--danger)' : sg?.severity === 'positive' ? 'var(--ok)' : 'var(--amber)' }}>{sg?.title || '--'}</td>
                    <td style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>{dark != null ? (dark === 0 ? 'today' : `${dark}d ago`) : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* Recent signals list */}
      <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Recent Signals</span>
          </div>
          <span className="see-all" onClick={() => router.push('/signals')}>View all →</span>
        </div>
        <div style={{ padding: 16 }}>
          {signals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--t4)', fontSize: 13 }}>No active signals yet</div>
          ) : signals.slice(0, 8).map(s => {
            const c = s.severity === 'high' ? 'var(--danger)' : s.severity === 'positive' ? 'var(--ok)' : 'var(--amber)'
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-soft)' }}>
                <div style={{ width: 3, height: 32, borderRadius: 2, background: c, flexShrink: 0 }}></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{s.title}</div>
                  {s.account_name && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{s.account_name}</div>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'DM Mono',monospace" }}>{formatRelativeTime(s.created_at)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
