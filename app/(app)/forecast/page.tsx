import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { ForecastShowcase } from './ForecastShowcase'
import { ForecastReal } from './ForecastReal'

export default async function ForecastPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data) return null
  const claims = data.claims
  const email = claims.email as string | undefined
  const userId = claims.sub as string

  if (email === DEMO_EMAIL) {
    return <ForecastShowcase />
  }

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('probability', { ascending: false })

  return <ForecastReal accounts={accounts ?? []} />
}
