// Composes the agent's messages from signals, accounts and commitments that already
// exist. No detection happens here and nothing is stored as truth: messages are rendered
// at read time, so a figure can never go stale inside a message.

export type AgentLane = 'brief' | 'commitments' | 'risk' | 'quiet' | 'renewals'
export type Receipt = { type: 'signal' | 'account' | 'commitment'; id: string; label: string; href: string }
export type AgentAction = { label: string; href?: string; ask?: string }
export type AgentMessage = {
  key: string                     // subject key: one message per subject, never repeated
  lane: AgentLane
  priority: 'critical' | 'normal'
  account?: string
  headline: string                // one line, human
  body: string                    // two or three sentences at most
  amount?: number
  receipts: Receipt[]
  actions: AgentAction[]
}
export type AgentBrief = { greeting: string; summary: string; messages: AgentMessage[]; generatedAt: string; quiet: boolean }

type Sig = { id: string; account_name?: string | null; signal_type?: string | null; severity?: string | null; title?: string | null; description?: string | null; risk_amount?: number | null; created_at?: string | null; status?: string | null; is_dismissed?: boolean | null; ai_analysis?: Record<string, unknown> | null }
type Acct = { id?: string; name: string; value?: number | null; risk_level?: string | null; health_score?: number | null; last_contact_date?: string | null; close_date?: string | null; owner?: string | null }
type Commit = { id: string; text: string; account?: string | null; daysLate: number }

