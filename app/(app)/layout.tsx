import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { AppShell } from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  // getClaims verifies the session JWT locally instead of round-tripping to the
  // auth server on every navigation (getUser did), which was most of the reload time
  const { data } = await supabase.auth.getClaims()
  if (!data) redirect('/login')
  const claims = data.claims
  const user = { id: claims.sub as string, email: claims.email as string | undefined, user_metadata: (claims.user_metadata ?? {}) as Record<string, unknown> }

  const isDemo = user.email === DEMO_EMAIL

  let badges = {}
  if (isDemo) {
    badges = { portfolio: 9, signals: 47, integrations: 4 }
  } else {
    const [accts, sigs, ints] = await Promise.all([
      supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('signals').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_dismissed', false).or('status.is.null,status.eq.open'),
      supabase.from('integrations').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
    ])
    badges = {
      portfolio: accts.count ?? 0,
      signals: sigs.count ?? 0,
      integrations: ints.count ?? 0,
    }
  }

  return (
    <AppShell
      user={{ email: user.email ?? '', id: user.id, name: (user.user_metadata?.name as string) }}
      isDemo={isDemo}
      badges={badges}
    >
      {children}
    </AppShell>
  )
}
