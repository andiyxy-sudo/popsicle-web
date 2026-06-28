import { createClient } from '@/lib/supabase/server'
import { IntegrationsClient } from './IntegrationsClient'

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: integrations } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', user.id)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px 56px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--t1)', letterSpacing: '-0.8px', marginBottom: 6 }}>
            Connect your tools
          </h1>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>
            Popsicle reads signals from your existing workflows. Connect to start monitoring.
          </p>
        </div>
        <IntegrationsClient integrations={integrations ?? []} userId={user.id} />
      </div>
    </div>
  )
}
