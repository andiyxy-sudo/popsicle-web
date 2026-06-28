'use client'

import { useRouter } from 'next/navigation'
import type { Account, Signal } from '@/types'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'

interface Props {
  name: string
  accounts: Account[]
  signals: Signal[]
  integrationCount: number
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
            Connect Gmail, Slack, or Zoom and Popsicle will start surfacing revenue signals across your accounts automatically.
          </div>
          <button onClick={() => router.push('/integrations')} style={{ padding: '11px 22px', background: 'var(--o)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", boxShadow: '0 3px 14px rgba(255,107,53,.22)' }}>
            Connect your first integration →
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
