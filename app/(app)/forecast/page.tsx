import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { DEMO_ACCOUNTS, DEMO_SIGNALS, DEMO_MOVERS, DEMO_FORECAST } from '@/lib/demo-dataset'
import { ForecastReal } from './ForecastReal'

export default async function ForecastPage() {
  const supabase = await createClient()
  // local JWT check instead of an auth-server round trip on every navigation
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData ? { id: claimsData.claims.sub as string, email: claimsData.claims.email as string | undefined } : null
  if (!user) return null

  if (user.email === DEMO_EMAIL) {
    return <ForecastReal accounts={DEMO_ACCOUNTS as never} signals={DEMO_SIGNALS as never} demoMovers={DEMO_MOVERS} demoFigures={DEMO_FORECAST} />
  }

  const [acc, sig] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', user.id),
    supabase.from('signals').select('*').eq('user_id', user.id).eq('is_dismissed', false).or('status.is.null,status.eq.open'),
  ])
  return <ForecastReal accounts={acc.data ?? []} signals={sig.data ?? []} />
}
