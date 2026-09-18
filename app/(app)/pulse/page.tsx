import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { DEMO_ACCOUNTS, DEMO_SIGNALS, DEMO_PULSE_STRIP } from '@/lib/demo-dataset'
import { PulseReal } from './PulseReal'

export default async function PulsePage() {
  const supabase = await createClient()
  // local JWT check instead of an auth-server round trip on every navigation
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData ? { id: claimsData.claims.sub as string, email: claimsData.claims.email as string | undefined, user_metadata: (claimsData.claims.user_metadata ?? {}) as { name?: string } } : null
  if (!user) return null

  const isDemo = user.email === DEMO_EMAIL
  if (isDemo) {
    // Demo showcases the SAME redesigned screen, fed by the static dataset.
    return <PulseReal name="Andy" accounts={DEMO_ACCOUNTS} signals={DEMO_SIGNALS} integrationCount={4} demoStrip={DEMO_PULSE_STRIP} />
  }

  // Real user: fetch live data
  const [accountsRes, signalsRes, integrationsRes] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', user.id).order('health_score', { ascending: true }),
    supabase.from('signals').select('*').eq('user_id', user.id).eq('is_dismissed', false).or('status.is.null,status.eq.open').order('surfaced_at', { ascending: false }).limit(150),
    supabase.from('integrations').select('provider, is_active').eq('user_id', user.id).eq('is_active', true),
  ])

  return (
    <PulseReal
      name={(user.user_metadata?.name as string) || user.email!.split('@')[0]}
      accounts={accountsRes.data ?? []}
      signals={signalsRes.data ?? []}
      integrationCount={(integrationsRes.data ?? []).length}
    />
  )
}
