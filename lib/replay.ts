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
  const out: Array<Snapshot & { events: ChangeEvent[] }> = []
  for (let i = days; i >= 0; i--) {
    const t = now - i * 864e5
    const snap = snapshot(accts, sigs, t)
    out.push({ ...snap, events: changesBetween(accts, sigs, t - 864e5, t).events.slice(0, 8) })
  }
  return out
}
