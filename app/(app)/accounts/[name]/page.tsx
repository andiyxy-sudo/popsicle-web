import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountPage } from './AccountPage'
import { DEMO_EMAIL } from '@/lib/data'
import { DEMO_ACCOUNTS, DEMO_SIGNALS, DEMO_MESSAGES, DEMO_PEOPLE, DEMO_CONTRACTS, DEMO_EXTRA, DEMO_COMMS, DEMO_TIMELINE, DEMO_RISK_LINES } from '@/lib/demo-dataset'

// Data is fetched here, on the server, so the page arrives populated instead
// of blank-then-fetching in the browser.
export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const accountName = decodeURIComponent(name)
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData ? { id: claimsData.claims.sub as string, email: claimsData.claims.email as string | undefined } : null
  if (!user) redirect('/login')

  if (user.email === DEMO_EMAIL) {
    const demo = DEMO_ACCOUNTS.find(a => a.name === accountName)
    return (
      <AccountPage
        accountName={accountName}
        account={(demo ?? null) as never}
        signals={DEMO_SIGNALS.filter(s => s.account_name === accountName) as never}
        messages={DEMO_MESSAGES.filter(m => m.account_name === accountName).slice(0, 40) as never}
        demo={{ people: DEMO_PEOPLE[accountName], contracts: DEMO_CONTRACTS[accountName], extra: DEMO_EXTRA[accountName], comms: DEMO_COMMS[accountName], timeline: DEMO_TIMELINE[accountName], riskLines: DEMO_RISK_LINES[accountName] }}
      />
    )
  }

  const { data: acct } = await supabase.from('accounts').select('*')
    .eq('user_id', user.id).eq('name', accountName).maybeSingle()
  if (!acct) return <AccountPage accountName={accountName} account={null} signals={[]} messages={[]} />

  const { data: payload } = await supabase.rpc('get_account_360', { p_account_id: acct.id })
  const p = (payload ?? {}) as { messages?: unknown[]; signals?: unknown[] }
  return (
    <AccountPage
      accountName={accountName}
      account={acct as never}
      signals={(p.signals ?? []) as never}
      messages={(p.messages ?? []) as never}
    />
  )
}
