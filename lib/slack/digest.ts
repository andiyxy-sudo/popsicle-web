// The daily Slack briefing and per-deal updates, written from the same definitions as the portal.
import * as M from '@/lib/metrics'
import { changesBetween } from '@/lib/replay'

const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.popsicle-labs.app').replace(/\/$/, '')
const isOpen = (s: M.Sig) => !s.is_dismissed && (!s.status || s.status === 'open')
const SEV: Record<string, number> = { high: 0, watch: 1, positive: 2 }

/** Top 5 risks today, most serious first. */
export function buildDigest(accts: M.Acct[], sigs: M.Sig[], now: number, tz = 'UTC'): string {
  const open = sigs.filter(s => isOpen(s) && s.severity !== 'positive')
  const names = [...new Set(open.map(s => s.account_name || ''))].filter(Boolean)
  const ranked = names.map(n => {
    const mine = open.filter(s => s.account_name === n).sort((a, b) => (SEV[a.severity ?? ''] - SEV[b.severity ?? '']) || String(b.created_at).localeCompare(String(a.created_at)))
    // the lead signal: the most serious one, preferring one that carries the buyer's own words
    const top = mine[0]?.severity
    const lead = mine.find(s => s.severity === top && s.ai_analysis?.quote) ?? mine[0]
    return { n, lead, critical: mine.some(s => s.severity === 'high'), amt: Math.max(0, ...mine.map(s => Number(s.risk_amount || 0))), count: mine.length }
  }).sort((a, b) => Number(b.critical) - Number(a.critical) || b.amt - a.amt).slice(0, 5)
  const risk = M.atRisk(accts, sigs)
  const fresh = sigs.filter(s => s.created_at && now - new Date(s.created_at).getTime() <= 864e5).length
  const day = new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: tz })
  const lines = [
    `*Popsicle · Top ${ranked.length} risks, ${day}*`,
    `Revenue at risk *${risk.valueText}* across ${risk.parts.length} critical account${risk.parts.length === 1 ? '' : 's'} · ${fresh} new signal${fresh === 1 ? '' : 's'} in the last 24 hours`,
    '',
  ]
  ranked.forEach((r, i) => {
    const raw = (r.lead?.ai_analysis?.quote as string | undefined)?.replace(/^["“]|["”]$/g, '')
    const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
    const q = raw && !norm(r.lead?.title ?? '').includes(norm(raw)) ? raw : undefined   // never repeat the title
    lines.push(`*${i + 1}. ${r.n}* · ${M.money(r.amt)} · ${r.critical ? 'critical' : 'watch'}${r.count > 1 ? ` · ${r.count} open signals` : ''}`)
    if (r.lead) lines.push(`      ${r.lead.title}${q ? ` — _“${q}”_` : ''}`.replace(' — ', ': '))
    lines.push(`      <${SITE()}/accounts/${encodeURIComponent(r.n)}|Open ${r.n}>`)
  })
  if (!ranked.length) lines.push('Nothing at risk today. Every account is quiet or healthy.')
  lines.push('', `<${SITE()}/pulse|Open Popsicle> · <${SITE()}/review|Start a pipeline review>`)
  return lines.join('\n')
}

/** A deal channel's daily update: only when something changed on that deal in the last day. */
export function buildDealUpdate(account: string, accts: M.Acct[], sigs: M.Sig[], now: number): string | null {
  const c = changesBetween(accts, sigs.filter(s => s.account_name === account), now - 864e5, now)
  if (!c.events.length) return null
  const a = accts.find(x => x.name === account)
  const lines = [`*Popsicle · ${account}, last 24 hours*${a?.health_score != null ? ` · health ${a.health_score}` : ''}`]
  for (const e of c.events.slice(0, 6)) lines.push(`• ${e.kind === 'handled' ? `Acted on (${e.action ?? 'action'}): ` : e.severity === 'high' ? '*Critical:* ' : e.severity === 'positive' ? 'Good news: ' : ''}${e.title}`)
  if (c.events.length > 6) lines.push(`• and ${c.events.length - 6} more`)
  lines.push(`<${SITE()}/accounts/${encodeURIComponent(account)}|Open ${account} in Popsicle>`)
  return lines.join('\n')
}
