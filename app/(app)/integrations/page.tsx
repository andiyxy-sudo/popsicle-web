import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { IntegrationsShowcase } from './IntegrationsShowcase'
import { IntegrationsReal } from './IntegrationsReal'

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data) return null
  const claims = data.claims
  const email = claims.email as string | undefined
  const userId = claims.sub as string

  if (email === DEMO_EMAIL) {
    return <IntegrationsShowcase />
  }

  const { data: integrations } = await supabase
    .from('integrations')
    .select('provider, is_active')
    .eq('user_id', userId)

  return <IntegrationsReal active={(integrations ?? []).filter(i => i.is_active).map(i => i.provider)} />
}
