import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { DEMO_SIGNALS, DEMO_PULSE_WEEK, DEMO_SIGNALS_HEAD } from '@/lib/demo-dataset'
import { ConcernsReal } from './ConcernsReal'
import { orgIdsServer } from '@/lib/org'
import { fetchAllData } from '@/lib/fetchAll'
import { readSettings, passesEngine } from '@/lib/settings'

export default async function SignalsPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data) return null
  const claims = data.claims
  const email = claims.email as string | undefined
  const userId = claims.sub as string

  if (email === DEMO_EMAIL) {
    return <ConcernsReal signals={DEMO_SIGNALS as never} demoHead={{ week: DEMO_PULSE_WEEK, head: DEMO_SIGNALS_HEAD }} />
  }

  // every open signal (the counts and figures need all of them), plus the most recently handled ones for the
  // "Recently handled" strip; the list itself shows them in batches so it stays fast
  const ids = await orgIdsServer(supabase, userId)
  const [{ data: open }, { data: handled }] = await Promise.all([
    fetchAllData(async (a, b) => supabase.from('concern_feed').select('*').in('user_id', ids).eq('is_dismissed', false).or('status.is.null,status.eq.open').order('surfaced_at', { ascending: false }).range(a, b)),
    supabase.from('concern_feed').select('*').in('user_id', ids).eq('is_dismissed', false).eq('status', 'handled').order('handled_at', { ascending: false }).limit(100),
  ])

  // the Concern Engine settings decide what reaches the screen: types switched off never appear,
  // and low-confidence Concerns are held back unless the sensitivity asks for them
  const settings = readSettings(claims.user_metadata as Record<string, unknown> | null)
  const kept = (open ?? []).filter(sg => passesEngine(settings, sg as never))
  const held = (open ?? []).length - kept.length
  return <ConcernsReal signals={[...kept, ...(handled ?? [])]} heldByEngine={held} />
}
