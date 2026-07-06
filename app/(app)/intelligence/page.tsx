import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { IntelligenceShowcase } from './IntelligenceShowcase'
import { IntelligenceReal } from './IntelligenceReal'

export default async function IntelligencePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data) return null
  const email = data.claims.email as string | undefined
  const userId = data.claims.sub as string

  if (email === DEMO_EMAIL) {
    return <IntelligenceShowcase />
  }

  const since = new Date(Date.now() - 56 * 86400000).toISOString()
  const [signalsRes, msgsRes, baselinesRes] = await Promise.all([
    supabase.from('signals')
      .select('created_at, severity, signal_type, source_integration, risk_amount, is_dismissed, is_snoozed')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('messages')
      .select('received_at, direction, integration')
      .eq('user_id', userId)
      .gte('received_at', since)
      .order('received_at', { ascending: true })
      .limit(8000),
    supabase.from('account_baselines')
      .select('account_name, emails_per_week, total_messages, last_message_at, our_median_reply_hours, their_median_reply_hours, total_reply_pairs, confidence')
      .eq('user_id', userId)
      .order('total_messages', { ascending: false })
      .limit(20),
  ])

  return (
    <IntelligenceReal
      signals={signalsRes.data ?? []}
      messages={msgsRes.data ?? []}
      baselines={baselinesRes.data ?? []}
    />
  )
}
