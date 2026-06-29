import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { IntegrationsShowcase } from './IntegrationsShowcase'
import { IntegrationsReal, ProviderStat } from './IntegrationsReal'

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data) return null
  const claims = data.claims
  const email = claims.email as string | undefined
  const userId = claims.sub as string

  if (email === DEMO_EMAIL) {
    return <IntegrationsShowcase />
  }

  const [{ data: integrations }, { data: signals }] = await Promise.all([
    supabase.from('integrations').select('provider, is_active, connected_at, last_synced_at').eq('user_id', userId),
    supabase.from('signals').select('source_integration, severity, created_at').eq('user_id', userId).eq('is_dismissed', false),
  ])

  const activeRows = (integrations ?? []).filter(i => i.is_active)
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

  // Build per-provider stats from the signals table.
  const stats: Record<string, ProviderStat> = {}
  for (const row of activeRows) {
    const sigs = (signals ?? []).filter(s => s.source_integration === row.provider)
    const high = sigs.filter(s => s.severity === 'high').length
    const watch = sigs.filter(s => s.severity === 'watch').length
    const positive = sigs.filter(s => s.severity === 'positive').length
    const thisMonth = sigs.filter(s => s.created_at && new Date(s.created_at) >= monthStart).length
    const lastSignal = sigs.reduce<string | null>((latest, s) => {
      if (!s.created_at) return latest
      return !latest || s.created_at > latest ? s.created_at : latest
    }, null)
    stats[row.provider] = {
      total: sigs.length, thisMonth, high, watch, positive,
      lastSignal, connectedAt: row.connected_at ?? null, lastSynced: row.last_synced_at ?? null,
    }
  }

  return <IntegrationsReal active={activeRows.map(i => i.provider)} stats={stats} />
}
