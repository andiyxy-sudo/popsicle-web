// One definition per number. Each function returns the figure AND its explanation, and the
// screens display the same value these functions compute, so a number and its breakdown can
// never disagree. Used for the demo dataset and for live data alike.

export type Sig = { id: string; account_name?: string | null; signal_type?: string | null; severity?: string | null; title?: string | null; description?: string | null;
  risk_amount?: number | null; created_at?: string | null; status?: string | null; is_dismissed?: boolean | null; source_integration?: string | null;
  handled_at?: string | null; handled_action?: string | null; ai_analysis?: Record<string, unknown> | null }
export type Acct = { name: string; value?: number | null; stage?: string | null; risk_level?: string | null; health_score?: number | null; owner?: string | null; close_date?: string | null }
export type Evidence = { signalId: string; quote?: string; who?: string; source?: string; when?: string; title: string }
export type XNode = { id: string; label: string; value?: number; valueText?: string; note?: string; href?: string; children?: XNode[]; evidence?: Evidence }
export type Explanation = { metric: string; label: string; value: number; valueText: string; definition: string; parts: XNode[]; n?: number; interval?: [number, number]; collecting?: boolean; footnote?: string }

export const money = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`)
const isOpen = (s: Sig) => !s.is_dismissed && (!s.status || s.status === 'open')
const SEV_ORDER: Record<string, number> = { high: 0, watch: 1, positive: 2 }
const acctHref = (n: string) => `/accounts/${encodeURIComponent(n)}`

function evidence(s: Sig, accts: Acct[]): Evidence {
  const q = (s.ai_analysis?.quote as string | undefined)?.replace(/^["“]|["”]$/g, '')
  // no speaker is inferred: a signal records where the words came from, not reliably who said them
  return { signalId: s.id, title: s.title ?? 'Signal', quote: q, who: undefined,
    source: s.source_integration ?? undefined, when: (s.status === 'handled' ? s.handled_at : s.created_at) ?? undefined }
}
const sigNode = (s: Sig, accts: Acct[], showAmount = true): XNode => ({
  id: s.id, label: s.title ?? 'Signal', value: showAmount ? Number(s.risk_amount || 0) || undefined : undefined,
  note: [s.severity === 'high' ? 'critical' : s.severity, s.status === 'handled' ? `handled · ${s.handled_action ?? 'action'}` : null].filter(Boolean).join(' · '),
  href: `/signals?signal=${s.id}`, evidence: evidence(s, accts),
})

/** Revenue at risk: for each account with an open high-severity signal, the largest amount at risk on it. */
export function atRisk(accts: Acct[], sigs: Sig[]): Explanation {
  const open = sigs.filter(isOpen)
  const names = [...new Set(open.filter(s => s.severity === 'high').map(s => s.account_name || ''))].filter(Boolean)
  const parts: XNode[] = names.map(n => {
    const mine = open.filter(s => s.account_name === n && s.severity !== 'positive').sort((a, b) => (SEV_ORDER[a.severity ?? ''] - SEV_ORDER[b.severity ?? '']) || String(b.created_at).localeCompare(String(a.created_at)))
    const v = Math.max(0, ...mine.map(s => Number(s.risk_amount || 0)))
    return { id: `acct:${n}`, label: n, value: v, note: `${mine.filter(s => s.severity === 'high').length} critical signals`, href: acctHref(n), children: mine.slice(0, 6).map(s => sigNode(s, accts, false)) }
  }).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const value = parts.reduce((t, p) => t + (p.value ?? 0), 0)
  return { metric: 'at_risk', label: 'Revenue at risk', value, valueText: money(value), parts,
    definition: 'For each account with an open critical signal, the largest amount at risk on that account. Each account is counted once.' }
}

/** Active signals: open signals, by severity. */
export function activeSignals(accts: Acct[], sigs: Sig[], nowMs = Date.now()): Explanation {
  const open = sigs.filter(isOpen)
  const newToday = open.filter(s => s.created_at && nowMs - new Date(s.created_at).getTime() <= 24 * 3600e3).length
  const parts: XNode[] = (['high', 'watch', 'positive'] as const).map(sev => {
    const mine = open.filter(s => s.severity === sev)
    const byAcct = [...new Set(mine.map(s => s.account_name || ''))].filter(Boolean).map(n => ({
      id: `${sev}:${n}`, label: n, valueText: String(mine.filter(s => s.account_name === n).length), href: acctHref(n),
      children: mine.filter(s => s.account_name === n).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6).map(s => sigNode(s, accts)),
    })).sort((a, b) => Number(b.valueText) - Number(a.valueText))
    return { id: `sev:${sev}`, label: sev === 'high' ? 'Critical' : sev === 'watch' ? 'Watch' : 'Positive', valueText: String(mine.length), children: byAcct }
  })
  return { metric: 'active', label: 'Active signals', value: open.length, valueText: String(open.length), parts,
    definition: `Signals that are open (not handled, snoozed or dismissed). ${newToday} arrived in the last 24 hours.` }
}

/** Revenue protected: amount at risk on signals that were acted on, on accounts no longer at high risk. */
export function protectedRevenue(accts: Acct[], sigs: Sig[]): Explanation {
  const saved = sigs.filter(s => s.status === 'handled' && Number(s.risk_amount || 0) > 0 && (s.severity === 'high' || s.severity === 'watch')
    && accts.find(a => a.name === s.account_name)?.risk_level !== 'high')
  const parts: XNode[] = saved.map(s => ({ id: `acct:${s.account_name}:${s.id}`, label: s.account_name || 'Account', value: Number(s.risk_amount), note: `${s.handled_action ?? 'Acted on'} · risk now ${accts.find(a => a.name === s.account_name)?.risk_level ?? 'low'}`,
    href: acctHref(s.account_name || ''), children: [sigNode(s, accts, false)] })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const value = parts.reduce((t, p) => t + (p.value ?? 0), 0)
  const actions = sigs.filter(s => s.status === 'handled').length
  return { metric: 'protected', label: 'Revenue protected', value, valueText: money(value), parts,
    definition: 'The amount at risk on signals your team acted on, where the account is no longer at high risk. Each save is counted once.',
    footnote: `${parts.length} saves out of ${actions} actions taken this quarter.` }
}

/** Commit: deals in Negotiation or Closing, plus Proposal deals with healthy engagement (health 70+). */
export function commit(accts: Acct[], sigs: Sig[]): Explanation {
  const inCommit = accts.filter(a => /negotiation|closing/i.test(a.stage || '') || (/proposal/i.test(a.stage || '') && Number(a.health_score ?? 0) >= 70))
  const parts: XNode[] = inCommit.map(a => ({ id: `acct:${a.name}`, label: a.name, value: Number(a.value || 0), note: `${a.stage}${a.risk_level === 'high' ? ' · at risk' : ''} · health ${a.health_score ?? '--'}`, href: acctHref(a.name),
    children: sigs.filter(s => isOpen(s) && s.account_name === a.name && s.severity !== 'positive').slice(0, 4).map(s => sigNode(s, accts, false)) })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const value = parts.reduce((t, p) => t + (p.value ?? 0), 0)
  return { metric: 'commit', label: 'Commit', value, valueText: money(value), parts,
    definition: 'Deals in Negotiation or Closing, plus Proposal deals with healthy engagement (health 70 or above), at full annual value.' }
}

/** Total ARR across accounts. */
export function totalArr(accts: Acct[]): Explanation {
  const parts: XNode[] = [...accts].sort((a, b) => Number(b.value || 0) - Number(a.value || 0)).map(a => ({ id: `acct:${a.name}`, label: a.name, value: Number(a.value || 0), note: `${a.stage ?? ''}${a.risk_level ? ` · ${a.risk_level} risk` : ''}`, href: acctHref(a.name) }))
  const value = parts.reduce((t, p) => t + (p.value ?? 0), 0)
  return { metric: 'total_arr', label: 'Total ARR', value, valueText: money(value), parts, definition: 'The sum of every tracked account\u2019s annual value.' }
}

/** One account's value, with what is putting it at risk. */
export function accountArr(name: string, accts: Acct[], sigs: Sig[]): Explanation {
  const a = accts.find(x => x.name === name)
  const open = sigs.filter(s => isOpen(s) && s.account_name === name).sort((x, y) => (SEV_ORDER[x.severity ?? ''] - SEV_ORDER[y.severity ?? '']))
  const value = Number(a?.value || 0)
  return { metric: 'account_arr', label: `${name} · annual value`, value, valueText: money(value),
    definition: `From the deal record: ${a?.stage ?? 'stage unknown'}${a?.owner ? `, contact ${a.owner}` : ''}${a?.close_date ? `, closing ${new Date(a.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}.`,
    parts: open.slice(0, 8).map(s => sigNode(s, accts)) }
}

