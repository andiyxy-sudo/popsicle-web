import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { PortfolioShowcase } from './PortfolioShowcase'
import { PortfolioReal } from './PortfolioReal'

export default async function PortfolioPage() {
  const supabase = await createClient()
  // Fast local JWT read (no network round-trip). Layout already did the authoritative getUser() + redirect.
  const { data } = await supabase.auth.getClaims()
  if (!data) return null
  const claims = data.claims
  const email = claims.email as string | undefined
  const userId = claims.sub as string

  if (email === DEMO_EMAIL) {
    return <PortfolioShowcase />
  }

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('health_score', { ascending: true })

  return <PortfolioReal accounts={accounts ?? []} />
}
