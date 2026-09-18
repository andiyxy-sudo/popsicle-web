import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { DEMO_ACCOUNTS, DEMO_SIGNALS, DEMO_MOVERS } from '@/lib/demo-dataset'
import { ForecastReal } from './ForecastReal'

export default async function ForecastPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  if (user.email === DEMO_EMAIL) {
    return <ForecastReal accounts={DEMO_ACCOUNTS as never} signals={DEMO_SIGNALS as never} demoMovers={DEMO_MOVERS} />
  }

  const [acc, sig] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', user.id),
    supabase.from('signals').select('*').eq('user_id', user.id).eq('is_dismissed', false).or('status.is.null,status.eq.open'),
  ])
  return <ForecastReal accounts={acc.data ?? []} signals={sig.data ?? []} />
}
