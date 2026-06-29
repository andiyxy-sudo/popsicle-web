import { createClient } from '@/lib/supabase/server'
import { SettingsShowcase } from './SettingsShowcase'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data) return null
  const email = (data.claims.email as string | undefined) ?? ''

  return <SettingsShowcase email={email} />
}