/** One account's health, from its four components, and the signals moving it. */
export function accountHealth(name: string, accts: Acct[], sigs: Sig[], breakdown?: Array<{ k: string; v: number }>): Explanation {
  const a = accts.find(x => x.name === name)
  const value = Number(a?.health_score ?? 0)
  const parts: XNode[] = (breakdown ?? []).map(b => ({ id: `hb:${b.k}`, label: b.k, valueText: String(b.v) }))
  const moving = sigs.filter(s => isOpen(s) && s.account_name === name).slice(0, 5)
  if (moving.length) parts.push({ id: 'moving', label: 'Signals moving it', valueText: String(moving.length), children: moving.map(s => sigNode(s, accts, false)) })
  return { metric: 'account_health', label: `${name} · health`, value, valueText: String(value), parts,
    definition: breakdown?.length ? `The average of four components: ${breakdown.map(b => b.k.toLowerCase()).join(', ')}. 70 and above is healthy, below 40 is critical.` : 'Health score from the account record. 70 and above is healthy, below 40 is critical.' }
}

/** A single signal's amount, with its evidence. */
export function signalAmount(id: string, accts: Acct[], sigs: Sig[]): Explanation {
  const s = sigs.find(x => x.id === id)
  const value = Number(s?.risk_amount || 0)
  return { metric: 'signal', label: s?.title ?? 'Signal', value, valueText: money(value),
    definition: `The value of ${s?.account_name ?? 'the account'} at stake if this signal is right: the deal's annual value from the CRM.`,
    parts: s ? [sigNode(s, accts, false)] : [] }
}

