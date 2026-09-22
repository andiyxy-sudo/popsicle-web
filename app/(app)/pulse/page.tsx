import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { DEMO_ACCOUNTS, DEMO_SIGNALS, DEMO_PULSE_STRIP, DEMO_LATE_COMMITMENTS, DEMO_PEOPLE, DEMO_TEAM } from '@/lib/demo-dataset'
import { PulseReal } from './PulseReal'
import { orgIdsServer } from '@/lib/org'
import { fetchAllData } from '@/lib/fetchAll'

export default async function PulsePage() {
  const supabase = await createClient()
  // local JWT check instead of an auth-server round trip on every navigation
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData ? { id: claimsData.claims.sub as string, email: claimsData.claims.email as string | undefined, user_metadata: (claimsData.claims.user_metadata ?? {}) as { name?: string } } : null
  if (!user) return null

  const isDemo = user.email === DEMO_EMAIL
  if (isDemo) {
    // Demo showcases the SAME redesigned screen, fed by the static dataset.
    return <PulseReal name="Andy" accounts={DEMO_ACCOUNTS} signals={DEMO_SIGNALS} integrationCount={4} demoStrip={DEMO_PULSE_STRIP} demoLate={DEMO_LATE_COMMITMENTS} meta={Object.fromEntries(DEMO_ACCOUNTS.map(a => [a.name, { role: (DEMO_PEOPLE[a.name] ?? []).find(p => p.name === a.owner)?.role, rep: DEMO_TEAM.reps.find(r => r.accounts.includes(a.name))?.name }]))} />
  }

  // Real user: fetch live data
  const [accountsRes, signalsRes, integrationsRes] = await Promise.all([
    supabase.from('accounts').select('*').in('user_id', await orgIdsServer(supabase, user.id)).order('health_score', { ascending: true }),
    fetchAllData(async (a, b) => supabase.from('signals').select('*').in('user_id', await orgIdsServer(supabase, user.id)).eq('is_dismissed', false).or('status.is.null,status.eq.open').order('surfaced_at', { ascending: false }).range(a, b)),   // every open signal (the figures need all of them)
    supabase.from('integrations').select('provider, is_active').in('user_id', await orgIdsServer(supabase, user.id)).eq('is_active', true),
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
