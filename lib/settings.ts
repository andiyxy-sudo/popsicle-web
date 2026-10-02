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
  currency: string
  appearance: string
  industry: string
  engine: { sens: 'Balanced' | 'Early warning' | 'High confidence only'; types: Record<string, boolean> }
  easyRead?: boolean
  demo?: boolean     // the demo account ignores time-based settings so it always performs
}
type Meta = Record<string, unknown>

// The Concern Engine switches, and which detector types each one covers. Sentiment shift is off by
// default, as on the phone.
export const CE_DEFAULTS: Record<string, boolean> = {
  ce_exec: true, ce_price: true, ce_comp: true, ce_time: true, ce_legal: true,
  ce_champ: true, ce_usage: true, ce_sent: false, ce_expand: true,
}
export const CE_COVERS: Record<string, string[]> = {
  ce_exec: ['silent_stall', 'meeting_declined'],
  ce_price: ['price_flinch'],
  ce_comp: ['competitor_mention'],
  ce_time: ['timeline_slip', 'meeting_cancelled', 'deal_stage_backward'],
  ce_legal: ['legal_loopin'],
  ce_champ: ['champion_change'],
  ce_usage: [],
  ce_sent: ['call_sentiment_drop'],
  ce_expand: ['call_buying_signal', 'reengaged'],
}

/** Is this Concern type switched on? Types no switch covers are always on. */
export function typeEnabled(s: Settings, signalType: string | null | undefined): boolean {
  const t = String(signalType ?? '')
  for (const [key, covers] of Object.entries(CE_COVERS)) if (covers.includes(t)) return s.engine.types[key] !== false
  return true
}

/** Does this Concern clear the sensitivity bar? Critical ones always do. */
export function meetsSensitivity(s: Settings, sig: { severity?: string | null; ai_analysis?: unknown }): boolean {
  if (sig.severity === 'high') return true
  const conf = Number((sig.ai_analysis as { confidence?: number } | null)?.confidence ?? 100)
  if (s.engine.sens === 'Early warning') return true              // raise it, let the person judge
  if (s.engine.sens === 'High confidence only') return conf >= 90  // only the ones it is sure of
  return conf >= 70                                                // Balanced
}

/** Everything the engine should surface for this person: their switches and their sensitivity. */
export function passesEngine(s: Settings, sig: { signal_type?: string | null; severity?: string | null; ai_analysis?: unknown }): boolean {
  return typeEnabled(s, sig.signal_type) && meetsSensitivity(s, sig)
}

const num = (s: unknown, fallback: number) => { const m = /(\d+)/.exec(String(s ?? '')); return m ? Number(m[1]) : fallback }
const money = (s: unknown, fallback: number) => { const t = String(s ?? ''); if (/no minimum/i.test(t)) return 0; const n = num(t, NaN); return Number.isFinite(n) ? n * (/k/i.test(t) ? 1000 : /m/i.test(t) ? 1e6 : 1) : fallback }

export function readSettings(meta: Meta | null | undefined): Settings {
  const m = meta ?? {}
  const n = (m.notif_prefs ?? {}) as Record<string, boolean>
  const q = (m.quiet_hours ?? {}) as Record<string, string>
  const t = (m.thresholds ?? {}) as Record<string, string>
  const v = (m.draft_voice ?? {}) as Record<string, string>
  const p = (m.prefs ?? {}) as Record<string, string>
  const ce = (m.concern_engine ?? {}) as Record<string, unknown>
  return {
    notifs: { risk: n.risk ?? true, digest: n.digest ?? true, brief: n.brief ?? true, push: n.push ?? false },
    quiet: { from: q.From ?? '19:00', to: q.To ?? '08:00' },
    work: { start: String(m.work_start ?? '09:00'), end: String(m.work_end ?? '18:00') },
    morningDigest: String(m.morning_digest ?? '08:00'),
    thresholds: { daysDark: num(t['Days dark'], 5), minDeal: money(t['Minimum deal size'], 50000), graceDays: num(t['Commitment overdue'], 3) },
    voice: { tone: v.Tone ?? 'Direct', length: v.Length ?? 'Short', signOff: v['Sign-off'] ?? '' },
    language: p.Language ?? 'English (US)',
    currency: (p.Currency ?? 'USD').split(' ')[0],
    appearance: p.Appearance ?? '',
    industry: String(m.industry ?? ''),
    engine: {
      sens: (typeof ce.sens === 'string' ? ce.sens : 'Balanced') as Settings['engine']['sens'],
      types: { ...CE_DEFAULTS, ...Object.fromEntries(Object.entries(ce).filter(([k]) => k.startsWith('ce_'))) } as Record<string, boolean>,
    },
    easyRead: typeof m.easy_read === 'boolean' ? m.easy_read : undefined,
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
  if (/UK/.test(s.language)) return 'Use British English spelling and conventions (e.g. "prioritize", "color", dates as 22 September).'
  return 'Use American English spelling.'
}
export function voiceRule(s: Settings): string {
  const tone: Record<string, string> = { Direct: 'direct: short sentences, no preamble', Warm: 'warm and friendly, still concise', Formal: 'formal: full sentences, measured', 'Match the thread': 'matching how the other person writes in the thread' }
  const len: Record<string, string> = { Short: 'three or four sentences', Medium: 'one paragraph with a clear ask', Detailed: 'context, then the evidence, then the ask' }
  return `Write in a tone that is ${tone[s.voice.tone] ?? tone.Direct}. Length: ${len[s.voice.length] ?? len.Short}.${s.voice.signOff ? ` End with this sign-off, exactly: "${s.voice.signOff}".` : ''}`
}

/** Inside working hours (local time)? Outside them, only critical Concerns interrupt. */
export function inWorkingHours(s: Settings, at = new Date()): boolean {
  const now = at.getHours() * 60 + at.getMinutes(), a = mins(s.work.start), b = mins(s.work.end)
  if (a === b) return true
  return a < b ? now >= a && now < b : now >= a || now < b
}
