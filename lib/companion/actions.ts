// The Popsicle companion: the things it can do for you from chat, instead of making you find the screen.
// Every action is explicit and small. Anything with a side effect (an invite, a decision, sending) asks first.
export type ActionId =
  | 'connect_source' | 'slack_channels' | 'slack_briefing'
  | 'set_role' | 'set_quiet_hours' | 'set_working_hours' | 'set_morning_time'
  | 'set_threshold' | 'toggle_alert' | 'set_theme' | 'set_easy_read' | 'set_currency' | 'set_industry'
  | 'set_send_mode' | 'invite_teammate' | 'record_decision' | 'goto' | 'start_review' | 'export_data'
  | 'draft_reply' | 'send_draft'

export type Action = { id: ActionId; params: Record<string, string | boolean | number>; say: string; confirm?: string }

export const PAGES: Record<string, string> = {
  pulse: '/pulse', portfolio: '/portfolio', signals: '/signals', forecast: '/forecast', review: '/review',
  intelligence: '/intelligence', team: '/team', integrations: '/integrations', settings: '/settings', ask: '/ask',
}
const SOURCES = ['gmail', 'slack', 'zoom', 'outlook', 'hubspot', 'fireflies', 'gcal', 'whatsapp', 'google calendar', 'google meet']
const ROLE_TITLES: Record<string, string> = { rep: 'Account Executive', ae: 'Account Executive', manager: 'Sales Manager',
  lead: 'Sales Manager', leader: 'VP of Sales', vp: 'VP of Sales', cro: 'VP of Sales', finance: 'Finance', cfo: 'Finance' }

