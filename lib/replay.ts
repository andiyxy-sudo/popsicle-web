// Replay: the data as it stood at any moment. Signals carry created_at and handled_at, so the
// past is reconstructed exactly (a signal exists from its creation; it counts as acted on from
// its handled time). "What changed" and the timeline are both computed from this, with the same
// metric functions as the live screens, so history can never disagree with today.
import * as M from './metrics'

export function asOf(sigs: M.Sig[], t: number): M.Sig[] {
  return sigs.filter(s => s.created_at && new Date(s.created_at).getTime() <= t).map(s => {
    const handled = s.status === 'handled' && s.handled_at && new Date(s.handled_at).getTime() <= t
    return handled ? s : { ...s, status: 'open', handled_at: null, handled_action: null }
  })
}

export type Snapshot = { t: number; atRisk: number; active: number; protectedValue: number; critical: number }
export function snapshot(accts: M.Acct[], sigs: M.Sig[], t: number): Snapshot {
  const s = asOf(sigs, t)
  const open = s.filter(x => !x.is_dismissed && (!x.status || x.status === 'open'))
  return { t, atRisk: M.atRisk(accts, s).value, active: open.length, protectedValue: M.protectedRevenue(accts, s).value, critical: open.filter(x => x.severity === 'high').length }
}

export type ChangeEvent = { t: string; kind: 'new' | 'handled'; severity: string; account: string; title: string; id: string; amount?: number; action?: string }
export type Changes = { since: number; now: number; before: Snapshot; after: Snapshot; events: ChangeEvent[]; lines: string[] }

export function changesBetween(accts: M.Acct[], sigs: M.Sig[], since: number, now: number): Changes {
  const before = snapshot(accts, sigs, since), after = snapshot(accts, sigs, now)
  const events: ChangeEvent[] = []
  for (const s of sigs) {
    const c = s.created_at ? new Date(s.created_at).getTime() : 0
    if (c > since && c <= now) events.push({ t: s.created_at!, kind: 'new', severity: s.severity ?? 'watch', account: s.account_name ?? '', title: s.title ?? 'Signal', id: s.id, amount: Number(s.risk_amount || 0) || undefined })
    const h = s.status === 'handled' && s.handled_at ? new Date(s.handled_at).getTime() : 0
    if (h > since && h <= now) events.push({ t: s.handled_at!, kind: 'handled', severity: s.severity ?? 'watch', account: s.account_name ?? '', title: s.title ?? 'Signal', id: s.id, amount: Number(s.risk_amount || 0) || undefined, action: s.handled_action ?? undefined })
  }
  events.sort((a, b) => b.t.localeCompare(a.t))

  // the headline sentence parts, most important first
  const lines: string[] = []
  const wasCritical = new Set(M.atRisk(accts, asOf(sigs, since)).parts.map(p => p.label))
  for (const p of M.atRisk(accts, asOf(sigs, now)).parts) if (!wasCritical.has(p.label)) lines.push(`${p.label} turned critical (${M.money(p.value ?? 0)})`)
  const d = after.atRisk - before.atRisk
  if (d !== 0) lines.push(`${d > 0 ? '+' : '\u2212'}${M.money(Math.abs(d))} at risk`)
  const fresh = events.filter(e => e.kind === 'new'), crit = fresh.filter(e => e.severity === 'high').length
  if (fresh.length) lines.push(`${fresh.length} new signal${fresh.length === 1 ? '' : 's'}${crit ? `, ${crit} critical` : ''}`)
  const acted = events.filter(e => e.kind === 'handled')
  if (acted.length) lines.push(`${acted.length} acted on`)
  const pd = after.protectedValue - before.protectedValue
  if (pd > 0) lines.push(`${M.money(pd)} protected`)
  return { since, now, before, after, events, lines }
}

