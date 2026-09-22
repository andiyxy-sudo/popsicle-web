import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { DEMO_ACCOUNTS, DEMO_SIGNALS, DEMO_TEAM } from '@/lib/demo-dataset'
import { TeamReal } from './TeamReal'
import { orgIdsServer } from '@/lib/org'
import { teammateNames } from '@/lib/team'

export default async function TeamPage() {
  const supabase = await createClient()
  // local JWT check instead of an auth-server round trip on every navigation
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData ? { id: claimsData.claims.sub as string, email: claimsData.claims.email as string | undefined, user_metadata: (claimsData.claims.user_metadata ?? {}) as { name?: string } } : null
  if (!user) return null

  if (user.email === DEMO_EMAIL) {
    return <TeamReal accounts={DEMO_ACCOUNTS as never} signals={DEMO_SIGNALS as never} me="Andy G" demo={DEMO_TEAM} integrations={['gmail', 'whatsapp', 'slack', 'zoom']} />
  }

  const [acc, sig, integ] = await Promise.all([
    supabase.from('accounts').select('*').in('user_id', await orgIdsServer(supabase, user.id)),
    supabase.from('signals').select('*').in('user_id', await orgIdsServer(supabase, user.id)).eq('is_dismissed', false),
    supabase.from('integrations').select('provider').in('user_id', await orgIdsServer(supabase, user.id)).eq('is_active', true),
  ])
  // reps are the Popsicle users who own the accounts (accounts.user_id), with their names
  const repNames = await teammateNames([...new Set((acc.data ?? []).map(a => (a as { user_id?: string }).user_id).filter(Boolean) as string[])])
  return (
    <TeamReal
      repNames={repNames}
      accounts={acc.data ?? []}
      signals={sig.data ?? []}
      me={(user.user_metadata?.name as string) || user.email!.split('@')[0]}
      integrations={(integ.data ?? []).map(i => i.provider as string)}
    />
  )
}
