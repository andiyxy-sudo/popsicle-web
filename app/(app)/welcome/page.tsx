import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { redirect } from 'next/navigation'
import { WelcomeFlow } from './WelcomeFlow'

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data) return null
  const email = data.claims.email as string | undefined
  if (email === DEMO_EMAIL) redirect('/pulse')
  const userName = (data.claims.user_metadata?.name as string) || (email ? email.split('@')[0] : 'there')
  return <WelcomeFlow name={userName} />
}
