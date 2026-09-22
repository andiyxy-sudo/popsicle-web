import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { orgIdsServer } from '@/lib/org'
import * as M from '@/lib/metrics'
import * as I from '@/lib/intel'
import { myBook, scopeTo } from '@/lib/metricsData'
import { repsFromAccounts } from '@/lib/team'

// GET /api/explain?metric=at_risk|active|protected|commit|total_arr|account_arr|account_health|signal|rated_precision
//     [&account=Acme%20Corp][&signal=<id>]  → Explanation
// The same functions compute the figure on screen and its breakdown, so they always agree.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const metric = q.get('metric') || ''
  const account = q.get('account') || ''
  const signal = q.get('signal') || ''
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let accts: M.Acct[] = [], sigs: M.Sig[] = [], ratings: Array<{ type: string; useful: number; rated: number }> = [], breakdown: Array<{ k: string; v: number }> | undefined
  let now = Date.now()
  let reps: Array<{ name: string; accounts: string[] }> = []
  if ((claims.claims.email as string | undefined) === 'demo@popsicle-labs.app') {
    const d = await import('@/lib/demo-dataset')
    accts = d.DEMO_ACCOUNTS as unknown as M.Acct[]; sigs = d.DEMO_SIGNALS as unknown as M.Sig[]; ratings = d.DEMO_RATINGS; now = d.DEMO_NOW
    reps = d.DEMO_TEAM.reps.map(r => ({ name: r.name, accounts: r.accounts }))
    breakdown = account ? (d.DEMO_EXTRA as Record<string, { breakdown?: Array<{ k: string; v: number }> }>)[account]?.breakdown : undefined
  } else {
    const ids = await orgIdsServer(supabase, claims.claims.sub as string)
    const [{ data: a }, { data: s }] = await Promise.all([
      supabase.from('accounts').select('name, value, stage, risk_level, health_score, owner, close_date, user_id').in('user_id', ids).limit(500),
      supabase.from('signals').select('id, account_name, signal_type, severity, title, description, risk_amount, created_at, status, is_dismissed, source_integration, handled_at, handled_action, ai_analysis').in('user_id', ids).order('created_at', { ascending: false }).limit(800),
    ])
    accts = (a ?? []) as M.Acct[]; sigs = (s ?? []) as M.Sig[]
    try { const { data: r } = await supabase.rpc('signal_accuracy'); const row = Array.isArray(r) ? r[0] as { rated?: number; useful?: number } : null
      if (row && Number(row.rated) > 0) ratings = [{ type: 'All signal types', useful: Number(row.useful), rated: Number(row.rated) }] } catch { /* optional */ }
  }

  if (q.get('scope') === 'me') {
    const demoUser = (claims.claims.email as string | undefined) === 'demo@popsicle-labs.app'
    const names = await myBook(demoUser, claims.claims.sub as string, accts)
    const sc = scopeTo(names, accts, sigs); accts = sc.accts; sigs = sc.sigs
  }
  const x: M.Explanation | null =
    metric === 'at_risk' ? M.atRisk(accts, sigs)
    : metric === 'active' ? M.activeSignals(accts, sigs, now)
    : metric === 'protected' ? M.protectedRevenue(accts, sigs)
    : metric === 'commit' ? M.commit(accts, sigs)
    : metric === 'total_arr' ? M.totalArr(accts)
    : metric === 'account_arr' && account ? M.accountArr(account, accts, sigs)
    : metric === 'account_health' && account ? M.accountHealth(account, accts, sigs, breakdown)
    : metric === 'signal' && signal ? M.signalAmount(signal, accts, sigs)
    : metric === 'rated_precision' ? M.ratedPrecision(ratings)
    : metric === 'accounts_high' ? M.accountGroup('high', accts, sigs)
    : metric === 'accounts_medium' ? M.accountGroup('medium', accts, sigs)
    : metric === 'accounts_closing' ? M.accountGroup('closing', accts, sigs)
    : metric === 'avg_health' ? M.avgHealth(accts)
    : metric === 'caught' ? (q.get('days') ? I.windowed(accts, sigs, now, Number(q.get('days'))).caught : M.caughtEarly(accts, sigs))
    : metric === 'risk_change' ? I.riskChange(accts, sigs, now, Number(q.get('days')) || 30)
    : metric === 'holding' ? I.holding(accts, sigs, now, Number(q.get('days')) || 30)
    : metric === 'speed' ? I.speed(accts, sigs, now, Number(q.get('days')) || 30)
    : metric === 'saves' ? I.windowed(accts, sigs, now, Number(q.get('days')) || 30).saves
    : metric === 'cases' ? M.activeCases(accts, sigs)
    : metric === 'actions_ready' ? M.actionsReady(accts, sigs)
    : metric === 'new_today' ? M.newToday(accts, sigs, now)
    : metric === 'team_exposure' ? M.teamExposure(reps.length ? reps : await repsFromAccounts(accts as Array<{ name: string; user_id?: string | null }>), accts, sigs)
    : metric === 'rep_exposure' && q.get('rep') ? await (async () => { const all = reps.length ? reps : await repsFromAccounts(accts as Array<{ name: string; user_id?: string | null }>); const r = all.find(x => x.name === q.get('rep')); return M.repExposure(q.get('rep')!, r?.accounts ?? [], accts, sigs) })()
    : null
  if (!x) return NextResponse.json({ error: 'unknown metric' }, { status: 400 })
  return NextResponse.json(x)
}
