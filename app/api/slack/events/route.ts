import { NextResponse, after } from 'next/server'
import crypto from 'node:crypto'
import { answerMention } from '@/lib/slack/popsicle'
import { createClient as createAdmin } from '@supabase/supabase-js'

// Slack Events API endpoint for @popsicle. Sits alongside the existing post-to-slack edge
// function and replaces nothing. Setup (once, in the Slack app config):
//   Event Subscriptions → Request URL: https://<portal>/api/slack/events
//   Subscribe to bot events: app_mention
//   Bot token scopes: app_mentions:read, chat:write, channels:read (+ groups:read for private channels)
//   Reinstall the app to the workspace so the new scopes apply.
// Env: SLACK_SIGNING_SECRET (Basic Information → App Credentials), SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
export const runtime = 'nodejs'

function verified(raw: string, ts: string | null, sig: string | null) {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim()     // a pasted secret often carries a trailing newline
  if (!secret || !ts || !sig) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) return false          // replay protection
  const mine = 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${ts}:${raw}`).digest('hex')
  try { return crypto.timingSafeEqual(Buffer.from(mine), Buffer.from(sig)) } catch { return false }
}

export async function POST(req: Request) {
  const raw = await req.text()

  // v11.107: the slack-events edge function saved a question in slack_mentions and sends only its id.
  // Reading it back from the database is the proof it's genuine: only the project's own
  // service role can write that table. Claiming the row (answered_at) makes each question
  // answered exactly once. No key or secret has to match between Supabase and Vercel.
  let parsed: { mention_id?: string } = {}
  try { parsed = JSON.parse(raw) } catch { /* not JSON */ }
  if (parsed.mention_id && /^[0-9a-f-]{36}$/i.test(parsed.mention_id)) {
    const db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), { auth: { autoRefreshToken: false, persistSession: false } })
    const since = new Date(Date.now() - 10 * 60_000).toISOString()
    const { data: m, error } = await db.from('slack_mentions').update({ answered_at: new Date().toISOString() })
      .eq('id', parsed.mention_id).is('answered_at', null).gte('created_at', since)
      .select('team, channel, ts, thread_ts, text, slack_user').maybeSingle()
    if (error) { console.error('[popsicle-slack] unreadable question', error.message); return NextResponse.json({ error: error.message }, { status: 500 }) }
    if (!m) return NextResponse.json({ ok: true, skipped: 'unknown or already answered' })
    // the result, in plain words, goes back onto the same row (slack_mentions.outcome)
    after(async () => {
      let outcome = ''
      try { outcome = await answerMention({ team: String(m.team ?? ''), channel: String(m.channel), ts: String(m.ts), thread_ts: m.thread_ts ? String(m.thread_ts) : undefined, text: String(m.text ?? ''), user: m.slack_user ? String(m.slack_user) : undefined }) }
      catch (e) { outcome = `error: ${e instanceof Error ? e.message : String(e)}`; console.error('[popsicle-slack] unexpected', e) }
      try { await db.from('slack_mentions').update({ outcome: outcome.slice(0, 500) }).eq('id', parsed.mention_id!) } catch { /* column may not exist yet */ }
    })
    return NextResponse.json({ ok: true })
  }

  if (!verified(raw, req.headers.get('x-slack-request-timestamp'), req.headers.get('x-slack-signature'))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 })
  }
  const body = JSON.parse(raw) as { type: string; challenge?: string; team_id?: string; event?: { type: string; subtype?: string; channel: string; ts: string; thread_ts?: string; text: string; user?: string; bot_id?: string } }

  if (body.type === 'url_verification') return NextResponse.json({ challenge: body.challenge })

  // Slack retries if we are slow; the first delivery is already being answered
  if (req.headers.get('x-slack-retry-num')) return new NextResponse(null, { status: 200 })

  const ev = body.event
  // a formal mention (app_mention), or a message that asks "@popsicle …" in plain text
  // (slack-events decides which ordinary messages are addressed to Popsicle and forwards only those;
  //  Slack itself never sends message events here, and the signature proves it came from Slack)
  const asks = !!ev && (ev.type === 'app_mention' || (ev.type === 'message' && (!ev.subtype || ev.subtype === 'thread_broadcast')))
  if (body.type === 'event_callback' && ev && asks && !ev.bot_id && body.team_id) {
    // acknowledge within Slack's 3 seconds; answer after the response is sent
    after(() => answerMention({ team: body.team_id!, channel: ev.channel, ts: ev.ts, thread_ts: ev.thread_ts, text: ev.text, user: ev.user })
      .catch(e => console.error('[popsicle-slack] unexpected', e)))
  }
  return new NextResponse(null, { status: 200 })
}
