import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { PulseShowcase } from './PulseShowcase'
import { PulseReal } from './PulseReal'

export default async function PulsePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const isDemo = user.email === DEMO_EMAIL
  if (isDemo) {
    return <PulseShowcase />
  }

  // Real user: fetch live data
  const [accountsRes, signalsRes, integrationsRes] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', user.id).order('health_score', { ascending: true }),
    supabase.from('signals').select('*').eq('user_id', user.id).eq('is_dismissed', false).eq('is_snoozed', false).order('created_at', { ascending: false }),
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
