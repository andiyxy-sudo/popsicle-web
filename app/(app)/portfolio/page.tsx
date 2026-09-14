import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { DEMO_ACCOUNTS, DEMO_SIGNALS } from '@/lib/demo-dataset'
import { PortfolioReal } from './PortfolioReal'

// One redesigned screen for both worlds: real users get live rows, the demo
// account gets the static dataset. (Replaces the legacy demo path whose
// per-account hydration hit get_account_360 with non-uuid ids -> 400s.)
export default async function PortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  if (user.email === DEMO_EMAIL) {
    const acc = DEMO_ACCOUNTS as unknown as Parameters<typeof PortfolioReal>[0]['accounts']
    return <PortfolioReal accounts={acc} demoSignals={DEMO_SIGNALS} />
  }

  const { data: accounts } = await supabase
    .from('accounts').select('*').eq('user_id', user.id)
    .order('health_score', { ascending: true })

  return <PortfolioReal accounts={accounts ?? []} />
}
