import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { AccountsClient } from './AccountsClient'

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function AccountsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  let query = supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('last_contact_date', { ascending: false })

  if (params.q) {
    query = query.ilike('name', `%${params.q}%`)
  }

  const { data: accounts } = await query

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar
        eyebrow="Revenue Intelligence"
        title="Accounts"
        actions={
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontFamily: "'DM Mono', monospace",
            color: 'var(--t4)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--ok)',
            }} />
            {(accounts ?? []).length} accounts
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px 56px' }}>
        <AccountsClient initialAccounts={accounts ?? []} searchQuery={params.q ?? ''} />
      </div>
    </div>
  )
}
