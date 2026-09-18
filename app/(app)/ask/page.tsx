import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AskClient } from './AskClient'

// Standalone Ask surface (deep-linkable): /ask and /ask?q=<question>.
// Uses the same /api/ask co-pilot (with message self-extraction) as the drawer.
export default async function AskPage() {
  const supabase = await createClient()
  // local JWT check instead of an auth-server round trip on every navigation
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData ? { id: claimsData.claims.sub as string, email: claimsData.claims.email as string | undefined, user_metadata: (claimsData.claims.user_metadata ?? {}) as { name?: string } } : null
  if (!user) redirect('/login')
  return <AskClient />
}
