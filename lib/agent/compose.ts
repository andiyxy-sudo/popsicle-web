// Composes the agent's notes from signals, accounts, commitments and recent actions that
// already exist. No detection happens here and nothing is stored as truth: notes are
// rendered at read time, so a figure can never go stale inside a note.
//
// Voice: an analyst who has already read everything. Lead with the fact, show the
// evidence, give a view, recommend one thing. No greetings inside notes, no persona.

export type AgentLane = 'commitments' | 'risk' | 'quiet' | 'followup' | 'renewals'
export type Receipt = { type: 'signal' | 'account' | 'commitment'; id: string; label: string; href: string }
export type AgentAction = { label: string; href?: string; ask?: string }
export type AgentMessage = {
  key: string                     // subject key: one note per subject, never repeated
  lane: AgentLane
  priority: 'critical' | 'normal'
  account?: string
  amount?: number
  source?: string                 // gmail, slack…
  when?: string                   // ISO time of the underlying event
  tag?: string                    // dateline qualifier: "2 DAYS LATE", "CLOSES IN 9 DAYS"
  headline: string                // the fact, one sentence
  quote?: string                  // their words, verbatim
  quoteBy?: string                // who said it
  judgment?: string               // what it means and what to do
  receipts: Receipt[]
  actions: AgentAction[]          // actions[0] is the one recommended action
}
export type AgentBrief = { greeting: string; summary: string; read: number; needYou: number; watching: number; messages: AgentMessage[]; generatedAt: string; quiet: boolean }

type Sig = { id: string; account_name?: string | null; signal_type?: string | null; severity?: string | null; title?: string | null; description?: string | null; risk_amount?: number | null; created_at?: string | null; status?: string | null; is_dismissed?: boolean | null; source_integration?: string | null; ai_analysis?: Record<string, unknown> | null }
type Acct = { id?: string; name: string; value?: number | null; risk_level?: string | null; health_score?: number | null; last_contact_date?: string | null; close_date?: string | null; owner?: string | null }
type Commit = { id: string; text: string; account?: string | null; daysLate: number }
export type FollowUp = { id: string; account: string; did: string; since: string; view: string; when?: string }

