import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { SignalsShowcase } from './SignalsShowcase'
import { SignalsReal } from './SignalsReal'

export default async function SignalsPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data) return null
  const claims = data.claims
  const email = claims.email as string | undefined
  const userId = claims.sub as string

  if (email === DEMO_EMAIL) {
    return <SignalsShowcase />
  }

  const { data: signals } = await supabase
    .from('signals')
    .select('*')
    .eq('user_id', userId)
    .eq('is_dismissed', false)
    .eq('is_snoozed', false)
    .order('created_at', { ascending: false })

  return <SignalsReal signals={signals ?? []} />
}
