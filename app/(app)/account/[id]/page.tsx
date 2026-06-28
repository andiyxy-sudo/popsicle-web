import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { notFound } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

const SEVERITY_CONFIG = {
  high: { label: 'At Risk', bg: 'var(--danger-bg)', color: 'var(--danger)', border: 'var(--danger-bd)' },
  watch: { label: 'Watch', bg: 'var(--amber-bg)', color: 'var(--amber)', border: 'var(--amber-bd)' },
  positive: { label: 'Positive', bg: 'var(--ok-bg)', color: 'var(--ok)', border: 'var(--ok-bd)' },
}

export default async function AccountDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [accountRes, signalsRes, transcriptsRes, baselineRes] = await Promise.all([
    supabase.from('accounts').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('signals').select('*').eq('account_id', id).eq('user_id', user.id).eq('is_dismissed', false).order('created_at', { ascending: false }).limit(20),
    supabase.from('zoom_transcripts').select('*').eq('account_id', id).eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('account_baselines').select('*').eq('account_id', id).eq('user_id', user.id).single(),
  ])

  if (!accountRes.data) notFound()

  const account = accountRes.data
  const signals = signalsRes.data ?? []
  const transcripts = transcriptsRes.data ?? []
  const baseline = baselineRes.data

  const riskCfg = account.risk_level === 'high' ? { label: 'At Risk', color: 'var(--danger)', bg: 'var(--danger-bg)', border: 'var(--danger-bd)' }
    : account.risk_level === 'medium' ? { label: 'Watch', color: 'var(--amber)', bg: 'var(--amber-bg)', border: 'var(--amber-bd)' }
    : account.risk_level === 'low' ? { label: 'Healthy', color: 'var(--ok)', bg: 'var(--ok-bg)', border: 'var(--ok-bd)' }
    : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar
        eyebrow="Accounts"
        title={account.name}
        actions={
          <Link href="/accounts" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 'var(--r-sm)',
            background: 'var(--inset)', border: '1px solid var(--border)',
            fontSize: 12, fontWeight: 600, color: 'var(--t2)',
            textDecoration: 'none',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            All Accounts
          </Link>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px 56px' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 24,
          marginBottom: 32, paddingBottom: 28,
          borderBottom: '1px solid var(--border-soft)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--o-bg), var(--inset))',
            border: '1.5px solid var(--o-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 900, color: 'var(--o)',
          }}>
            {account.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--t1)', letterSpacing: '-0.8px' }}>
                {account.name}
              </h1>
              {riskCfg && (
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: '3px 10px',
                  borderRadius: 'var(--r-pill)', textTransform: 'uppercase',
                  fontFamily: "'DM Mono', monospace", letterSpacing: '.6px',
                  background: riskCfg.bg, color: riskCfg.color, border: `1px solid ${riskCfg.border}`,
                }}>
                  {riskCfg.label}
                </span>
              )}
            </div>
            {account.domain && (
              <p style={{ fontSize: 12, color: 'var(--t4)', fontFamily: "'DM Mono', monospace" }}>
                {account.domain}
              </p>
            )}
          </div>

          {/* Quick stats */}
          <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
            {[
              { label: 'Value', value: formatCurrency(account.value) },
              { label: 'Stage', value: account.stage ?? '--' },
              { label: 'Last Contact', value: formatDate(account.last_contact_date) },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28 }}>
          {/* Main column */}
          <div>
            {/* Signals */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>
                  Signals ({signals.length})
                </h2>
              </div>
              {signals.length === 0 ? (
                <div style={{
                  background: 'var(--surface)', borderRadius: 'var(--r)', padding: '32px 20px',
                  textAlign: 'center', border: '1px solid var(--border-soft)',
                }}>
                  <p style={{ color: 'var(--t4)', fontSize: 13 }}>No signals for this account yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {signals.map(signal => {
                    const cfg = SEVERITY_CONFIG[signal.severity as keyof typeof SEVERITY_CONFIG]
                    return (
                      <div key={signal.id} style={{
                        background: 'var(--surface)', borderRadius: 'var(--r)',
                        padding: '16px 18px', border: `1px solid ${cfg?.border ?? 'var(--border-soft)'}`,
                        boxShadow: 'var(--sh-sm)', position: 'relative',
                      }}>
                        {cfg && (
                          <div style={{
                            position: 'absolute', left: 0, top: 14, bottom: 14,
                            width: 3, borderRadius: '0 3px 3px 0',
                            background: cfg.color,
                          }} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          {cfg && (
                            <span style={{
                              fontSize: 9, fontWeight: 800, padding: '2px 8px',
                              borderRadius: 'var(--r-pill)', textTransform: 'uppercase',
                              fontFamily: "'DM Mono', monospace",
                              background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                            }}>
                              {cfg.label}
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: 'var(--t4)', fontFamily: "'DM Mono', monospace", marginLeft: 'auto' }}>
                            {formatDate(signal.created_at)}
                          </span>
                        </div>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>
                          {signal.title}
                        </h3>
                        {signal.ai_analysis?.summary && (
                          <p style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>
                            {signal.ai_analysis.summary}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Zoom Transcripts */}
            {transcripts.length > 0 && (
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', marginBottom: 16 }}>
                  Call Transcripts ({transcripts.length})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {transcripts.map(t => (
                    <div key={t.id} style={{
                      background: 'var(--surface)', borderRadius: 'var(--r)',
                      padding: '16px 18px', border: '1px solid var(--border-soft)',
                      boxShadow: 'var(--sh-sm)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: 7,
                          background: 'var(--blue-bg)', border: '1px solid var(--blue-bd)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--blue)',
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <polygon points="23 7 16 12 23 17 23 7"/>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                          </svg>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>
                            {t.topic ?? 'Zoom Call'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'DM Mono', monospace" }}>
                            {formatDate(t.created_at)}
                          </div>
                        </div>
                      </div>
                      {t.summary_text && (
                        <p style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 10 }}>
                          {t.summary_text}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {t.buying_signals && t.buying_signals.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--ok)', background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', borderRadius: 6, padding: '3px 8px' }}>
                            <span style={{ fontWeight: 700 }}>Buying signals: {t.buying_signals.length}</span>
                          </div>
                        )}
                        {t.objections && t.objections.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--amber)', background: 'var(--amber-bg)', border: '1px solid var(--amber-bd)', borderRadius: 6, padding: '3px 8px' }}>
                            <span style={{ fontWeight: 700 }}>Objections: {t.objections.length}</span>
                          </div>
                        )}
                        {t.risk_flags && t.risk_flags.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--danger)', background: 'var(--danger-bg)', border: '1px solid var(--danger-bd)', borderRadius: 6, padding: '3px 8px' }}>
                            <span style={{ fontWeight: 700 }}>Risk flags: {t.risk_flags.length}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            {/* Health score */}
            {account.health_score != null && (
              <div style={{
                background: 'var(--surface)', borderRadius: 'var(--r)',
                padding: '20px', boxShadow: 'var(--sh-sm)',
                border: '1px solid var(--border-soft)', marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', marginBottom: 12 }}>
                  Health Score
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-1.5px', color: account.health_score >= 70 ? 'var(--ok)' : account.health_score >= 40 ? 'var(--amber)' : 'var(--danger)', marginBottom: 10 }}>
                  {account.health_score}
                  <span style={{ fontSize: 16, color: 'var(--t4)', fontWeight: 400 }}>/100</span>
                </div>
                <div style={{ height: 6, background: 'var(--inset)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${account.health_score}%`,
                    background: account.health_score >= 70 ? 'var(--ok)' : account.health_score >= 40 ? 'var(--amber)' : 'var(--danger)',
                    transition: 'width 1s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Baseline stats */}
            {baseline && (
              <div style={{
                background: 'var(--surface)', borderRadius: 'var(--r)',
                padding: '20px', boxShadow: 'var(--sh-sm)',
                border: '1px solid var(--border-soft)', marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', marginBottom: 14 }}>
                  Communication Baseline
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {baseline.avg_reply_time_hours != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--t3)' }}>Avg reply time</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', fontFamily: "'DM Mono', monospace" }}>
                        {baseline.avg_reply_time_hours < 1
                          ? `${Math.round(baseline.avg_reply_time_hours * 60)}m`
                          : `${Math.round(baseline.avg_reply_time_hours)}h`}
                      </span>
                    </div>
                  )}
                  {baseline.contact_cadence_days != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--t3)' }}>Contact cadence</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', fontFamily: "'DM Mono', monospace" }}>
                        every {baseline.contact_cadence_days}d
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>Confidence</span>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                      textTransform: 'uppercase', fontFamily: "'DM Mono', monospace",
                      background: baseline.confidence === 'high' ? 'var(--ok-bg)' : 'var(--inset)',
                      color: baseline.confidence === 'high' ? 'var(--ok)' : 'var(--t3)',
                      border: `1px solid ${baseline.confidence === 'high' ? 'var(--ok-bd)' : 'var(--border)'}`,
                    }}>
                      {baseline.confidence}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Account details */}
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r)',
              padding: '20px', boxShadow: 'var(--sh-sm)',
              border: '1px solid var(--border-soft)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', marginBottom: 14 }}>
                Account Details
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Owner', value: account.owner },
                  { label: 'Stage', value: account.stage },
                  { label: 'Close date', value: formatDate(account.close_date) },
                  { label: 'Last contact', value: formatDate(account.last_contact_date) },
                ].map(row => row.value && (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--t3)', flexShrink: 0 }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', textAlign: 'right' }}>{row.value}</span>
                  </div>
                ))}
                {account.tags && account.tags.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 6 }}>Tags</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {account.tags.map((tag: string) => (
                        <span key={tag} style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px',
                          borderRadius: 6, background: 'var(--inset)',
                          border: '1px solid var(--border)', color: 'var(--t2)',
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