export const money = (v?: number | null) => {
  const n = Number(v || 0)
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}
const daysSince = (iso?: string | null, now = Date.now()) => (iso ? Math.floor((now - new Date(iso).getTime()) / 86_400_000) : null)
const daysUntil = (iso?: string | null, now = Date.now()) => (iso ? Math.ceil((new Date(iso).getTime() - now) / 86_400_000) : null)
const norm = (t?: string | null) => (t ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
const sentence = (t?: string | null) => { const x = (t ?? '').trim(); return x ? (/[.!?]$/.test(x) ? x : `${x}.`) : '' }
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
const QUIET = /silent|stall|disengag|champion|dark|ghost/i
const RISK = /price|flinch|competitor|legal|timeline|slip|budget|backward|invoice|objection/i

export function composeAgent(input: { firstName: string; accounts: Acct[]; signals: Sig[]; commitments: Commit[]; followups?: FollowUp[]; read?: number; now?: number }): AgentBrief {
  const now = input.now ?? Date.now()
  const open = input.signals.filter(s => !s.is_dismissed && (!s.status || s.status === 'open') && s.severity !== 'positive')
  const byAcct = new Map(input.accounts.map(a => [a.name, a]))
  const used = new Set<string>()               // one note per account per day
  const out: AgentMessage[] = []
  const acctHref = (n: string) => `/accounts/${encodeURIComponent(n)}`
  const quoteOf = (s?: Sig) => { const q = (s?.ai_analysis?.quote as string | undefined)?.trim(); return q ? q.replace(/^["“]|["”]$/g, '') : undefined }
  const recOf = (s?: Sig) => (s?.ai_analysis?.recommendation as string | undefined)?.trim()

  // 1. Your promises. Nearest deadline wins, so these go first.
  for (const c of [...input.commitments].sort((a, b) => b.daysLate - a.daysLate)) {
    if (c.daysLate < 0) continue
    const acc = c.account ? byAcct.get(c.account) : undefined
    // the account's most serious open signal, preferring one with the buyer's own words
    const worst = open.filter(s => s.account_name === c.account && s.severity === 'high')
      .sort((a, b) => (Number(b.risk_amount || 0) - Number(a.risk_amount || 0)) || (quoteOf(b) ? 1 : 0) - (quoteOf(a) ? 1 : 0))[0]
    const withQuote = open.find(s => s.account_name === c.account && quoteOf(s)) ?? worst
    out.push({
      key: `commitment:${c.id}`, lane: 'commitments', account: c.account ?? undefined, amount: Number(acc?.value || worst?.risk_amount || 0) || undefined,
      priority: c.daysLate >= 3 || Number(worst?.risk_amount || 0) >= 250_000 ? 'critical' : 'normal',
      tag: c.daysLate === 0 ? 'DUE TODAY' : `${c.daysLate} DAY${c.daysLate === 1 ? '' : 'S'} LATE`,
      headline: `Still open: ${lowerFirst(sentence(c.text))}`,
      quote: quoteOf(withQuote), quoteBy: quoteOf(withQuote) ? (acc?.owner ?? undefined) : undefined, source: withQuote?.source_integration ?? undefined, when: withQuote?.created_at ?? undefined,
      judgment: c.daysLate === 0
        ? 'Due today. Doing it before noon keeps the date you gave them.'
        : `${worst ? `${sentence(worst.title)} ` : ''}This promise is now ${c.daysLate} day${c.daysLate === 1 ? '' : 's'} late, and on their side that reads as a signal too. Send it before anything else today.`,
      receipts: [{ type: 'commitment', id: c.id, label: c.text, href: c.account ? acctHref(c.account) : '/pulse' }, ...(worst ? [{ type: 'signal' as const, id: worst.id, label: worst.title ?? 'Signal', href: `/signals?signal=${worst.id}` }] : [])],
      actions: [{ label: 'Draft it', ask: `Draft the message to complete this commitment: "${c.text}"${c.account ? ` for ${c.account}` : ''}. Keep it short and specific.` }, ...(c.account ? [{ label: 'Open account', href: acctHref(c.account) }] : [])],
    })
    if (c.account) used.add(c.account)
  }

  // 2. Deal risk: objections and slippage, biggest dollars first.
  for (const s of [...open].filter(s => s.severity === 'high' || RISK.test(s.signal_type || '')).sort((a, b) => Number(b.risk_amount || 0) - Number(a.risk_amount || 0))) {
    const acct = s.account_name || ''
    if (!acct || used.has(acct)) continue
    const q = quoteOf(s)
    const desc = s.description && norm(s.description) !== norm(s.title) && !norm(s.description).startsWith(norm(s.title)) ? s.description : ''
    out.push({
      key: `signal:${s.id}`, lane: 'risk', account: acct, amount: Number(s.risk_amount || 0) || undefined, source: s.source_integration ?? undefined, when: s.created_at ?? undefined,
      priority: Number(s.risk_amount || 0) >= 250_000 && s.severity === 'high' ? 'critical' : 'normal',
      headline: sentence(s.title ?? 'Needs a look'),
      quote: q, quoteBy: q ? (byAcct.get(acct)?.owner ?? undefined) : undefined,
      judgment: [sentence(desc), sentence(recOf(s))].filter(Boolean).join(' ') || undefined,
      receipts: [{ type: 'signal', id: s.id, label: s.title ?? 'Signal', href: `/signals?signal=${s.id}` }, { type: 'account', id: acct, label: acct, href: acctHref(acct) }],
      actions: [{ label: 'Draft a reply', href: `/signals?signal=${s.id}&action=reply` }, { label: 'Ask about this', ask: `What should I do about ${acct}: ${s.title}?` }],
    })
    used.add(acct)
  }

  // 3. Gone quiet: silence on accounts that matter.
  const quietSigs = open.filter(s => QUIET.test(`${s.signal_type} ${s.title}`))
  const quietAccts = input.accounts.filter(a => (a.risk_level === 'high' || a.risk_level === 'medium') && (daysSince(a.last_contact_date, now) ?? 0) >= 5)
  for (const a of [...new Set([...quietSigs.map(s => s.account_name || ''), ...quietAccts.map(a => a.name)])].filter(Boolean)) {
    if (used.has(a)) continue
    const acc = byAcct.get(a); const d = daysSince(acc?.last_contact_date, now)
    out.push({
      key: `quiet:${a}`, lane: 'quiet', priority: 'normal', account: a, amount: Number(acc?.value || 0) || undefined, tag: d != null ? `${d} DAYS QUIET` : 'GONE QUIET',
      headline: `${a} has gone quiet${d != null ? ` for ${d} days` : ''}.`,
      judgment: 'Silence this long, after regular replies, usually means a decision is being made without you in the room. A short, specific question gets an answer faster than a check-in.',
      receipts: [{ type: 'account', id: a, label: a, href: acctHref(a) }],
      actions: [{ label: 'Write the question', ask: `Write one short, specific question that would get ${a} to reply today.` }, { label: 'Open account', href: acctHref(a) }],
    })
    used.add(a)
  }

  // 4. Follow-through: what you did, and what happened since. Doesn't take an account's slot.
  for (const f of input.followups ?? []) {
    out.push({
      key: `follow:${f.id}`, lane: 'followup', priority: 'normal', account: f.account, amount: Number(byAcct.get(f.account)?.value || 0) || undefined, when: f.when, tag: 'FOLLOWING UP',
      headline: sentence(f.did), judgment: `${sentence(f.since)} ${sentence(f.view)}`.trim(),
      receipts: [{ type: 'account', id: f.account, label: f.account, href: acctHref(f.account) }],
      actions: [{ label: 'Open account', href: acctHref(f.account) }],
    })
  }

  // 5. Renewals inside 30 days on accounts not already covered.
  for (const a of input.accounts) {
    const d = daysUntil(a.close_date, now)
    if (d == null || d < 0 || d > 30 || used.has(a.name)) continue
    const ok = Number(a.health_score) >= 70
    out.push({
      key: `renewal:${a.name}`, lane: 'renewals', priority: 'normal', account: a.name, amount: Number(a.value || 0) || undefined, tag: `CLOSES IN ${d} DAY${d === 1 ? '' : 'S'}`,
      headline: `${a.name} closes in ${d} day${d === 1 ? '' : 's'}, health ${a.health_score ?? '--'}.`,
      judgment: ok ? 'On track. A two-line confirmation of the date and the signatories removes the last surprise.' : 'Not where it should be this close to the date. Find out what changed before the date slips.',
      receipts: [{ type: 'account', id: a.name, label: a.name, href: acctHref(a.name) }],
      actions: [{ label: 'Open account', href: acctHref(a.name) }],
    })
    used.add(a.name)
  }

  const ranked = out.sort((a, b) => (a.priority === b.priority ? (b.amount || 0) - (a.amount || 0) : a.priority === 'critical' ? -1 : 1))
  const action = ranked.filter(m => m.lane !== 'followup').slice(0, 4)
  const follow = ranked.filter(m => m.lane === 'followup').slice(0, 2)
  const top = [...action, ...follow]
  const read = Math.max(input.read ?? 0, input.signals.length)
  const watching = Math.max(0, open.length - action.length)
  const behind = action.reduce((s, m) => s + (m.amount || 0), 0)
  const summary = action.length === 0
    ? `I read ${read} signals. Nothing needs you right now; I'll say something the moment that changes.`
    : `I read ${read} signals since yesterday. ${action.length === 1 ? 'One needs' : `${['', '', 'Two', 'Three', 'Four'][action.length] ?? action.length} need`} you${behind ? `, ${money(behind)} between them` : ''}. The rest I'm watching.`
  const hour = new Date(now).getHours()
  return {
    greeting: `${hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'}, ${input.firstName}.`,
    summary, read, needYou: action.length, watching, messages: top, generatedAt: new Date(now).toISOString(), quiet: action.length === 0,
  }
}
