import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { PulseShowcase } from './PulseShowcase'
import { PulseReal } from './PulseReal'

export default async function PulsePage() {
  const supabase = await createClient()
  // Fast local JWT read (no network round-trip). Layout already did the authoritative getUser() + redirect.
  const { data } = await supabase.auth.getClaims()
  if (!data) return null
  const claims = data.claims
  const email = claims.email as string | undefined
  const userId = claims.sub as string
  const userName = (claims.user_metadata?.name as string) || (email ? email.split('@')[0] : 'there')

  const isDemo = email === DEMO_EMAIL
  if (isDemo) {
    return <PulseShowcase />
  }

  // Real user: fetch live data
  const [accountsRes, signalsRes, integrationsRes] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId).order('health_score', { ascending: true }),
    supabase.from('signals').select('*').eq('user_id', userId).eq('is_dismissed', false).eq('is_snoozed', false).order('created_at', { ascending: false }),
    supabase.from('integrations').select('provider, is_active').eq('user_id', userId).eq('is_active', true),
  ])

  return (
    <PulseReal
      name={userName}
      accounts={accountsRes.data ?? []}
      signals={signalsRes.data ?? []}
      integrationCount={(integrationsRes.data ?? []).length}
    />
  )
}
