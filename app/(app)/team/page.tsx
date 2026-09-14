import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { DEMO_ACCOUNTS, DEMO_SIGNALS } from '@/lib/demo-dataset'
import { TeamReal } from './TeamReal'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  if (user.email === DEMO_EMAIL) {
    return <TeamReal accounts={DEMO_ACCOUNTS as never} signals={DEMO_SIGNALS as never} me="Andy G" integrations={['gmail', 'gcal', 'slack', 'zoom', 'hubspot', 'fireflies', 'meet']} />
  }

  const [acc, sig, integ] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', user.id),
    supabase.from('signals').select('*').eq('user_id', user.id).eq('is_dismissed', false),
    supabase.from('integrations').select('provider').eq('user_id', user.id).eq('is_active', true),
  ])
  return (
    <TeamReal
      accounts={acc.data ?? []}
      signals={sig.data ?? []}
      me={(user.user_metadata?.name as string) || user.email!.split('@')[0]}
      integrations={(integ.data ?? []).map(i => i.provider as string)}
    />
  )
}
