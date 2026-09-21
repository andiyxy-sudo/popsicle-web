import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { orgIdsServer } from '@/lib/org'
import { composeAgent } from '@/lib/agent/compose'

// GET → today's brief for the signed-in user, composed from existing signals, accounts
// and commitments. Demo account composes from the demo dataset.
export async function GET() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = claims.claims.sub as string
  const email = (claims.claims.email as string | undefined) ?? ''
  const meta = (claims.claims.user_metadata ?? {}) as { name?: string }
  const firstName = (meta.name || email.split('@')[0] || 'there').split(/\s+/)[0]

  if (email === 'demo@popsicle-labs.app') {
    const d = await import('@/lib/demo-dataset')
    return NextResponse.json(composeAgent({
      firstName: 'Andy',
      accounts: d.DEMO_ACCOUNTS as never, signals: d.DEMO_SIGNALS as never,
      commitments: d.DEMO_LATE_COMMITMENTS.map(c => ({ id: c.id, text: c.text, account: c.account, daysLate: c.daysLate })),
    }))
  }

  const ids = await orgIdsServer(supabase, me)
  const end = new Date(); end.setHours(23, 59, 59, 999)
  const [{ data: accounts }, { data: signals }, { data: cms }] = await Promise.all([
    supabase.from('accounts').select('id, name, value, risk_level, health_score, last_contact_date, close_date, owner').in('user_id', ids).limit(300),
    supabase.from('signals').select('id, account_name, signal_type, severity, title, description, risk_amount, created_at, status, is_dismissed, ai_analysis').in('user_id', ids).order('created_at', { ascending: false }).limit(300),
    supabase.from('commitments').select('id, text, due_at, account_name').in('user_id', ids).eq('status', 'open').lte('due_at', end.toISOString()).limit(20),
  ])
  const commitments = ((cms ?? []) as Array<{ id: string; text: string; due_at: string | null; account_name: string | null }>).map(c => ({
    id: c.id, text: c.text, account: c.account_name,
    daysLate: c.due_at ? Math.max(0, Math.floor((Date.now() - new Date(c.due_at).getTime()) / 86_400_000)) : 0,
  }))
  return NextResponse.json(composeAgent({ firstName, accounts: (accounts ?? []) as never, signals: (signals ?? []) as never, commitments }))
}
