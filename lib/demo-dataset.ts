// Static dataset for the demo account, shaped exactly like live rows so the
// REDESIGNED real components render it directly (one design, two data sources).
// Ids are non-uuid on purpose: the Account360 uuid guard keeps them off the RPC.
import type { Account, Signal } from '@/types'

const d = (daysAgo: number, h = 10) => { const x = new Date(); x.setDate(x.getDate() - daysAgo); x.setHours(h, 24, 0, 0); return x.toISOString() }
const fut = (days: number) => { const x = new Date(); x.setDate(x.getDate() + days); return x.toISOString() }

const A = (id: string, name: string, domain: string, health: number, value: number, stage: string, risk: 'high' | 'medium' | 'low', lastContact: number, close: number, tags: string[]): Account => ({
  id, name, domain, health_score: health, value, stage, owner: 'Andy G', risk_level: risk,
  close_date: fut(close), last_contact_date: d(lastContact), tags, user_id: 'demo', created_at: d(220),
})

export const DEMO_ACCOUNTS: Account[] = [
  A('demo-nexus', 'Nexus Systems', 'nexussystems.io', 34, 780_000, 'Contract Sent', 'high', 3, 6, ['Enterprise', 'Q3 close']),
  A('demo-meridian', 'Meridian Health', 'meridianhealth.com', 41, 550_000, 'Negotiation', 'high', 5, 18, ['At risk']),
  A('demo-acme', 'Acme Logistics', 'acmelogistics.com', 72, 1_250_000, 'Decision Maker Bought-In', 'medium', 1, 34, ['Enterprise']),
  A('demo-brightline', 'Brightline Media', 'brightline.co', 68, 240_000, 'Proposal', 'medium', 2, 41, []),
  A('demo-vertex', 'Vertex Manufacturing', 'vertexmfg.com', 81, 1_900_000, 'Discovery', 'low', 4, 88, ['Enterprise', 'New logo']),
  A('demo-koa', 'Koa Financial', 'koafinancial.sg', 77, 430_000, 'Evaluation', 'low', 6, 55, []),
  A('demo-halcyon', 'Halcyon Retail', 'halcyonretail.com', 58, 310_000, 'Proposal', 'medium', 19, 47, []),
  A('demo-pacifica', 'Pacifica Energy', 'pacificaenergy.com', 88, 2_400_000, 'Closed Won - Expansion', 'low', 2, 120, ['Momentum']),
  A('demo-summit', 'Summit Devices', 'summitdevices.com', 63, 175_000, 'Evaluation', 'medium', 27, 64, []),
]

const S = (id: string, account: string, type: string, sev: 'high' | 'watch' | 'positive', title: string, desc: string, src: string, ageDays: number, extra: Partial<Signal> = {}): Signal => ({
  id, account_id: null, account_name: account, signal_type: type, severity: sev, title, description: desc,
  source_integration: src, ai_analysis: { confidence: 84 }, created_at: d(ageDays, 9 + (ageDays % 7)),
  ...extra,
} as Signal)