/** Wilson score interval for a proportion (95%). */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n <= 0) return [0, 0]
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)]
}

/** Rated precision: signals marked useful out of signals rated, with n and a 95% interval. */
export function ratedPrecision(byType: Array<{ type: string; useful: number; rated: number }>): Explanation {
  const useful = byType.reduce((t, r) => t + r.useful, 0), rated = byType.reduce((t, r) => t + r.rated, 0)
  const value = rated ? Math.round(useful / rated * 100) : 0
  const iv = wilson(useful, rated)
  const parts: XNode[] = [...byType].sort((a, b) => b.rated - a.rated).map(r => {
    const [lo, hi] = wilson(r.useful, r.rated)
    return { id: `pt:${r.type}`, label: r.type, valueText: r.rated >= 30 ? `${Math.round(r.useful / r.rated * 100)}%` : 'collecting',
      note: r.rated >= 30 ? `${r.useful} of ${r.rated} · ${Math.round(lo * 100)}\u2013${Math.round(hi * 100)}%` : `${r.useful} of ${r.rated} so far · needs 30` }
  })
  return { metric: 'rated_precision', label: 'Rated precision', value, valueText: rated >= 30 ? `${value}%` : 'collecting', parts, n: rated, interval: iv, collecting: rated < 30,
    definition: 'Signals your team marked useful, out of signals rated. Shown with its sample size and a 95% interval; per type once a type has 30 ratings.' }
}

