import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountPage } from './AccountPage'

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <AccountPage accountName={decodeURIComponent(name)} />
}
