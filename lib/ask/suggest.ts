// Questions worth asking about the page you're on, built from that page's live data.
// Templates filled with real names and numbers: instant, free, and never about something
// that isn't on screen. At least one yes/no question per page, so an answer can come back
// as a verdict.

type Acct = { name: string; value?: number | null; risk_level?: string | null; health_score?: number | null; owner?: string | null; last_contact_date?: string | null; stage?: string | null }
type Sig = { account_name?: string | null; title?: string | null; severity?: string | null; signal_type?: string | null; created_at?: string | null; status?: string | null; is_dismissed?: boolean | null; risk_amount?: number | null }
export type SuggestInput = {
  screen: string; account?: string
  accounts: Acct[]; signals: Sig[]
  forecast?: { commit: number } | null
  movers?: Array<{ name: string; swing: number }> | null
  reps?: Array<{ name: string; exposure?: number; avgResp?: number }> | null
  riskDeltaPct?: number | null
}

const money = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${v}`)
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
const QUIET = /silent|stall|dark|disengag|champion|ghost/i

export function suggest(d: SuggestInput): string[] {
  const open = d.signals.filter(s => !s.is_dismissed && (!s.status || s.status === 'open'))
  const byValue = [...d.accounts].sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
  const atRisk = byValue.filter(a => a.risk_level === 'high')
  const worst = [...d.accounts].filter(a => a.health_score != null).sort((a, b) => Number(a.health_score) - Number(b.health_score))[0]
  const latestHigh = [...open].filter(s => s.severity === 'high').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
  const top = atRisk[0] ?? byValue[0]
  const pick = (...qs: Array<string | false | undefined | null>) => qs.filter((q): q is string => !!q).slice(0, 3)

  switch (d.screen) {
    case 'account': {
      const a = d.accounts.find(x => x.name === d.account)
      const name = d.account ?? 'this account'
      const who = a?.owner || undefined
      const sigs = open.filter(s => s.account_name === d.account)
      const quiet = sigs.find(s => QUIET.test(`${s.signal_type} ${s.title}`))
      const newest = [...sigs].sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))[0]
      return pick(
        `Is ${name} going to close this quarter?`,
        quiet && who ? `Why did ${who} go quiet?` : newest?.title ? `What does "${lower(newest.title)}" mean for ${name}?` : `What changed on ${name} this week?`,
        `What should I send ${who ?? name} today?`,
      )
    }
    case 'pulse':
      return pick(
        top && `Is ${top.name} going to close this quarter?`,
        atRisk.length > 1 ? `Which of today's ${atRisk.length} at-risk deals should I call first?` : 'Which deal needs me first today?',
        'What changed overnight that needs me today?',
      )
    case 'portfolio':
      return pick(
        worst && `Why is ${worst.name} at the top of the list?`,
        'Is any healthy account quietly slipping?',
        'Who owns the most exposure right now?',
      )
    case 'signals':
      return pick(
        latestHigh?.account_name && latestHigh.title ? `Is the "${lower(latestHigh.title)}" signal on ${latestHigh.account_name} real?` : 'Which of these signals is most likely real?',
        'Which of these signals can wait until next week?',
        latestHigh?.account_name ? `What should I send ${latestHigh.account_name} today?` : 'What should I act on first, and why?',
      )
    case 'forecast': {
      const commit = d.forecast?.commit ?? d.accounts.filter(a => /negotiation|closing|commit/i.test(a.stage || '')).reduce((s, a) => s + Number(a.value || 0), 0)
      const slipper = [...(d.movers ?? [])].sort((a, b) => a.swing - b.swing)[0]?.name ?? atRisk[0]?.name
      return pick(
        commit > 0 ? `Is the ${money(commit)} commit real?` : 'Is this quarter\'s commit real?',
        'Which single deal would move the number most?',
        slipper && `Will ${slipper} slip out of this quarter?`,
      )
    }
    case 'intelligence':
      return pick(
        d.riskDeltaPct ? `Why is new risk up ${d.riskDeltaPct}%?` : 'What is driving new risk this month?',
        'Which action is working best, and who isn\'t using it?',
        'Are we getting faster at acting on signals?',
      )
    case 'team': {
      const slow = [...(d.reps ?? [])].filter(r => r.avgResp != null).sort((a, b) => Number(b.avgResp) - Number(a.avgResp))[0]
      return pick(
        'Who on the team needs help this week?',
        slow ? `Why is ${slow.name}'s response time ${slow.avgResp} hours?` : 'Who is slowest to act on signals, and why?',
        'Is any critical account covered by only one person?',
      )
    }
    case 'integrations': {
      // which connected source is doing the talking, from the signals themselves
      const NAME: Record<string, string> = { gmail: 'Gmail', outlook: 'Outlook', slack: 'Slack', zoom: 'Zoom', whatsapp: 'WhatsApp', hubspot: 'HubSpot', gcal: 'Calendar', fireflies: 'Fireflies' }
      const bySrc = new Map<string, number>()
      for (const s of open) { const k = (s as { source_integration?: string | null }).source_integration; if (k) bySrc.set(k, (bySrc.get(k) ?? 0) + 1) }
      const topSrc = [...bySrc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      return pick(
        topSrc ? `Why is ${NAME[topSrc] ?? topSrc} raising the most signals?` : 'Which source is raising the most signals?',
        'Which source would catch more risk if I connected it next?',
        'Are any deals going quiet in a channel Popsicle can\u2019t see?',
      )
    }
    case 'settings':
      return pick(
        'What will Popsicle interrupt me for?',
        'What does my role show me first on Pulse?',
        'Which alerts should I turn off to cut the noise?',
      )
    default:
      return pick(
        top && `Is ${top.name} going to close this quarter?`,
        'What needs me today?',
        'What changed since yesterday?',
      )
  }
}