export function timeline(accts: M.Acct[], sigs: M.Sig[], now: number, days = 56): Array<Snapshot & { events: ChangeEvent[] }> {
  // Each day's events are bucketed in ONE pass over the signals (previously every day rescanned them all),
  // so a year of a large account stays fast.
  const start = now - days * 864e5
  const buckets: ChangeEvent[][] = Array.from({ length: days + 1 }, () => [])
  const dayOf = (t: number) => Math.ceil((t - start) / 864e5)   // the snapshot at the end of that day
  for (const s of sigs) {
    const c = s.created_at ? new Date(s.created_at).getTime() : NaN
    if (c > start - 864e5 && c <= now) { const i = Math.max(0, dayOf(c)); if (i <= days) buckets[i].push({ t: s.created_at!, kind: 'new', severity: s.severity ?? 'watch', account: s.account_name ?? '', title: s.title ?? 'Signal', id: s.id, amount: Number(s.risk_amount || 0) || undefined }) }
    const h = s.status === 'handled' && s.handled_at ? new Date(s.handled_at).getTime() : NaN
    if (h > start - 864e5 && h <= now) { const i = Math.max(0, dayOf(h)); if (i <= days) buckets[i].push({ t: s.handled_at!, kind: 'handled', severity: s.severity ?? 'watch', account: s.account_name ?? '', title: s.title ?? 'Signal', id: s.id, amount: Number(s.risk_amount || 0) || undefined, action: s.handled_action ?? undefined }) }
  }
  // Lean daily snapshots: the same figures as snapshot() (open = created by then and not yet acted on;
  // at risk = the largest open non-positive amount per account that has an open critical signal, summed;
  // protected = acted-on high/watch saves with an amount, on accounts not at high risk), computed in one
  // pass per day over pre-parsed numbers, with no copying of signals.
  const n = sigs.length
  const acctIx = new Map<string, number>(); const acctOf = new Int32Array(n)
  const created = new Float64Array(n), handled = new Float64Array(n), amount = new Float64Array(n), sev = new Uint8Array(n), dismissed = new Uint8Array(n), savable = new Uint8Array(n)
  const highRiskAcct = new Set(accts.filter(a => a.risk_level === 'high').map(a => a.name))
  for (let k = 0; k < n; k++) {
    const s = sigs[k], name = s.account_name ?? ''
    let ix = acctIx.get(name); if (ix === undefined) { ix = acctIx.size; acctIx.set(name, ix) }
    acctOf[k] = ix
    created[k] = s.created_at ? new Date(s.created_at).getTime() : Infinity
    handled[k] = s.status === 'handled' && s.handled_at ? new Date(s.handled_at).getTime() : Infinity
    amount[k] = Number(s.risk_amount || 0)
    sev[k] = s.severity === 'high' ? 2 : s.severity === 'watch' ? 1 : s.severity === 'positive' ? 3 : 0
    dismissed[k] = s.is_dismissed ? 1 : 0
    savable[k] = amount[k] > 0 && (sev[k] === 2 || sev[k] === 1) && !highRiskAcct.has(name) ? 1 : 0   // counts toward protected once acted on
  }
  const A = acctIx.size, maxAmt = new Float64Array(A), hasCrit = new Uint8Array(A)
  const out: Array<Snapshot & { events: ChangeEvent[] }> = []
  for (let i = 0; i <= days; i++) {
    const t = start + i * 864e5
    maxAmt.fill(0); hasCrit.fill(0)
    let active = 0, critical = 0, prot = 0
    for (let k = 0; k < n; k++) {
      if (created[k] > t) continue
      if (handled[k] <= t) { if (savable[k]) prot += amount[k]; continue }   // acted on by then
      if (dismissed[k]) continue
      active++
      const ix = acctOf[k]
      if (sev[k] === 2) { critical++; hasCrit[ix] = 1 }
      if (sev[k] !== 3 && amount[k] > maxAmt[ix]) maxAmt[ix] = amount[k]
    }
    let risk = 0
    for (const [name, ix] of acctIx) if (name && hasCrit[ix]) risk += maxAmt[ix]
    out.push({ t, atRisk: risk, active, protectedValue: prot, critical, events: buckets[i].sort((a, b) => b.t.localeCompare(a.t)).slice(0, 8) })
  }
  return out
}
