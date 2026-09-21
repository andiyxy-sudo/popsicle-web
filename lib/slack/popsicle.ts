// @popsicle in Slack: answer a mention in a deal channel, in the thread, for everyone.
// Server-only. Uses the service role (there is no user session on a Slack event), scoped
// by hand to the organisation that owns the Slack workspace. Reads what the existing
// pipeline already produced; detects nothing.
import { createClient as createAdmin } from '@supabase/supabase-js'
import { wantsVerdict, VERDICT_RULES } from '@/lib/ask/verdict'

type Row = Record<string, unknown>
const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.popsicle-labs.app').replace(/\/$/, '')
const money = (v?: unknown) => { const n = Number(v || 0); return n >= 1e6 ? `$${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${n}` }
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// v11.109: every Slack key that could answer in this channel, tested with Slack before use.
// A channel can be tracked by several Popsicle users (and a workspace connected more than once),
// and some of those keys may be old or revoked. We ask Slack which ones still work (auth.test),
// prefer a bot key, and use that.
type Candidate = { token: string; ownerId: string; channelName: string; linkedAccountId: string | null; source: string }

function tokensIn(row: Row): Array<{ token: string; kind: string }> {
  const m = (row.metadata ?? {}) as Row
  const bot = (m.bot ?? {}) as Row
  return [
    { token: row.access_token, kind: 'access_token' }, { token: row.bot_token, kind: 'bot_token' },
    { token: m.bot_token, kind: 'metadata.bot_token' }, { token: m.access_token, kind: 'metadata.access_token' },
    { token: bot.bot_access_token, kind: 'metadata.bot.bot_access_token' },
  ].filter(t => typeof t.token === 'string' && (t.token as string).trim().length > 10).map(t => ({ token: (t.token as string).trim(), kind: t.kind }))
}

async function candidates(channel: string, team: string): Promise<{ list: Candidate[]; tracked: boolean }> {
  const db = admin()
  const { data: trackers } = await db.from('slack_tracked_channels').select('user_id, channel_name, linked_account_id').eq('channel_id', channel).eq('is_tracked', true)
  const tr = (trackers ?? []) as Array<{ user_id: string; channel_name: string | null; linked_account_id: string | null }>
  const linked = tr.find(t => t.linked_account_id)?.linked_account_id ?? null
  const chanName = tr.find(t => t.channel_name)?.channel_name ?? ''
  const { data: integs } = await db.from('integrations').select('*').eq('provider', 'slack').eq('is_active', true).limit(200)
  const rows = ((integs ?? []) as Row[])
    // the channel's trackers first, then any connection to the same workspace
    .filter(r => tr.some(t => t.user_id === r.user_id) || JSON.stringify(r.metadata ?? {}).includes(team) || r.team_id === team)
    .sort((x, y) => (tr.some(t => t.user_id === y.user_id) ? 1 : 0) - (tr.some(t => t.user_id === x.user_id) ? 1 : 0)
      || String(y.connected_at ?? y.updated_at ?? '').localeCompare(String(x.connected_at ?? x.updated_at ?? '')))
  const list: Candidate[] = []
  for (const r of rows) for (const t of tokensIn(r)) {
    if (!list.some(c => c.token === t.token)) list.push({ token: t.token, ownerId: String(r.user_id), channelName: chanName, linkedAccountId: linked, source: t.kind })
  }
  return { list, tracked: tr.length > 0 }
}

async function workingKey(channel: string, team: string) {
  const { list, tracked } = await candidates(channel, team)
  let tried = 0
  const good: Array<Candidate & { bot: boolean }> = []
  for (const c of list) {
    tried++
    try {
      const r = await fetch('https://slack.com/api/auth.test', { method: 'POST', headers: { authorization: `Bearer ${c.token}` } })
      const j = await r.json() as Row
      if (j.ok) good.push({ ...c, bot: !!j.bot_id || c.token.startsWith('xoxb-') })
    } catch { /* try the next */ }
  }
  const pick = good.find(g => g.bot) ?? good[0]
  return { pick, tried, valid: good.length, tracked }
}