export const DEMO_SIGNALS: Signal[] = [
  S('demo-sg-1', 'Nexus Systems', 'silent_stall', 'high',
    'CFO went quiet 3 days before signature', 'Daniel Reyes opened the contract twice but has not replied since Tuesday. Their prior reply gap on this thread averaged 6 hours.', 'gmail', 0,
    { risk_amount: 780_000, ai_analysis: { confidence: 91, quote: 'I want to walk the numbers past our board first.', recommendation: 'offer a 20-minute board-prep call before Friday' } as Signal['ai_analysis'],
      corroboration: { concern: 'stall', with: [{ signal_id: 'demo-sg-2', source: 'slack', at: d(1) }], reason: 'Same concern surfaced on Slack and email within 24h' } as Signal['corroboration'] }),
  S('demo-sg-2', 'Nexus Systems', 'price_flinch', 'high',
    'Procurement pushed back on year-two pricing', 'Their ops lead called the ramp "steeper than expected" in the shared channel and asked for the TCO sheet again.', 'slack', 1,
    { risk_amount: 780_000, ai_analysis: { confidence: 86, quote: 'the year-two ramp is steeper than we expected', recommendation: 'resend the TCO sheet with the ramp flattened over 3 years' } as Signal['ai_analysis'] }),
  S('demo-sg-3', 'Meridian Health', 'call_objection', 'high',
    'Compliance named a blocking objection on the call', 'Their counsel flagged data-residency requirements as unresolved. Objection type: authority. No follow-up scheduled.', 'fireflies', 2,
    { risk_amount: 550_000, ai_analysis: { confidence: 78, quote: 'until residency is settled, legal will not sign off', recommendation: 'send the SG-region hosting addendum today' } as Signal['ai_analysis'] }),
  S('demo-sg-4', 'Meridian Health', 'meeting_cancelled', 'watch',
    'Steering meeting cancelled without a re-book', 'Thursday review was cancelled by their PMO an hour before start. No new invite has appeared.', 'gcal', 1, { risk_amount: 550_000 }),
  S('demo-sg-5', 'Acme Logistics', 'call_buying_signal', 'positive',
    'VP Ops asked for rollout timeline in writing', 'On the Wednesday call their VP asked for a phased rollout plan and named January as the target go-live.', 'zoom', 1,
    { ai_analysis: { confidence: 93, quote: 'send me the phased plan - January is realistic for us', recommendation: 'send the rollout one-pager while it is warm' } as Signal['ai_analysis'] }),
  S('demo-sg-6', 'Brightline Media', 'competitor_mention', 'watch',
    'Rival named in the eval thread', 'Their marketing lead asked how the platform compares on attribution. First competitor mention in this cycle.', 'gmail', 3,
    { ai_analysis: { confidence: 74, recommendation: 'send the comparison one-pager before their Friday sync' } as Signal['ai_analysis'] }),
  S('demo-sg-7', 'Halcyon Retail', 'silent_stall', 'watch',
    'Quiet for 19 days against a weekly cadence', 'Correspondence ran weekly for two months, then stopped after the pricing email. No opens recorded this week.', 'gmail', 2, { risk_amount: 310_000 }),
  S('demo-sg-8', 'Pacifica Energy', 'reengaged', 'positive',
    'Champion returned asking about expansion seats', 'After the rollout, their program lead asked about adding two more regions in Q4.', 'gmail', 2,
    { ai_analysis: { confidence: 90, recommendation: 'lock a Q4 expansion call this week' } as Signal['ai_analysis'] }),
  S('demo-sg-9', 'Summit Devices', 'timeline_slip', 'watch',
    'Eval end date moved for the second time', 'Their team pushed the evaluation close from Sep 12 to Sep 26 in the shared doc.', 'hubspot', 4, { risk_amount: 175_000 }),
  S('demo-sg-10', 'Vertex Manufacturing', 'call_commitment', 'positive',
    'They committed to intro the plant director', 'On the discovery call their COO promised an introduction to the Surabaya plant director next week.', 'meet', 5,
    { ai_analysis: { confidence: 88 } as Signal['ai_analysis'] }),
  S('demo-sg-11', 'Koa Financial', 'legal_loopin', 'watch',
    'Outside counsel added to the thread', 'A partner from their external firm joined the DPA thread. Review cycles typically add 2-3 weeks.', 'gmail', 6, { risk_amount: 430_000 }),
  S('demo-sg-12', 'Acme Logistics', 'call_summary', 'positive',
    'Strong technical validation call', 'Their platform team confirmed the integration path and raised no blockers.', 'zoom', 7,
    { status: 'handled', handled_action: 'Sent follow-up', ai_analysis: { confidence: 89 } as Signal['ai_analysis'] }),
  S('demo-sg-13', 'Brightline Media', 'meeting_declined', 'watch',
    'Kickoff invite declined by their CMO', 'Declined without comment; the rest of their team accepted.', 'gcal', 8,
    { status: 'handled', handled_action: 'Called them' }),
]
