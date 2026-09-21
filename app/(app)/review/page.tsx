import { createClient } from '@/lib/supabase/server'
import { loadMetricsData } from '@/lib/metricsData'
import * as M from '@/lib/metrics'
import { changesBetween } from '@/lib/replay'
import { ReviewClient, type ReviewDeal } from './ReviewClient'

// Review mode: the weekly pipeline review, run inside Popsicle. The agenda is built from the
// same definitions as everywhere else: every critical deal (largest first), then the rest of
// the commit. Each deal carries what changed this week, its evidence, and past decisions.
export default async function ReviewPage() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return null
  const { accts, sigs, now, demo } = await loadMetricsData(supabase, claims.claims as Record<string, unknown>)
  const critical = M.atRisk(accts, sigs).parts.map(p => p.label)
  const commit = M.commit(accts, sigs).parts.map(p => p.label).filter(n => !critical.includes(n))
  const week = changesBetween(accts, sigs, now - 7 * 864e5, now)
  let past: Array<Record<string, unknown>> = []
  if (demo) past = (await import('@/lib/demo-dataset')).DEMO_DECISIONS as unknown as Array<Record<string, unknown>>
  else { const { data } = await supabase.from('decisions').select('*').order('created_at', { ascending: false }).limit(200); past = (data ?? []) as Array<Record<string, unknown>> }
  const team = demo ? (await import('@/lib/demo-dataset')).DEMO_TEAM.reps.map(r => r.name) : []

  const deals: ReviewDeal[] = [...critical.map(n => ({ n, why: 'critical' as const })), ...commit.map(n => ({ n, why: 'commit' as const }))].map(({ n, why }) => {
    const a = accts.find(x => x.name === n)!
    const open = sigs.filter(s => s.account_name === n && !s.is_dismissed && (!s.status || s.status === 'open'))
    const top = [...open].sort((x, y) => (x.severity === 'high' ? 0 : x.severity === 'watch' ? 1 : 2) - (y.severity === 'high' ? 0 : y.severity === 'watch' ? 1 : 2) || String(y.created_at).localeCompare(String(x.created_at))).slice(0, 4)
    return {
      account: n, why, value: Number(a.value || 0), stage: a.stage ?? null, health: a.health_score ?? null, contact: a.owner ?? null, close: a.close_date ?? null,
      atRisk: M.exposureOf(open.filter(s => s.severity !== 'positive')),
      evidence: top.map(s => ({ id: s.id, title: s.title ?? 'Signal', quote: (s.ai_analysis?.quote as string | undefined) ?? null, source: s.source_integration ?? null, at: s.created_at ?? null, severity: s.severity ?? 'watch' })),
      week: week.events.filter(e => e.account === n).slice(0, 6),
      past: past.filter(d => d.account_name === n).slice(0, 3) as ReviewDeal['past'],
    }
  })
  return <ReviewClient deals={deals} team={team} demo={demo} now={now} />
}
