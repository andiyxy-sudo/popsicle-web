import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px 56px' }}>
        <SettingsClient user={{ email: user.email ?? '', id: user.id }} />
      </div>
    </div>
  )
}