const money = (v?: number | null) => {
  const n = Number(v || 0)
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}
const daysSince = (iso?: string | null, now = Date.now()) => (iso ? Math.floor((now - new Date(iso).getTime()) / 86_400_000) : null)
const daysUntil = (iso?: string | null, now = Date.now()) => (iso ? Math.ceil((new Date(iso).getTime() - now) / 86_400_000) : null)
const norm = (t?: string | null) => (t ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
const QUIET = /silent|stall|disengag|champion|dark|ghost/i
const RISK = /price|flinch|competitor|legal|timeline|slip|budget|backward|invoice|objection/i

export function composeAgent(input: { firstName: string; accounts: Acct[]; signals: Sig[]; commitments: Commit[]; now?: number }): AgentBrief {
  const now = input.now ?? Date.now()
  const open = input.signals.filter(s => !s.is_dismissed && (!s.status || s.status === 'open') && s.severity !== 'positive')
  const byAcct = new Map(input.accounts.map(a => [a.name, a]))
  const used = new Set<string>()               // one lane per account per day
  const out: AgentMessage[] = []
  const acctHref = (n: string) => `/accounts/${encodeURIComponent(n)}`

  // 1. Commitments: what you promised and is now late. Nearest deadline wins, so first.
  for (const c of [...input.commitments].sort((a, b) => b.daysLate - a.daysLate)) {
    if (c.daysLate < 0) continue
    const who = c.account ? ` for ${c.account}` : ''
    const acc = c.account ? byAcct.get(c.account) : undefined
    const worst = open.filter(s => s.account_name === c.account && s.severity === 'high').sort((a, b) => Number(b.risk_amount || 0) - Number(a.risk_amount || 0))[0]
    const context = worst ? ` Meanwhile, ${worst.title?.charAt(0).toLowerCase()}${worst.title?.slice(1)}.` : ''
    out.push({
      key: `commitment:${c.id}`, lane: 'commitments', priority: c.daysLate >= 3 || (worst && Number(worst.risk_amount || 0) >= 250_000) ? 'critical' : 'normal', account: c.account ?? undefined,
      amount: Number(acc?.value || worst?.risk_amount || 0) || undefined,
      headline: c.daysLate === 0 ? `Due today${who}` : `${c.daysLate} day${c.daysLate === 1 ? '' : 's'} late${who}`,
      body: `You said you'd ${c.text.charAt(0).toLowerCase()}${c.text.slice(1).replace(/\.$/, '')}${acc?.value ? `, on a ${money(acc.value)} account` : ''}. ${c.daysLate === 0 ? 'It is due today.' : 'The other side will have noticed.'}${context}`,
      receipts: [{ type: 'commitment', id: c.id, label: c.text, href: c.account ? acctHref(c.account) : '/pulse' }, ...(worst ? [{ type: 'signal' as const, id: worst.id, label: worst.title ?? 'Signal', href: `/signals?signal=${worst.id}` }] : [])],
      actions: [{ label: 'Draft it now', ask: `Draft the message to complete this commitment: "${c.text}"${who}.` }, ...(c.account ? [{ label: 'Open account', href: acctHref(c.account) }] : [])],
    })
    if (c.account) used.add(c.account)
  }

  // 2. Deal risk: objections and slippage, biggest dollars first.
  for (const s of [...open].filter(s => s.severity === 'high' || RISK.test(s.signal_type || '')).sort((a, b) => Number(b.risk_amount || 0) - Number(a.risk_amount || 0))) {
    const acct = s.account_name || ''
    if (!acct || used.has(acct)) continue
    const quote = (s.ai_analysis?.quote as string | undefined)
    const person = (s.ai_analysis?.person as string | undefined)
    out.push({
      key: `signal:${s.id}`, lane: 'risk', priority: Number(s.risk_amount || 0) >= 250_000 && s.severity === 'high' ? 'critical' : 'normal', account: acct, amount: Number(s.risk_amount || 0) || undefined,
      headline: `${acct} · ${s.title ?? 'needs a look'}`,
      body: [
        quote ? `${person ? person + ' said' : 'They said'} "${quote.replace(/^"|"$/g, '')}".`
          : (s.description && norm(s.description) !== norm(s.title) && !norm(s.description).startsWith(norm(s.title)) ? s.description : (s.ai_analysis?.recommendation as string | undefined) ?? ''),
        s.risk_amount ? `${money(s.risk_amount)} is riding on this.` : '',
      ].filter(Boolean).map(t => /[.!?"]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`).join(' '),
      receipts: [{ type: 'signal', id: s.id, label: s.title ?? 'Signal', href: `/signals?signal=${s.id}` }, { type: 'account', id: acct, label: acct, href: acctHref(acct) }],
      actions: [{ label: 'Draft a reply', href: `/signals?signal=${s.id}&action=reply` }, { label: 'Ask about this', ask: `What should I do about ${acct}: ${s.title}?` }],
    })
    used.add(acct)
  }

  // 3. Quiet accounts: silence on accounts that matter.
  const quietSigs = open.filter(s => QUIET.test(`${s.signal_type} ${s.title}`))
  const quietAccts = input.accounts.filter(a => (a.risk_level === 'high' || a.risk_level === 'medium') && (daysSince(a.last_contact_date, now) ?? 0) >= 5)
  for (const a of [...new Set([...quietSigs.map(s => s.account_name || ''), ...quietAccts.map(a => a.name)])].filter(Boolean)) {
    if (used.has(a)) continue
    const acc = byAcct.get(a); const d = daysSince(acc?.last_contact_date, now)
    out.push({
      key: `quiet:${a}`, lane: 'quiet', priority: 'normal', account: a, amount: Number(acc?.value || 0) || undefined,
      headline: `${a} has gone quiet`,
      body: `${d != null ? `No reply in ${d} days` : 'Replies have stopped'}${acc?.value ? ` on ${money(acc.value)}` : ''}. That usually means a decision is happening without you in the room.`,
      receipts: [{ type: 'account', id: a, label: a, href: acctHref(a) }],
      actions: [{ label: 'Write a nudge', ask: `Write a short, human nudge to re-open the conversation with ${a}.` }, { label: 'Open account', href: acctHref(a) }],
    })
    used.add(a)
  }

  // 4. Renewals: dates inside 30 days on accounts not already covered.
  for (const a of input.accounts) {
    const d = daysUntil(a.close_date, now)
    if (d == null || d < 0 || d > 30 || used.has(a.name)) continue
    out.push({
      key: `renewal:${a.name}`, lane: 'renewals', priority: 'normal', account: a.name, amount: Number(a.value || 0) || undefined,
      headline: `${a.name} closes in ${d} day${d === 1 ? '' : 's'}`,
      body: `${a.value ? `${money(a.value)} ` : ''}with health at ${a.health_score ?? '--'}. ${Number(a.health_score) >= 70 ? 'Looks on track; worth a quick confirm.' : 'Not where it should be this close to the date.'}`,
      receipts: [{ type: 'account', id: a.name, label: a.name, href: acctHref(a.name) }],
      actions: [{ label: 'Open account', href: acctHref(a.name) }],
    })
    used.add(a.name)
  }

  const top = out.sort((a, b) => (a.priority === b.priority ? (b.amount || 0) - (a.amount || 0) : a.priority === 'critical' ? -1 : 1)).slice(0, 5)
  const atRisk = top.reduce((s, m) => s + (m.amount || 0), 0)
  const hour = new Date(now).getHours()
  const hello = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
  const summary = top.length === 0
    ? 'Nothing needs you right now. I will say something the moment that changes.'
    : `${top.length === 1 ? 'One thing needs' : `${top.length} things need`} you today${atRisk ? `, with ${money(atRisk)} behind them` : ''}. ${top[0].account ? `Start with ${top[0].account}.` : ''}`
  return { greeting: `${hello}, ${input.firstName}.`, summary, messages: top, generatedAt: new Date(now).toISOString(), quiet: top.length === 0 }
}
