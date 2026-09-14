import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './SettingsClient'

// No wrapper: the app shell already provides the scrolling column and padding.
// The old nested scroll container here was overriding the redesigned layout.
export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  return <SettingsClient user={{ email: user.email ?? '', id: user.id }} />
}
