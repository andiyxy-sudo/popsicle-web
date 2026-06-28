import { createClient } from '@/lib/supabase/server'

export const DEMO_EMAIL = 'demo@popsicle-labs.app'

export async function getUserContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const isDemo = user.email === DEMO_EMAIL
  return { user, isDemo, supabase }
}
