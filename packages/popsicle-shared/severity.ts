// Severities and response windows. The brief's rule: critical answers within 4 WORKING hours,
// watch within 3 WORKING days. Both apps phrase a window the same way, from signals.due_at.

export type Severity = 'high' | 'watch' | 'positive'

/** What a person reads. `high` is shown as "critical"; the database value never changes. */
export const SEVERITY_LABEL: Record<Severity, string> = { high: 'Critical', watch: 'Watch', positive: 'Positive' }

export const WORK_DAY = { startHour: 9, endHour: 18 } as const

/** Working hours between two moments, ignoring weekends and anything outside the working day. */
export function workingHoursBetween(from: Date, to: Date): number {
  if (to <= from) return 0
  let hours = 0
  const cur = new Date(from)
  while (cur < to) {
    const day = cur.getDay()
    const hour = cur.getHours() + cur.getMinutes() / 60
    const working = day !== 0 && day !== 6 && hour >= WORK_DAY.startHour && hour < WORK_DAY.endHour
    if (working) hours += Math.min(1 / 60, (to.getTime() - cur.getTime()) / 3600e3)
    cur.setMinutes(cur.getMinutes() + 1)
    if (hours > 400) break        // a guard: nothing sensible is further out than that
  }
  return hours
}

/** When a Concern raised now should be answered by, if the server did not say. */
export function deriveDueAt(severity: Severity, raisedAt: Date): Date | null {
  if (severity === 'positive') return null
  const target = severity === 'high' ? 4 : 3 * (WORK_DAY.endHour - WORK_DAY.startHour)  // 4 working hours, or 3 working days
  const d = new Date(raisedAt)
  let left = target
  while (left > 0) {
    d.setMinutes(d.getMinutes() + 15)
    const day = d.getDay(), hour = d.getHours() + d.getMinutes() / 60
    if (day !== 0 && day !== 6 && hour >= WORK_DAY.startHour && hour < WORK_DAY.endHour) left -= 0.25
  }
  return d
}

export type DueState = { text: string; tone: 'overdue' | 'soon' | 'ok'; minutes: number }

/**
 * How a response window reads: "Act within 3h", "Due in 42 min", "Overdue 2h".
 * `soon` is anything inside an hour, which is when the phrasing switches to minutes.
 */
export function dueLabel(dueAt: string | Date | null | undefined, now: Date = new Date()): DueState | null {
  if (!dueAt) return null
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt
  if (Number.isNaN(due.getTime())) return null
  const mins = Math.round((due.getTime() - now.getTime()) / 60000)

  if (mins < 0) {
    const over = Math.abs(mins)
    const text = over < 60 ? `Overdue ${over} min` : over < 60 * 24 ? `Overdue ${Math.round(over / 60)}h` : `Overdue ${Math.round(over / 1440)}d`
    return { text, tone: 'overdue', minutes: mins }
  }
  if (mins < 60) return { text: `Due in ${mins} min`, tone: 'soon', minutes: mins }
  if (mins < 60 * 8) return { text: `Act within ${Math.round(mins / 60)}h`, tone: 'soon', minutes: mins }
  const days = Math.round(mins / 1440)
  return { text: days <= 1 ? 'Act within a day' : `Act within ${days}d`, tone: 'ok', minutes: mins }
}
