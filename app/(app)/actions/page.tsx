import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { orgIdsServer } from '@/lib/org'
import { ActionsReal } from './ActionsReal'
import { DEMO_EMAIL } from '@/lib/data'
import { DEMO_SIGNALS } from '@/lib/demo-dataset'
import { DEMO_DRAFTS, DEMO_AUTO } from '@/lib/demo-actions'

export const dynamic = 'force-dynamic'

export default async function ActionsPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims) redirect('/login')
  const userId = claims.sub as string

  // the demo shows a working product: drafted buyer-facing actions waiting for approval, and the internal
  // ones Popsicle already took, all tied to Concerns in the demo dataset
  if (claims.email === DEMO_EMAIL) {
    const handled = (DEMO_SIGNALS as unknown as Array<Record<string, unknown>>).filter(x => x.status === 'handled')
    return <ActionsReal open={[]} handled={handled as never} sends={[]} drafts={DEMO_DRAFTS} autoDone={DEMO_AUTO} />
  }
  const ids = await orgIdsServer(supabase, userId)

  // Everything a person could do next, and everything already done. Concerns come from concern_feed,
  // so a locked one arrives with its detail already stripped and nothing here can leak it.
  const [{ data: open }, { data: handled }, { data: sends }] = await Promise.all([
    supabase.from('concern_feed').select('*').in('user_id', ids)
      .eq('is_dismissed', false).or('status.is.null,status.eq.open')
      .order('due_at', { ascending: true, nullsFirst: false }).limit(60),
    supabase.from('concern_feed').select('*').in('user_id', ids)
      .eq('status', 'handled').order('handled_at', { ascending: false }).limit(20),
    supabase.from('sends').select('id, account_name, subject, to_email, mode, approved_by, created_at, signal_id')
      .in('user_id', ids).order('created_at', { ascending: false }).limit(20),
  ])

  return <ActionsReal open={open ?? []} handled={handled ?? []} sends={sends ?? []} />
}
