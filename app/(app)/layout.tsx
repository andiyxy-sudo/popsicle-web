import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get unread signal count
  const { count } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_dismissed', false)
    .eq('is_snoozed', false)
    .eq('severity', 'high')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        user={{ email: user.email ?? '', id: user.id }}
        signalCount={count ?? 0}
      />
      <main style={{
        marginLeft: 'var(--sidebar-w)',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {children}
      </main>
    </div>
  )
}
