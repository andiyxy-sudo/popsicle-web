import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadMetricsData } from '@/lib/metricsData'
import * as M from '@/lib/metrics'
import { readSettings } from '@/lib/settings'

// GET /api/ask/opening → what the Ask page shows before you type: a one-line briefing, the questions worth
// asking (each with the evidence that produced it and what it is worth), what Popsicle has just read, and
// the day's figures. Everything is derived from this workspace's own signals, demo or live.
const SRC: Record<string, string> = { gmail: 'Gmail', outlook: 'Outlook', slack: 'Slack', zoom: 'Zoom', whatsapp: 'WhatsApp', hubspot: 'HubSpot', gcal: 'Calendar', fireflies: 'Fireflies' }
const isOpen = (s: M.Sig) => !s.is_dismissed && (!s.status || s.status === 'open')
const ago = (iso: string | null | undefined, now: number) => {
  if (!iso) return ''
  const m = Math.round((now - new Date(iso).getTime()) / 60000)
  return m < 60 ? `${Math.max(1, m)}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`
}

export async function GET() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { accts, sigs, now } = await loadMetricsData(supabase, claims.claims as Record<string, unknown>)
  const my = readSettings((claims.claims.user_metadata ?? {}) as Record<string, unknown>)
  const open = sigs.filter(isOpen)
  const since = now - 864e5
  const readCount = sigs.filter(s => s.created_at && new Date(s.created_at).getTime() > since).length

  // the questions: one per account that needs a decision, biggest money first
  const byAccount = accts.map(a => {
    const mine = open.filter(s => s.account_name === a.name)
    const crit = mine.filter(s => s.severity === 'high')
    const good = mine.filter(s => s.severity === 'positive')
    const exposure = M.exposureOf(mine.filter(s => s.severity !== 'positive'))
    const newest = [...mine].sort((x, y) => String(y.created_at ?? '').localeCompare(String(x.created_at ?? '')))
    const why = newest.slice(0, 2).map(s => s.title).filter(Boolean).join(' · ')
    // the question follows what the signals actually say
    const text = mine.map(s => `${s.title ?? ''} ${s.ai_analysis?.quote ?? ''}`).join(' ').toLowerCase()
    const kind = /rival|competitor|alternativ|gong|vendor/.test(text) ? 'competitor'
      : /pricing|price|discount|concession|budget/.test(text) ? 'pricing'
      : /timeline|pushed|postponed|delay|moved to q|next quarter|fiscal/.test(text) ? 'timeline'
      : /silent|quiet|dark|no reply|unanswered|gone/.test(text) ? 'silence' : 'close'
    if (crit.length > 0) {
      const Q: Record<string, string> = {
        competitor: `How do we answer the competitor at ${a.name}?`,
        pricing: `Do we hold the price on ${a.name}?`,
        timeline: `Has ${a.name} really slipped to next quarter?`,
        silence: `Should we escalate ${a.name} now?`,
        close: `Is ${a.name} going to close this quarter?`,
      }
      return { account: a.name, amount: exposure, tone: 'risk' as const, why, kind, question: Q[kind] }
    }
    if (good.length >= 2 && (a.health_score ?? 0) >= 70) {
      return { account: a.name, amount: Number(a.value || 0), tone: 'good' as const, why, kind: 'good', question: `Can we pull ${a.name} forward?` }
    }
    return null
  }).filter(Boolean) as Array<{ account: string; question: string; why: string; amount: number; tone: 'risk' | 'good'; kind?: string }>
  byAccount.sort((a, b) => (a.tone === b.tone ? b.amount - a.amount : a.tone === 'risk' ? -1 : 1))
  const usedKind = new Set<string>()
  for (const b of byAccount) {
    if (b.tone !== 'risk') continue
    if (usedKind.has(b.kind ?? '')) b.question = `Is ${b.account} going to close this quarter?`   // vary the second of a kind
    usedKind.add(b.kind ?? '')
  }

  const commit = M.commit(accts, sigs)
  const atRisk = M.atRisk(accts, sigs)
  const bigger = [
    { question: `Is the ${commit.valueText} commit real?`, why: 'Everything in Negotiation, Closing, and healthy Proposals' },
    { question: 'Which deals are quietly slipping?', why: `Accounts still healthy, but quiet beyond ${my.thresholds.daysDark} days` },
  ]
  const needCount = byAccount.filter(b => b.tone === 'risk').length
  const needValue = byAccount.filter(b => b.tone === 'risk').reduce((t, b) => t + b.amount, 0)

  return NextResponse.json({
    readCount, needCount, needValue, watching: open.length - needCount,
    questions: byAccount.slice(0, 4), bigger,
    reading: [...open].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))).slice(0, 6)
      .map(s => ({ id: s.id, title: s.title ?? 'Signal', account: s.account_name ?? '', when: ago(s.created_at, now), source: SRC[String(s.source_integration ?? '')] ?? '' })),
    ledger: { atRisk: atRisk.valueText, protected: M.protectedRevenue(accts, sigs).valueText, critical: open.filter(s => s.severity === 'high').length },
  })
}
