import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { DEMO_ACCOUNTS, DEMO_SIGNALS, DEMO_PEOPLE, DEMO_TEAM, DEMO_EXTRA } from '@/lib/demo-dataset'
import { PortfolioReal } from './PortfolioReal'
import { orgIdsServer } from '@/lib/org'

// One redesigned screen for both worlds: real users get live rows, the demo
// account gets the static dataset. (Replaces the legacy demo path whose
// per-account hydration hit get_account_360 with non-uuid ids -> 400s.)
export default async function PortfolioPage() {
  const supabase = await createClient()
  // local JWT check instead of an auth-server round trip on every navigation
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData ? { id: claimsData.claims.sub as string, email: claimsData.claims.email as string | undefined, user_metadata: (claimsData.claims.user_metadata ?? {}) as { name?: string } } : null
  if (!user) return null

  if (user.email === DEMO_EMAIL) {
    const acc = DEMO_ACCOUNTS as unknown as Parameters<typeof PortfolioReal>[0]['accounts']
    const meta: Record<string, { role?: string; rep?: string; trend?: string }> = {}
    for (const a of DEMO_ACCOUNTS) {
      const rep = DEMO_TEAM.reps.find(r => r.accounts.includes(a.name))?.name
      const role = (DEMO_PEOPLE[a.name] ?? []).find(p => p.name === a.owner)?.role
      meta[a.name] = { role, rep, trend: DEMO_EXTRA[a.name]?.trend }
    }
    return <PortfolioReal accounts={acc} demoSignals={DEMO_SIGNALS} meta={meta} />
  }

  const { data: accounts } = await supabase
    .from('accounts').select('*').in('user_id', await orgIdsServer(supabase, user.id))
    .order('health_score', { ascending: true })

  return <PortfolioReal accounts={accounts ?? []} />
}
