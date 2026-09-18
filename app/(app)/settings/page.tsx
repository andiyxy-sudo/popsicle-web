import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './SettingsClient'

// No wrapper: the app shell already provides the scrolling column and padding.
// The old nested scroll container here was overriding the redesigned layout.
export default async function SettingsPage() {
  const supabase = await createClient()
  // local JWT check instead of an auth-server round trip on every navigation
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData ? { id: claimsData.claims.sub as string, email: claimsData.claims.email as string | undefined, user_metadata: (claimsData.claims.user_metadata ?? {}) as { name?: string } } : null
  if (!user) return null

  return <SettingsClient user={{ email: user.email ?? '', id: user.id }} />
}
