// Intelligence figures, each with one definition, computed for the selected window (30/60/90
// days) from the replayed data. Same values on screen and in their explanations.
import * as M from './metrics'
import { asOf } from './replay'

const THEME: Record<string, string> = {
  silent_stall: 'executive disengagement', champion_change: 'executive disengagement', meeting_cancelled: 'executive disengagement',
  price_flinch: 'pricing pressure', competitor_mention: 'competitive pressure', timeline_slip: 'timeline slippage',
  deal_stage_backward: 'timeline slippage', legal_loopin: 'legal and security review', commitment_overdue: 'missed follow-through',
  invoice_delay: 'billing friction',
}
const isRisk = (s: M.Sig) => !s.is_dismissed && (s.severity === 'high' || s.severity === 'watch')
const inWin = (iso: string | null | undefined, from: number, to: number) => !!iso && new Date(iso).getTime() > from && new Date(iso).getTime() <= to
const acctHref = (n: string) => `/accounts/${encodeURIComponent(n)}`

/** Change in revenue at risk over the window, and what drove it. */
export function riskChange(accts: M.Acct[], sigs: M.Sig[], now: number, days: number): M.Explanation & { driver: string | null } {
  const from = now - days * 864e5
  const before = M.atRisk(accts, asOf(sigs, from)), after = M.atRisk(accts, asOf(sigs, now))
  const pct = before.value > 0 ? Math.round((after.value - before.value) / before.value * 100) : (after.value > 0 ? 100 : 0)
  const was = new Map(before.parts.map(p => [p.label, p.value ?? 0]))
  const parts: M.XNode[] = [...new Set([...before.parts, ...after.parts].map(p => p.label))].map(n => {
    const a = was.get(n) ?? 0, b = after.parts.find(p => p.label === n)?.value ?? 0
    return { id: `acct:${n}`, label: n, value: Math.abs(b - a), valueText: `${b - a >= 0 ? '+' : '\u2212'}${M.money(Math.abs(b - a))}`, note: a === 0 ? 'turned critical in this window' : b === 0 ? 'no longer critical' : 'unchanged', href: acctHref(n) }
  }).filter(p => p.valueText !== '+$0').sort((x, y) => (y.value ?? 0) - (x.value ?? 0))
  const fresh = sigs.filter(s => isRisk(s) && inWin(s.created_at, from, now))
  const counts = new Map<string, number>(); for (const s of fresh) { const t = THEME[s.signal_type ?? ''] ?? 'other signals'; counts.set(t, (counts.get(t) ?? 0) + 1) }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  const driver = top && top[0] !== 'other signals' ? top[0] : null
  parts.push({ id: 'drivers', label: 'New risk signals by theme', valueText: String(fresh.length),
    children: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ id: `t:${k}`, label: k, valueText: String(v) })) })
  return { metric: 'risk_change', label: `Revenue at risk, last ${days} days`, value: pct, valueText: `${pct >= 0 ? '+' : ''}${pct}%`, parts, driver,
    definition: `Revenue at risk today (${after.valueText}) compared with ${days} days ago (${before.valueText}), replayed from when each signal arrived. The driver is the most common theme among the ${fresh.length} risk signals raised in that time.` }
}

/** Interventions holding: actions taken in the window where the account has not turned critical since. */
export function holding(accts: M.Acct[], sigs: M.Sig[], now: number, days: number): M.Explanation {
  const from = now - days * 864e5
  const acted = sigs.filter(s => s.status === 'handled' && inWin(s.handled_at, from, now))
  const parts: M.XNode[] = acted.map(s => {
    const after = sigs.find(x => x.account_name === s.account_name && x.severity === 'high' && x.created_at && s.handled_at && x.created_at > s.handled_at)
    return { id: s.id, label: `${s.account_name}: ${s.handled_action ?? 'action'}`, valueText: after ? 'slipped' : 'holding',
      note: after ? `critical again: ${after.title}` : s.title ?? undefined, href: `/signals?signal=${s.id}` }
  }).sort((a, b) => (a.valueText === 'slipped' ? -1 : 1) - (b.valueText === 'slipped' ? -1 : 1))
  const held = parts.filter(p => p.valueText === 'holding').length
  const value = acted.length ? Math.round(held / acted.length * 100) : 0
  return { metric: 'holding', label: `Interventions holding, last ${days} days`, value, valueText: acted.length ? `${value}%` : 'collecting', parts, n: acted.length, interval: M.wilson(held, acted.length), collecting: acted.length < 5,
    definition: `Of the ${acted.length} actions taken in the last ${days} days, the share where the account has not raised a new critical signal since. ${held} are holding.` }
}

/** Time to action: median hours from signal to action, this window against the one before. */
export function speed(accts: M.Acct[], sigs: M.Sig[], now: number, days: number): M.Explanation {
  const med = (xs: number[]) => { if (!xs.length) return null; const a = [...xs].sort((p, q) => p - q), m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2 }
  const win = (from: number, to: number) => sigs.filter(s => s.status === 'handled' && inWin(s.handled_at, from, to) && s.created_at)
  const cur = win(now - days * 864e5, now), prev = win(now - 2 * days * 864e5, now - days * 864e5)
  const hrs = (s: M.Sig) => (new Date(s.handled_at!).getTime() - new Date(s.created_at!).getTime()) / 3600e3
  const mc = med(cur.map(hrs)), mp = med(prev.map(hrs))
  const faster = mc != null && mp != null ? Math.round((mp - mc) / 24 * 10) / 10 : 0
  const parts: M.XNode[] = [
    { id: 'cur', label: `Last ${days} days`, valueText: mc != null ? `${Math.round(mc / 24 * 10) / 10} days` : 'no actions', note: `median of ${cur.length} actions`,
      children: cur.slice(0, 8).map(s => ({ id: s.id, label: `${s.account_name}: ${s.title}`, valueText: `${Math.round(hrs(s))}h`, href: `/signals?signal=${s.id}` })) },
    { id: 'prev', label: `The ${days} days before`, valueText: mp != null ? `${Math.round(mp / 24 * 10) / 10} days` : 'no actions', note: `median of ${prev.length} actions`,
      children: prev.slice(0, 8).map(s => ({ id: s.id, label: `${s.account_name}: ${s.title}`, valueText: `${Math.round(hrs(s))}h`, href: `/signals?signal=${s.id}` })) },
  ]
  return { metric: 'speed', label: 'Time from signal to action', value: faster, valueText: faster > 0 ? `${faster} days faster` : faster < 0 ? `${Math.abs(faster)} days slower` : 'no change', parts,
    definition: 'The median time between a signal arriving and someone acting on it, in this window compared with the window before.' }
}

/** Saves (recovered deals) and signals caught early, within the window. */
export function windowed(accts: M.Acct[], sigs: M.Sig[], now: number, days: number) {
  const from = now - days * 864e5
  const inW = sigs.filter(s => inWin(s.created_at, from, now) || inWin(s.handled_at, from, now))
  return { caught: M.caughtEarly(accts, inW.filter(s => inWin(s.created_at, from, now))), saves: M.protectedRevenue(accts, inW.filter(s => s.status !== 'handled' || inWin(s.handled_at, from, now))) }
}
