import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { orgIdsServer } from '@/lib/org'
import { suggest } from '@/lib/ask/suggest'

// GET /api/ask/suggest?screen=forecast[&account=Acme%20Corp] → { questions: string[] }
export async function GET(req: NextRequest) {
  const screen = req.nextUrl.searchParams.get('screen') || 'pulse'
  const account = req.nextUrl.searchParams.get('account') || undefined
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ questions: [] }, { status: 401 })
  const email = (claims.claims.email as string | undefined) ?? ''

  if (email === 'demo@popsicle-labs.app') {
    const d = await import('@/lib/demo-dataset')
    return NextResponse.json({ questions: suggest({
      screen, account, accounts: d.DEMO_ACCOUNTS as never, signals: d.DEMO_SIGNALS as never,
      forecast: { commit: d.DEMO_FORECAST.commit }, movers: d.DEMO_MOVERS,
      reps: d.DEMO_TEAM.reps.map(r => ({ name: r.name, exposure: r.exposure, avgResp: r.avgResp })),
      riskDeltaPct: d.DEMO_INTELLIGENCE.riskDeltaPct,
    }) })
  }

  const ids = await orgIdsServer(supabase, claims.claims.sub as string)
  const [{ data: accounts }, { data: signals }] = await Promise.all([
    supabase.from('accounts').select('name, value, risk_level, health_score, owner, last_contact_date, stage').in('user_id', ids).limit(300),
    supabase.from('signals').select('account_name, title, severity, signal_type, created_at, status, is_dismissed, risk_amount').in('user_id', ids).order('created_at', { ascending: false }).limit(200),
  ])
  return NextResponse.json({ questions: suggest({ screen, account, accounts: (accounts ?? []) as never, signals: (signals ?? []) as never }) })
}