const plural = (n: string | number, w: string) => `${n} ${w}${Number(n) === 1 ? '' : 's'}`
const time = (t: string) => { const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(t); if (!m) return null
  let h = Number(m[1]); const min = m[2] ?? '00'; const ap = m[3]?.toLowerCase()
  if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${min}` }
const money = (t: string) => { const m = /\$?\s*([\d.]+)\s*([km])?/i.exec(t); if (!m) return null
  const n = parseFloat(m[1]); const u = (m[2] ?? '').toLowerCase()
  const v = n * (u === 'm' ? 1e6 : u === 'k' ? 1e3 : n < 1000 ? 1e3 : 1)
  return v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : `$${Math.round(v / 1e3)}K` }

/** Read a plain sentence as an action. Returns null when it is an ordinary question. */
export function readIntent(raw: string): Action | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null

  // connect a source
  if (/\b(connect|hook up|link|set up|add)\b/.test(t)) {
    const src = SOURCES.find(s => t.includes(s))
    if (src) {
      const key = src.startsWith('google cal') ? 'gcal' : src.startsWith('google meet') ? 'gcal' : src
      return { id: 'connect_source', params: { provider: key }, say: `Opening the ${label(key)} connection. You approve it on ${label(key)}'s own screen; I can't click that part for you.` }
    }
  }
  // slack channels and the daily briefing
  if (/slack/.test(t) && /(channel|which channels|read which)/.test(t)) return { id: 'slack_channels', params: {}, say: 'Here are your Slack channels: tick the ones Popsicle should read.' }
  if (/(daily )?brief/.test(t) && /(slack|set|time|change|turn)/.test(t)) return { id: 'slack_briefing', params: {}, say: 'Opening the daily briefing settings: channel and time.' }

  // who you are
  if (/\b(i am|i'm|im|set my role|my role is|make me)\b/.test(t)) {
    const key = Object.keys(ROLE_TITLES).find(k => new RegExp(`\\b${k}\\b`).test(t))
    if (key) return { id: 'set_role', params: { title: ROLE_TITLES[key] }, say: `Setting your title to ${ROLE_TITLES[key]}, so Pulse opens on what matters to you.` }
  }
  if (/industry|we sell (to|in)|our market/.test(t)) {
    const m = /(?:industry (?:is|to)|we sell (?:to|in)|our market is)\s+([a-z0-9 &-]{3,40})/i.exec(raw)
    if (m) return { id: 'set_industry', params: { industry: m[1].trim() }, say: `Noting your industry as ${m[1].trim()}.` }
  }

  // quiet hours, working hours, the morning brief
  if (/quiet hours|don'?t (ping|disturb|notify)|no alerts (at night|after)/.test(t)) {
    const hits = raw.match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi) ?? []
    const from = hits[0] ? time(hits[0]) : '19:00', to = hits[1] ? time(hits[1]) : '08:00'
    return { id: 'set_quiet_hours', params: { from: from ?? '19:00', to: to ?? '08:00' }, say: `Quiet hours set to ${from} – ${to}. Only critical signals get through.` }
  }
  if (/working hours|i work from|office hours/.test(t)) {
    const hits = raw.match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi) ?? []
    const start = hits[0] ? time(hits[0]) : '09:00', end = hits[1] ? time(hits[1]) : '18:00'
    return { id: 'set_working_hours', params: { start: start ?? '09:00', end: end ?? '18:00' }, say: `Working hours set to ${start} – ${end}.` }
  }
  if (/morning brief|brief.*(at|time)|wake/.test(t) && /\d/.test(t)) {
    const at = time((raw.match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i) ?? [''])[0])
    if (at) return { id: 'set_morning_time', params: { at }, say: `Your morning brief will appear at ${at}.` }
  }

  // thresholds
  if (/(only|deals?) (over|above|bigger than)|minimum deal|ignore deals under|under \$/.test(t)) {
    const v = money(raw); if (v) return { id: 'set_threshold', params: { key: 'Minimum deal size', value: v }, say: `Small deals stay quiet: only deals over ${v} raise non-critical alerts.` }
  }
  if (/dark after|(gone? dark|silent|quiet) (after|for)\s*\d|days? dark/.test(t)) {
    const d = (raw.match(/(\d+)\s*days?/i) ?? [])[1]
    if (d) return { id: 'set_threshold', params: { key: 'Days dark', value: plural(d, 'day') }, say: `A buyer now counts as gone dark after ${plural(d, 'day')} of silence.` }
  }
  if (/grace|overdue after/.test(t)) {
    const d = (raw.match(/(\d+)\s*days?/i) ?? [])[1]
    if (d) return { id: 'set_threshold', params: { key: 'Commitment overdue', value: plural(d, 'day') }, say: `A promise counts as late ${plural(d, 'day')} after its date.` }
  }

  // alerts
  if (/(turn|switch)\s*(off|on)\b|stop (sending|alerting)|mute|enable|disable/.test(t)) {
    const on = /\b(on|enable)\b/.test(t) && !/\boff\b/.test(t)
    const key = /risk|signal/.test(t) ? 'risk' : /weekly|summary/.test(t) ? 'digest' : /pre-?meeting|brief/.test(t) ? 'brief' : /push|browser/.test(t) ? 'push' : null
    if (key) return { id: 'toggle_alert', params: { key, on }, say: `${on ? 'Turning on' : 'Turning off'} ${({ risk: 'risk alerts', digest: 'the weekly summary', brief: 'pre-meeting briefs', push: 'push notifications' })[key]}.` }
  }

  // look and feel
  if (/dark mode|light mode|theme/.test(t)) {
    const mode = /system|auto/.test(t) ? 'Match system' : /light/.test(t) ? 'Light' : 'Dark'
    return { id: 'set_theme', params: { mode }, say: `Switching to ${mode.toLowerCase()}.` }
  }
  if (/easy read|bigger text|larger text|text too small/.test(t)) {
    const on = !/\b(off|smaller|normal)\b/.test(t)
    return { id: 'set_easy_read', params: { on }, say: on ? 'Easy read on: small text is 20% larger.' : 'Easy read off.' }
  }
  if (/currency|show (me )?(in )?(usd|eur|gbp|sgd|idr|jpy|aud|cad|chf|inr|krw|myr|hkd|aed|cny)/.test(t)) {
    const m = /(usd|eur|gbp|sgd|idr|jpy|aud|cad|chf|inr|krw|myr|hkd|aed|cny)/i.exec(t)
    if (m) return { id: 'set_currency', params: { code: m[1].toUpperCase() }, say: `Showing every amount in ${m[1].toUpperCase()}. The page reloads once.` }
  }

  // sending policy
  if (/send (without|on its own|automatically)|auto[- ]?send/.test(t)) return { id: 'set_send_mode', params: { mode: 'without' }, say: 'Opening the sending policy so you can set the limits before it sends anything.', confirm: 'Let Popsicle send its own drafts, within limits?' }
  if (/send with me|approve every|nothing without me/.test(t)) return { id: 'set_send_mode', params: { mode: 'with' }, say: 'Every draft will wait for you.' }

  // drafting and sending
  if ((/\b(draft|write|compose)\b/.test(t) && /(reply|email|follow[- ]?up|message|note)/.test(t))
    || /\bsend (an? )?(email|note|message|follow[- ]?up)\b/.test(t)) {
    const m = /(?:to|for|up to|at)\s+([A-Z][\w.&-]*(?: [A-Z][\w.&-]*){0,2})/.exec(raw)
    const about = /\babout\s+(.{3,80})$/i.exec(raw.trim())
    const andSend = /and send|then send|^send/i.test(t)
    const acct = m ? m[1].trim() : ''
    return { id: 'draft_reply', params: { account: acct, send: andSend, intent: about ? about[1].trim() : '' },
      say: acct ? `Drafting${about ? ` a note about ${about[1].trim()}` : ' a reply'} for ${acct}, grounded in their latest signal${andSend ? '. You will see it before anything is sent' : ''}.` : 'Which account should I draft for?' }
  }
  if (/^(send it|send that|send the draft|go ahead and send)\b/.test(t)) return { id: 'send_draft', params: {}, say: 'Sending it from your Gmail.', confirm: 'Send this message from your Gmail?' }

  // people and work
  const email = (raw.match(/[\w.+-]+@[\w-]+\.[\w.]+/) ?? [])[0]
  if (email && /invite|add .*(to the team|teammate)/.test(t)) return { id: 'invite_teammate', params: { email }, say: `Inviting ${email}.`, confirm: `Send an invitation to ${email}?` }
  if (/start (the )?review|run (the )?review|pipeline review/.test(t)) return { id: 'start_review', params: {}, say: 'Starting your pipeline review.' }
  if (/export|download my data/.test(t)) return { id: 'export_data', params: {}, say: 'Exporting everything as JSON.' }
  if (/^(open|go to|show me|take me to)\b/.test(t)) {
    const page = Object.keys(PAGES).find(p => t.includes(p))
    if (page) return { id: 'goto', params: { path: PAGES[page] }, say: `Opening ${page}.` }
  }
  return null
}

export function label(key: string) {
  return ({ gmail: 'Gmail', slack: 'Slack', zoom: 'Zoom', outlook: 'Outlook', hubspot: 'HubSpot', fireflies: 'Fireflies', gcal: 'Google Calendar', whatsapp: 'WhatsApp' } as Record<string, string>)[key] ?? key
}
