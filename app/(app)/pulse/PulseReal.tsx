'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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

export function PulseReal({ name, accounts, signals, integrationCount }: Props) {
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: integrationCount > 0 ? 'var(--ok)' : 'var(--t4)' }}></div>
            <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>
              {integrationCount} integration{integrationCount === 1 ? '' : 's'} connected
            </span>
          </div>
        </div>
      </div>

      <PreMeetingBrief />

      <div className="kpi-grid">
        <div className="kpi-hero">
          <div className="kpi-hero-lbl">Pipeline Value</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <div className="kpi-hero-val">{formatCurrency(pipelineValue)}</div>
          </div>
          <div className="kpi-hero-footer">
            <div className="kpi-hero-stat"><strong>{accounts.length}</strong>Accounts</div>
            <div className="kpi-hero-stat"><strong>{signals.length}</strong>Signals</div>
            <div className="kpi-hero-stat"><strong>{atRisk.length}</strong>At risk</div>
          </div>
        </div>

        <div className="dcard kpi-support kpi-support-danger">
          <div className="dcard-title">Revenue at Risk</div>
          <div className="dcard-val" style={{ color: 'var(--danger)' }}>{atRiskValue > 0 ? formatCurrency(atRiskValue) : '--'}</div>
          <div className="dcard-sub">{atRisk.length} account{atRisk.length === 1 ? '' : 's'} flagged high risk</div>
        </div>

        <div className="dcard kpi-support kpi-support-blue">
          <div className="dcard-title">Active Signals</div>
          <div className="dcard-val">{signals.length}</div>
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
