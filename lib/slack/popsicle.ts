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

// Who owns this channel, and which account it's linked to: the same table slack-events uses
// (slack_tracked_channels), and the bot token from integrations.access_token.
async function findChannel(channel: string) {
  const db = admin()
  const { data: trackers } = await db.from('slack_tracked_channels').select('user_id, channel_name, linked_account_id').eq('channel_id', channel).eq('is_tracked', true)
  const rows = (trackers ?? []) as Array<{ user_id: string; channel_name: string | null; linked_account_id: string | null }>
  for (const t of rows) {
    const { data: integ } = await db.from('integrations').select('access_token').eq('user_id', t.user_id).eq('provider', 'slack').eq('is_active', true).maybeSingle()
    const token = (integ as { access_token?: string } | null)?.access_token
    if (token) return { token: String(token), ownerId: t.user_id, channelName: t.channel_name ?? '', linkedAccountId: rows.find(r => r.linked_account_id)?.linked_account_id ?? null }
  }
  return null
}

// Fallback when the channel isn't tracked: the workspace's Slack connection, found by team id
async function findWorkspace(team: string) {
  const { data } = await admin().from('integrations').select('*').eq('provider', 'slack').eq('is_active', true).limit(200)
  const rows = (data ?? []) as Row[]
  const hit = rows.find(r => JSON.stringify(r.metadata ?? {}).includes(team) || r.team_id === team) ?? (rows.length === 1 ? rows[0] : undefined)
  const token = hit?.access_token as string | undefined
  return hit && token ? { token: String(token), ownerId: hit.user_id as string, channelName: '', linkedAccountId: null as string | null } : null
}

async function slack(token: string, method: string, body: Record<string, unknown>) {
  const r = await fetch(`https://slack.com/api/${method}`, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
  return r.json() as Promise<Row>
}
async function channelName(token: string, channel: string) {
  try { const r = await fetch(`https://slack.com/api/conversations.info?channel=${channel}`, { headers: { authorization: `Bearer ${token}` } }); const j = await r.json() as Row; return ((j.channel as Row | undefined)?.name as string) ?? '' } catch { return '' }
}

export async function answerMention(ev: { team: string; channel: string; ts: string; thread_ts?: string; text: string; user?: string }) {
  const tracked = await findChannel(ev.channel)
  const ws = tracked ?? await findWorkspace(ev.team)
  if (!ws) { console.warn('[popsicle-slack] no Slack connection found for channel', ev.channel, 'team', ev.team); return }
  console.log('[popsicle-slack] answering', { channel: ev.channel, tracked: !!tracked })
  const db = admin()

  // the org that owns the workspace
  const { data: mem } = await db.from('org_members').select('org_id').eq('user_id', ws.ownerId).maybeSingle()
  let ids = [ws.ownerId]
  if (mem?.org_id) { const { data: all } = await db.from('org_members').select('user_id').eq('org_id', mem.org_id); ids = ((all ?? []) as Row[]).map(r => r.user_id as string) }

  const question = ev.text.replace(/<@[A-Z0-9]+>/g, '').replace(/(^|\s)@popsicle\b[:,]?/gi, ' ').replace(/\s+/g, ' ').trim()
  if (!question) {
    await slack(ws.token, 'chat.postMessage', { channel: ev.channel, thread_ts: ev.thread_ts ?? ev.ts, text: 'Ask me about a deal, for example: _is this going to close this quarter?_' })
    return
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
Answer only from the context below. Never invent figures, names or events. If the context cannot answer the question, say what is missing in one line.
Write for Slack: short lines, *single asterisks* for bold, no # headings, no emoji, no em dashes. Under 120 words.

${context}

${wantsVerdict(question) ? VERDICT_RULES.replace(/\*\*/g, '*') : 'Lead with the answer in one sentence, then at most three short lines of reasons, each starting with a bold two-word lead.'}`

  let text = ''
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 600, system, messages: [{ role: 'user', content: question }] }),
    })
    const j = await r.json() as { content?: Array<{ type: string; text?: string }>; error?: { message?: string } }
    if (!r.ok) console.error('[popsicle-slack] AI call failed:', r.status, j.error?.message)
    text = (j.content ?? []).filter(c => c.type === 'text').map(c => c.text ?? '').join('').trim()
  } catch (e) { console.error('[popsicle-slack] AI call threw', e) }
  if (!text) text = 'I could not answer that just now. Try again in a minute.'

  // never echo the trigger word, so a reply can't set itself off (it may be posted with a user token)
  text = text.replace(/@popsicle/gi, 'Popsicle')
  // Slack formatting: the verdict line in bold, a link back to the account
  text = text.replace(/^Verdict:\s*/i, '*Verdict:* ')
  const link = acct ? `\n<${SITE()}/accounts/${encodeURIComponent(String(acct.name))}|Open ${acct.name} in Popsicle>` : `\n<${SITE()}/pulse|Open Popsicle>`
  const note = tracked ? '' : '\n_This channel isn\'t linked to an account in Popsicle yet. Link it under Integrations → Slack channels for sharper answers._'
  const res = await slack(ws.token, 'chat.postMessage', { channel: ev.channel, thread_ts: ev.thread_ts ?? ev.ts, text: text + link + note, unfurl_links: false, unfurl_media: false })
  if (!res.ok) console.error('[popsicle-slack] Slack refused the reply:', res.error, '(not_in_channel = invite the bot; missing_scope = add chat:write and reinstall)')
  else console.log('[popsicle-slack] replied')
}
