import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadMetricsData, myBook, scopeTo } from '@/lib/metricsData'
import * as M from '@/lib/metrics'
import { resolveLens, LENS_LABEL, type LensId } from '@/lib/lens'

// GET /api/lens?lens=rep|manager|cfo → the four headline figures for that lens.
// (CRO is Pulse's standard strip.) Every figure carries the metric that explains it.
export type Tile = { label: string; valueText: string; sub: string; m: string; scope?: 'me'; tone: 'critical' | 'good' | 'accent' | 'ink' }

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // the view follows the person: their job title from their profile, else their org role
  const meta = (claims.claims.user_metadata ?? {}) as { role?: string }
  const isDemo = (claims.claims.email as string | undefined) === 'demo@popsicle-labs.app'
  let orgRole: string | null = null
  if (!meta.role && !isDemo) { const { data: m } = await supabase.from('org_members').select('role').eq('user_id', claims.claims.sub as string).maybeSingle(); orgRole = (m as { role?: string } | null)?.role ?? null }
  const lens: LensId = resolveLens(meta.role ?? (isDemo ? 'VP of Sales' : null), orgRole)
  if (lens === 'cro') return NextResponse.json({ lens, label: LENS_LABEL[lens], title: meta.role ?? null, tiles: [] })
  const { accts, sigs, now, demo } = await loadMetricsData(supabase, claims.claims as Record<string, unknown>)
  let tiles: Tile[] = []
  if (lens === 'rep') {
    const names = await myBook(demo, claims.claims.sub as string, accts)
    const { accts: a, sigs: s } = scopeTo(names, accts, sigs)
    const risk = M.atRisk(a, s), act = M.activeSignals(a, s, now), ready = M.actionsReady(a, s), book = M.totalArr(a)
    tiles = [
      { label: 'My revenue at risk', valueText: risk.valueText, sub: `${risk.parts.length} of my accounts critical`, m: 'at_risk', scope: 'me', tone: risk.value > 0 ? 'critical' : 'ink' },
      { label: 'My open signals', valueText: act.valueText, sub: 'across my accounts', m: 'active', scope: 'me', tone: 'ink' },
      { label: 'Ready for me', valueText: ready.valueText, sub: 'next step already drafted', m: 'actions_ready', scope: 'me', tone: 'accent' },
      { label: 'My book', valueText: book.valueText, sub: `${names.length} accounts`, m: 'total_arr', scope: 'me', tone: 'ink' },
    ]
  } else if (lens === 'cfo') {
    const risk = M.atRisk(accts, sigs), prot = M.protectedRevenue(accts, sigs), c = M.commit(accts, sigs), arr = M.totalArr(accts)
    tiles = [
      { label: 'Revenue at risk', valueText: risk.valueText, sub: `${risk.parts.length} accounts, each with its evidence`, m: 'at_risk', tone: risk.value > 0 ? 'critical' : 'ink' },
      { label: 'Revenue protected', valueText: prot.valueText, sub: prot.footnote ?? 'this quarter', m: 'protected', tone: 'good' },
      { label: 'Commit', valueText: c.valueText, sub: `${c.parts.length} deals`, m: 'commit', tone: 'ink' },
      { label: 'Total ARR', valueText: arr.valueText, sub: `${arr.parts.length} accounts`, m: 'total_arr', tone: 'ink' },
    ]
  } else {
    const reps = demo ? (await import('@/lib/demo-dataset')).DEMO_TEAM.reps.map(r => ({ name: r.name, accounts: r.accounts }))
      : [...new Set(accts.map(a => a.owner || 'Unassigned'))].map(n => ({ name: n, accounts: accts.filter(a => (a.owner || 'Unassigned') === n).map(a => a.name) }))
    const exp = M.teamExposure(reps, accts, sigs), cases = M.activeCases(accts, sigs), ready = M.actionsReady(accts, sigs), caught = M.caughtEarly(accts, sigs)
    tiles = [
      { label: 'Team exposure', valueText: exp.valueText, sub: `${exp.parts.filter(p => (p.value ?? 0) > 0).length} reps carrying risk`, m: 'team_exposure', tone: exp.value > 0 ? 'critical' : 'ink' },
      { label: 'Active cases', valueText: cases.valueText, sub: 'accounts with an open risk signal', m: 'cases', tone: 'ink' },
      { label: 'Waiting on the team', valueText: ready.valueText, sub: 'critical, next step drafted', m: 'actions_ready', tone: 'accent' },
      { label: 'Caught early', valueText: caught.valueText, sub: 'risk signals this quarter', m: 'caught', tone: 'good' },
    ]
  }
  return NextResponse.json({ lens, label: LENS_LABEL[lens], title: meta.role ?? null, tiles })
}
