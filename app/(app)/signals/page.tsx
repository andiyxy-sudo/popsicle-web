import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { DEMO_SIGNALS, DEMO_PULSE_WEEK, DEMO_SIGNALS_HEAD } from '@/lib/demo-dataset'
import { SignalsReal } from './SignalsReal'
import { orgIdsServer } from '@/lib/org'

export default async function SignalsPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data) return null
  const claims = data.claims
  const email = claims.email as string | undefined
  const userId = claims.sub as string

  if (email === DEMO_EMAIL) {
    return <SignalsReal signals={DEMO_SIGNALS as never} demoHead={{ week: DEMO_PULSE_WEEK, head: DEMO_SIGNALS_HEAD }} />
  }

  const { data: signals } = await supabase
    .from('signals')
    .select('*')
    .in('user_id', await orgIdsServer(supabase, userId))
    .eq('is_dismissed', false)
        .or('status.is.null,status.eq.open,status.eq.handled')
    .order('surfaced_at', { ascending: false }).limit(200)

  return <SignalsReal signals={signals ?? []} />
}