/** A group of accounts (by risk level or stage), with their value. */
export function accountGroup(kind: 'high' | 'medium' | 'closing', accts: Acct[], sigs: Sig[]): Explanation {
  const pick = kind === 'closing' ? accts.filter(a => /clos|won/i.test(a.stage || '')) : accts.filter(a => a.risk_level === kind)
  const parts: XNode[] = pick.map(a => ({ id: `acct:${a.name}`, label: a.name, value: Number(a.value || 0), note: `${a.stage ?? ''} · health ${a.health_score ?? '--'}`, href: acctHref(a.name),
    children: sigs.filter(s => isOpen(s) && s.account_name === a.name && (kind === 'closing' ? true : s.severity !== 'positive')).slice(0, 4).map(s => sigNode(s, accts, false)) })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const value = parts.reduce((t, p) => t + (p.value ?? 0), 0)
  const label = kind === 'closing' ? 'Closing or won' : kind === 'high' ? 'High-risk accounts' : 'Medium-risk accounts'
  const definition = kind === 'closing' ? 'Accounts in the Closing stage or already won, at full annual value.'
    : `Accounts whose overall risk level is ${kind}. Risk level comes from account health: below 40 is high, 40 to 69 is medium.`
  return { metric: `accounts_${kind}`, label, value: pick.length, valueText: `${pick.length} · ${money(value)}`, parts, definition }
}

/** Average health across accounts. */
export function avgHealth(accts: Acct[]): Explanation {
  const withH = accts.filter(a => a.health_score != null)
  const value = withH.length ? Math.round(withH.reduce((t, a) => t + Number(a.health_score), 0) / withH.length) : 0
  const parts: XNode[] = [...withH].sort((a, b) => Number(a.health_score) - Number(b.health_score)).map(a => ({ id: `acct:${a.name}`, label: a.name, valueText: String(a.health_score), note: a.risk_level ? `${a.risk_level} risk` : undefined, href: acctHref(a.name) }))
  return { metric: 'avg_health', label: 'Average health', value, valueText: String(value), parts, definition: `The plain average of ${withH.length} accounts\u2019 health scores, lowest first below.` }
}

/** Money at stake across signals, counting each account once (its largest amount). Several signals
 *  on one deal are several reasons the same money is at risk, not more money. */
export function exposureOf(sigs: Array<{ account_name?: string | null; risk_amount?: number | null }>): number {
  const best = new Map<string, number>()
  for (const s of sigs) { const k = s.account_name || '(none)'; best.set(k, Math.max(best.get(k) ?? 0, Number(s.risk_amount || 0))) }
  let t = 0; for (const v of best.values()) t += v; return t
}

/** Signals raised this quarter that flagged risk early (critical or watch, open or since acted on). */
export function caughtEarly(accts: Acct[], sigs: Sig[]): Explanation {
  const risk = sigs.filter(s => !s.is_dismissed && (s.severity === 'high' || s.severity === 'watch'))
  const names = [...new Set(risk.map(s => s.account_name || ''))].filter(Boolean)
  const parts: XNode[] = names.map(n => ({ id: `acct:${n}`, label: n, valueText: String(risk.filter(s => s.account_name === n).length), href: acctHref(n),
    note: `${risk.filter(s => s.account_name === n && s.status === 'handled').length} acted on`,
    children: risk.filter(s => s.account_name === n).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 5).map(s => sigNode(s, accts, false)) }))
    .sort((a, b) => Number(b.valueText) - Number(a.valueText))
  return { metric: 'caught', label: 'Signals caught early', value: risk.length, valueText: String(risk.length), parts,
    definition: 'Critical and watch signals raised this quarter, whether still open or already acted on: the risks Popsicle surfaced before they showed up in the CRM.' }
}

