import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { DEMO_SIGNALS, DEMO_ACCOUNTS, DEMO_MESSAGES, DEMO_BASELINES, DEMO_INTELLIGENCE } from '@/lib/demo-dataset'
import { IntelligenceReal } from './IntelligenceReal'
import { orgIdsServer } from '@/lib/org'
import { fetchAllData } from '@/lib/fetchAll'

export default async function IntelligencePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data) return null
  const email = data.claims.email as string | undefined
  const userId = data.claims.sub as string

  if (email === DEMO_EMAIL) {
    return <IntelligenceReal signals={DEMO_SIGNALS as never} accounts={DEMO_ACCOUNTS as never} messages={DEMO_MESSAGES as never} baselines={DEMO_BASELINES as never} demo={DEMO_INTELLIGENCE} />
  }

  const since = new Date(Date.now() - 56 * 86400000).toISOString()
  const [signalsRes, msgsRes, baselinesRes, accountsRes] = await Promise.all([
    fetchAllData(async (a, b) => supabase.from('signals')
      .select('created_at, account_name, title, severity, signal_type, source_integration, risk_amount, is_dismissed, status, handled_action, handled_at, id, ai_analysis')
      .in('user_id', await orgIdsServer(supabase, userId))
      .gte('created_at', new Date(Date.now() - 190 * 864e5).toISOString())   // the 90-day window and the one before it
      .order('created_at', { ascending: false })
      .range(a, b)),
    supabase.from('messages')
      .select('received_at, direction, integration')
      .in('user_id', await orgIdsServer(supabase, userId))
      .gte('received_at', since)
      .order('received_at', { ascending: true })
      .limit(8000),
    supabase.from('account_baselines')
      .select('account_name, emails_per_week, total_messages, last_message_at, our_median_reply_hours, their_median_reply_hours, total_reply_pairs, confidence')
      .in('user_id', await orgIdsServer(supabase, userId))
      .order('total_messages', { ascending: false })
      .limit(20),
    supabase.from('accounts')
      .select('name, value, close_date, risk_level')
      .in('user_id', await orgIdsServer(supabase, userId)),
  ])

  return (
    <IntelligenceReal
      signals={signalsRes.data ?? []}
      messages={msgsRes.data ?? []}
      baselines={baselinesRes.data ?? []}
      accounts={accountsRes.data ?? []}
    />
  )
}
