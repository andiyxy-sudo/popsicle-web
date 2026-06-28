import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { DashboardClient } from './DashboardClient'
import { formatCurrency } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [signalsRes, accountsRes, integrationsRes] = await Promise.all([
    supabase
      .from('signals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_dismissed', false)
      .eq('is_snoozed', false)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('accounts')
      .select('id, name, health_score, value, risk_level, stage')
      .eq('user_id', user.id),
    supabase
      .from('integrations')
      .select('provider, is_active, needs_reconnect')
      .eq('user_id', user.id),
  ])

  const signals = signalsRes.data ?? []
  const accounts = accountsRes.data ?? []
  const integrations = integrationsRes.data ?? []

  // KPI calcs
  const totalPipeline = accounts.reduce((s, a) => s + (a.value ?? 0), 0)
  const atRisk = accounts.filter(a => a.risk_level === 'high').length
  const highSignals = signals.filter(s => s.severity === 'high').length
  const activeIntegrations = integrations.filter(i => i.is_active && !i.needs_reconnect).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar
        eyebrow="Revenue Intelligence"
        title="Signals"
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px 56px' }}>
        {/* KPI Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 20, marginBottom: 40,
        }}>
          {[
            {
              label: 'Pipeline Value',
              value: formatCurrency(totalPipeline),
              sub: `${accounts.length} accounts`,
              color: 'var(--o)',
            },
            {
              label: 'At-Risk Accounts',
              value: String(atRisk),
              sub: atRisk > 0 ? 'need attention' : 'all clear',
              color: atRisk > 0 ? 'var(--danger)' : 'var(--ok)',
            },
            {
              label: 'Active Signals',
              value: String(signals.length),
              sub: `${highSignals} high severity`,
              color: highSignals > 0 ? 'var(--danger)' : 'var(--t3)',
            },
            {
              label: 'Connected',
              value: String(activeIntegrations),
              sub: 'integrations active',
              color: activeIntegrations > 0 ? 'var(--ok)' : 'var(--t4)',
            },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: 'var(--surface)',
              borderRadius: 'var(--r)',
              padding: 22,
              boxShadow: 'var(--sh-sm)',
              border: '1px solid var(--border-soft)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', marginBottom: 8 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-1.5px', color: kpi.color, lineHeight: 1 }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>
                {kpi.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Reconnect warnings */}
        {integrations.filter(i => i.needs_reconnect).map(i => (
          <div key={i.provider} style={{
            background: 'var(--amber-bg)',
            border: '1px solid var(--amber-bd)',
            borderRadius: 'var(--r-sm)',
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2.2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style={{ color: 'var(--amber)', fontWeight: 600 }}>
              {i.provider.charAt(0).toUpperCase() + i.provider.slice(1)} needs to be reconnected.
            </span>
            <a href="/integrations" style={{ marginLeft: 'auto', color: 'var(--amber)', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
              Fix now
            </a>
          </div>
        ))}

        {/* Signals feed */}
        <DashboardClient initialSignals={signals} userId={user.id} />
      </div>
    </div>
  )
}