async function slack(token: string, method: string, body: Record<string, unknown>) {
  const r = await fetch(`https://slack.com/api/${method}`, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
  return r.json() as Promise<Row>
}
async function channelName(token: string, channel: string) {
  try { const r = await fetch(`https://slack.com/api/conversations.info?channel=${channel}`, { headers: { authorization: `Bearer ${token}` } }); const j = await r.json() as Row; return ((j.channel as Row | undefined)?.name as string) ?? '' } catch { return '' }
}

export async function answerMention(ev: { team: string; channel: string; ts: string; thread_ts?: string; text: string; user?: string }): Promise<string> {
  const { pick, tried, valid, tracked } = await workingKey(ev.channel, ev.team)
  if (!pick) {
    return tried === 0
      ? 'no Slack connection found for this channel or workspace (connect Slack under Integrations)'
      : `none of the ${tried} saved Slack key${tried === 1 ? '' : 's'} is accepted by Slack any more (reconnect Slack under Integrations, then select this channel again)`
  }
  const ws = pick
  const keyNote = `using ${pick.bot ? 'the bot key' : 'a user key'} (${pick.source}); ${valid} of ${tried} saved key${tried === 1 ? '' : 's'} valid`
  const db = admin()

  // the org that owns the workspace
  const { data: mem } = await db.from('org_members').select('org_id').eq('user_id', ws.ownerId).maybeSingle()
  let ids = [ws.ownerId]
  if (mem?.org_id) { const { data: all } = await db.from('org_members').select('user_id').eq('org_id', mem.org_id); ids = ((all ?? []) as Row[]).map(r => r.user_id as string) }

  const question = ev.text.replace(/<@[A-Z0-9]+(\|[^>]+)?>/g, ' ').replace(/(^|\s)@popsicle\b[:,]?/gi, ' ').replace(/^\s*popsicle[\s,:]+/i, '').replace(/\s+/g, ' ').trim()
  if (!question) {
    const r0 = await slack(ws.token, 'chat.postMessage', { channel: ev.channel, thread_ts: ev.thread_ts ?? ev.ts, text: 'Ask me about a deal, for example: _is this going to close this quarter?_' })
    return r0.ok ? `posted a prompt (the question was empty) · ${keyNote}` : `Slack refused the reply: ${r0.error} · ${keyNote}`
  }

  const [{ data: accounts }, { data: signals }, { data: commitments }] = await Promise.all([
    db.from('accounts').select('id, name, value, stage, risk_level, health_score, close_date, last_contact_date, owner').in('user_id', ids).limit(400),
    db.from('signals').select('id, account_name, signal_type, severity, title, description, risk_amount, created_at, status, is_dismissed, source_integration, ai_analysis').in('user_id', ids).order('created_at', { ascending: false }).limit(400),
    db.from('commitments').select('id, text, due_at, account_name, status').in('user_id', ids).eq('status', 'open').limit(100),
  ])
  const accts = (accounts ?? []) as Row[]

  // which account: named in the question, else the channel's name (#acme-renewal → Acme Corp)
  const chan = slug(ws.channelName || await channelName(ws.token, ev.channel))
  const qn = slug(question)
  const score = (name: string) => { const n = slug(name); const first = n.split(' ')[0]; return qn.includes(n) ? 3 : (first.length > 2 && qn.includes(first)) ? 2 : (chan.includes(n) || (first.length > 2 && chan.split(' ').includes(first))) ? 1 : 0 }
  const named = [...accts].map(a => ({ a, s: score(String(a.name)) })).filter(x => x.s >= 2).sort((x, y) => y.s - x.s)[0]?.a
  const linked = ws.linkedAccountId ? accts.find(a => a.id === ws.linkedAccountId) : undefined
  const guessed = [...accts].map(a => ({ a, s: score(String(a.name)) })).filter(x => x.s > 0).sort((x, y) => y.s - x.s)[0]?.a
  const acct = named ?? linked ?? guessed     // a name in the question wins, then the channel's link, then a guess

  // "this deal" in a channel that isn't linked to anything: ask which deal instead of answering blind
  const aboutPortfolio = /\b(pipeline|portfolio|all (my )?(deals|accounts)|which (deals|accounts)|what('s| is) (at risk|slipping)|this (week|quarter)'s)\b/i.test(question)
  if (!acct && !aboutPortfolio) {
    const top = [...accts].sort((x, y) => Number(y.value || 0) - Number(x.value || 0)).slice(0, 5).map(a => String(a.name))
    const example = top[0] ?? 'Acme Corp'
    const msg = [
      `Which deal do you mean? This channel isn't linked to an account in Popsicle yet, so I can't tell which one "this" is.`,
      top.length ? `Your biggest open ones: ${top.map(n => `*${n}*`).join(', ')}.` : '',
      `Ask me again with the name, for example _is ${example} going to close this quarter?_`,
      `Or link this channel once and I'll always know: <${SITE()}/integrations?slack_channels=1|link it in Popsicle>.`,
    ].filter(Boolean).join('\n')
    const rq = await slack(ws.token, 'chat.postMessage', { channel: ev.channel, thread_ts: ev.thread_ts ?? ev.ts, text: msg, unfurl_links: false, unfurl_media: false })
    return rq.ok ? `asked which deal (channel not linked, no account named) · ${keyNote}` : `Slack refused the reply: ${rq.error} · ${keyNote}`
  }

  const openSigs = ((signals ?? []) as Row[]).filter(s => !s.is_dismissed && (!s.status || s.status === 'open'))
  const sigs = acct ? openSigs.filter(s => s.account_name === acct.name) : openSigs.slice(0, 20)
  const cms = ((commitments ?? []) as Row[]).filter(c => !acct || c.account_name === acct.name)

  const context = [
    acct ? `ACCOUNT: ${acct.name} · ${money(acct.value)} · stage ${acct.stage ?? '--'} · risk ${acct.risk_level ?? '--'} · health ${acct.health_score ?? '--'} · closes ${acct.close_date ?? '--'} · last contact ${acct.last_contact_date ?? '--'} · contact ${acct.owner ?? '--'}` : `PORTFOLIO: ${accts.length} accounts. No single account matched this channel or question.`,
    'OPEN SIGNALS:',
    ...sigs.slice(0, 12).map(s => { const ai = (s.ai_analysis ?? {}) as Row; return `- [${s.severity}] ${s.account_name}: ${s.title}${s.risk_amount ? ` (${money(s.risk_amount)})` : ''} via ${s.source_integration ?? '?'}${ai.quote ? ` · quote: "${ai.quote}"` : ''}${ai.recommendation ? ` · rec: ${ai.recommendation}` : ''}` }),
    cms.length ? 'OPEN COMMITMENTS:' : '',
    ...cms.slice(0, 8).map(c => `- ${c.account_name ?? ''}: ${c.text} (due ${c.due_at ?? '--'})`),
  ].filter(Boolean).join('\n')

  const system = `You are Popsicle, answering a question someone asked by mentioning you in a Slack channel where their sales team discusses deals. Everyone in the channel will read your answer.
Answer only from what Popsicle knows below. Never invent figures, names or events.
Speak as a colleague who has read the team's email, calls and Slack: never mention "context", "data provided", "input" or "the information given". If something genuinely isn't known, say so plainly in one line (for example "I haven't seen a reply from the CFO since the 12th").
Write for Slack: short lines, *single asterisks* for bold, no # headings, no emoji, no em dashes. Under 120 words.

${context}

${wantsVerdict(question) ? VERDICT_RULES.replace(/\*\*/g, '*') : 'Lead with the answer in one sentence, then at most three short lines of reasons, each starting with a bold two-word lead.'}`

  let text = ''
  let aiError = ''
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 600, system, messages: [{ role: 'user', content: question }] }),
    })
    const j = await r.json() as { content?: Array<{ type: string; text?: string }>; error?: { message?: string } }
    if (!r.ok) { aiError = `AI call failed (${r.status}): ${j.error?.message ?? 'unknown'}` }
    text = (j.content ?? []).filter(c => c.type === 'text').map(c => c.text ?? '').join('').trim()
  } catch (e) { aiError = `AI call threw: ${String(e)}` }
  if (!text) text = 'I could not answer that just now. Try again in a minute.'

  // never echo the trigger word, so a reply can't set itself off (it may be posted with a user token)
  text = text.replace(/@popsicle/gi, 'Popsicle')
  // Slack formatting: the verdict line in bold, a link back to the account
  text = text.replace(/^Verdict:\s*/i, '*Verdict:* ')
  const link = acct ? `\n<${SITE()}/accounts/${encodeURIComponent(String(acct.name))}|Open ${acct.name} in Popsicle>` : `\n<${SITE()}/pulse|Open Popsicle>`
  const note = tracked ? '' : '\n_This channel isn\'t linked to an account in Popsicle yet. Link it under Integrations → Slack channels for sharper answers._'
  const res = await slack(ws.token, 'chat.postMessage', { channel: ev.channel, thread_ts: ev.thread_ts ?? ev.ts, text: text + link + note, unfurl_links: false, unfurl_media: false })
  if (!res.ok) {
    const hint = res.error === 'not_in_channel' ? ' (invite the bot: /invite @popsicle)' : res.error === 'missing_scope' ? ' (add chat:write to the bot scopes and reinstall)' : res.error === 'invalid_auth' || res.error === 'token_revoked' ? ' (reconnect Slack under Integrations)' : ''
    return `Slack refused the reply: ${res.error}${hint} · ${keyNote}`
  }
  return (aiError ? `posted a fallback reply because the ${aiError}` : `posted${acct ? ` (about ${acct.name})` : ''}${tracked ? '' : ' (channel not linked to an account)'}`) + ` · ${keyNote}`
}