/** Accounts with an open risk signal (the Revenue Loop's "active cases"). */
export function activeCases(accts: Acct[], sigs: Sig[]): Explanation {
  const open = sigs.filter(s => isOpen(s) && s.severity !== 'positive')
  const names = [...new Set(open.map(s => s.account_name || ''))].filter(Boolean)
  const parts: XNode[] = names.map(n => ({ id: `acct:${n}`, label: n, valueText: `${open.filter(s => s.account_name === n).length} open`, href: acctHref(n),
    children: open.filter(s => s.account_name === n).slice(0, 5).map(s => sigNode(s, accts, false)) }))
  return { metric: 'cases', label: 'Active cases', value: names.length, valueText: String(names.length), parts,
    definition: 'Accounts with at least one open critical or watch signal.' }
}

/** Critical signals with a recommended next step ready (the Revenue Loop's "actions ready"). */
export function actionsReady(accts: Acct[], sigs: Sig[]): Explanation {
  const ready = sigs.filter(s => isOpen(s) && s.severity === 'high' && (s.ai_analysis?.recommendation as string | undefined))
  const parts: XNode[] = ready.map(s => ({ ...sigNode(s, accts, false), note: `next step: ${String(s.ai_analysis?.recommendation)}` }))
  return { metric: 'actions_ready', label: 'Actions ready', value: ready.length, valueText: String(ready.length), parts,
    definition: 'Open critical signals where Popsicle has already prepared the next step for you to approve.' }
}

/** New signals in the last 24 hours. */
export function newToday(accts: Acct[], sigs: Sig[], nowMs = Date.now()): Explanation {
  const fresh = sigs.filter(s => isOpen(s) && s.created_at && nowMs - new Date(s.created_at).getTime() <= 24 * 3600e3)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  return { metric: 'new_today', label: 'New signals', value: fresh.length, valueText: String(fresh.length), parts: fresh.map(s => sigNode(s, accts)),
    definition: 'Signals that arrived in the last 24 hours and are still open.' }
}

/** One rep's exposure: money at stake on their accounts, each account counted once. */
export function repExposure(rep: string, repAccounts: string[], accts: Acct[], sigs: Sig[]): Explanation {
  const open = sigs.filter(s => isOpen(s) && s.severity !== 'positive' && repAccounts.includes(s.account_name || ''))
  const parts: XNode[] = repAccounts.map(n => {
    const mine = open.filter(s => s.account_name === n)
    return { id: `acct:${n}`, label: n, value: Math.max(0, ...mine.map(s => Number(s.risk_amount || 0))), note: mine.length ? `${mine.length} open signals` : 'no open risk', href: acctHref(n), children: mine.slice(0, 4).map(s => sigNode(s, accts, false)) }
  }).filter(p => (p.value ?? 0) > 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const value = parts.reduce((t, p) => t + (p.value ?? 0), 0)
  return { metric: 'rep_exposure', label: `${rep} · exposure`, value, valueText: money(value), parts,
    definition: `Money at stake on ${rep}\u2019s accounts: for each account with an open critical or watch signal, its largest amount at risk, counted once.` }
}

/** Team exposure: every rep's exposure, summed. */
export function teamExposure(reps: Array<{ name: string; accounts: string[] }>, accts: Acct[], sigs: Sig[]): Explanation {
  const parts: XNode[] = reps.map(r => { const x = repExposure(r.name, r.accounts, accts, sigs); return { id: `rep:${r.name}`, label: r.name, value: x.value, note: `${x.parts.length} accounts at risk`, children: x.parts } })
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const value = parts.reduce((t, p) => t + (p.value ?? 0), 0)
  return { metric: 'team_exposure', label: 'Team exposure', value, valueText: money(value), parts,
    definition: 'Each rep\u2019s exposure added together. An account appears under its owner once.' }
}
