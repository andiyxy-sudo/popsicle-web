// Your settings, read one way everywhere. Settings are saved on your account (Supabase user metadata)
// by the Settings page; this turns them into values the rest of the app can act on.
export type Settings = {
  notifs: { risk: boolean; digest: boolean; brief: boolean; push: boolean }
  quiet: { from: string; to: string }
  work: { start: string; end: string }
  morningDigest: string
  thresholds: { daysDark: number; minDeal: number; graceDays: number }
  voice: { tone: string; length: string; signOff: string }
  language: string
  demo?: boolean     // the demo account ignores time-based settings so it always performs
}
type Meta = Record<string, unknown>

const num = (s: unknown, fallback: number) => { const m = /(\d+)/.exec(String(s ?? '')); return m ? Number(m[1]) : fallback }
const money = (s: unknown, fallback: number) => { const t = String(s ?? ''); if (/no minimum/i.test(t)) return 0; const n = num(t, NaN); return Number.isFinite(n) ? n * (/k/i.test(t) ? 1000 : /m/i.test(t) ? 1e6 : 1) : fallback }

export function readSettings(meta: Meta | null | undefined): Settings {
  const m = meta ?? {}
  const n = (m.notif_prefs ?? {}) as Record<string, boolean>
  const q = (m.quiet_hours ?? {}) as Record<string, string>
  const t = (m.thresholds ?? {}) as Record<string, string>
  const v = (m.draft_voice ?? {}) as Record<string, string>
  const p = (m.prefs ?? {}) as Record<string, string>
  return {
    notifs: { risk: n.risk ?? true, digest: n.digest ?? true, brief: n.brief ?? true, push: n.push ?? false },
    quiet: { from: q.From ?? '19:00', to: q.To ?? '08:00' },
    work: { start: String(m.work_start ?? '09:00'), end: String(m.work_end ?? '18:00') },
    morningDigest: String(m.morning_digest ?? '08:00'),
    thresholds: { daysDark: num(t['Days dark'], 5), minDeal: money(t['Minimum deal size'], 50000), graceDays: num(t['Commitment overdue'], 3) },
    voice: { tone: v.Tone ?? 'Direct', length: v.Length ?? 'Short', signOff: v['Sign-off'] ?? '' },
    language: p.Language ?? 'English (US)',
  }
}

const mins = (hhmm: string) => { const [h, mm] = hhmm.split(':').map(Number); return (h || 0) * 60 + (mm || 0) }
/** Inside quiet hours (handles windows that cross midnight, e.g. 19:00 to 08:00). */
export function inQuietHours(s: Settings, at = new Date()): boolean {
  const now = at.getHours() * 60 + at.getMinutes(), a = mins(s.quiet.from), b = mins(s.quiet.to)
  if (a === b) return false
  return a < b ? now >= a && now < b : now >= a || now < b
}
/** Has today's morning-digest time passed (local time)? */
export function pastMorningDigest(s: Settings, at = new Date()): boolean { return at.getHours() * 60 + at.getMinutes() >= mins(s.morningDigest) }

/** How the AI should write: instructions from your language and drafting voice. */
export function languageRule(s: Settings): string {
  if (/bahasa/i.test(s.language)) return 'Respond in Bahasa Indonesia (keep company names, product names and figures as they are).'
  if (/UK/.test(s.language)) return 'Use British English spelling and conventions (e.g. "prioritise", "colour", dates as 22 September).'
  return 'Use American English spelling.'
}
export function voiceRule(s: Settings): string {
  const tone: Record<string, string> = { Direct: 'direct: short sentences, no preamble', Warm: 'warm and friendly, still concise', Formal: 'formal: full sentences, measured', 'Match the thread': 'matching how the other person writes in the thread' }
  const len: Record<string, string> = { Short: 'three or four sentences', Medium: 'one paragraph with a clear ask', Detailed: 'context, then the evidence, then the ask' }
  return `Write in a tone that is ${tone[s.voice.tone] ?? tone.Direct}. Length: ${len[s.voice.length] ?? len.Short}.${s.voice.signOff ? ` End with this sign-off, exactly: "${s.voice.signOff}".` : ''}`
}

/** Inside working hours (local time)? Outside them, only critical signals interrupt. */
export function inWorkingHours(s: Settings, at = new Date()): boolean {
  const now = at.getHours() * 60 + at.getMinutes(), a = mins(s.work.start), b = mins(s.work.end)
  if (a === b) return true
  return a < b ? now >= a && now < b : now >= a || now < b
}
