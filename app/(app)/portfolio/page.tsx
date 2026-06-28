import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { PortfolioShowcase } from './PortfolioShowcase'
import { PortfolioReal } from './PortfolioReal'

export default async function PortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  if (user.email === DEMO_EMAIL) {
    return <PortfolioShowcase />
  }

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('health_score', { ascending: true })

  return <PortfolioReal accounts={accounts ?? []} />
}
