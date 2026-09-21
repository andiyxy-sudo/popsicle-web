import { NextResponse, after } from 'next/server'
import crypto from 'node:crypto'
import { answerMention } from '@/lib/slack/popsicle'

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

// Open https://portal.popsicle-labs.app/api/slack/events in a browser to check the setup.
// It shows which settings are present (never their values).
export async function GET() {
  return NextResponse.json({
    ok: true,
    SLACK_SIGNING_SECRET: !!process.env.SLACK_SIGNING_SECRET?.trim(),
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? '(not set, using portal.popsicle-labs.app)',
  })
}

// A message forwarded by the slack-events edge function, which has already verified Slack's
// signature, carries the project's service role key. Both sides already hold that key.
function vouched(auth: string | null) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const given = auth?.replace(/^Bearer\s+/i, '').trim()
  if (!key || !given) return false
  try { return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(given)) } catch { return false }
}

export async function POST(req: Request) {
  const raw = await req.text()
  if (!vouched(req.headers.get('authorization')) && !verified(raw, req.headers.get('x-slack-request-timestamp'), req.headers.get('x-slack-signature'))) {
    console.warn('[popsicle-slack] rejected: neither the forwarding key nor the Slack signature matched. The service role key in Vercel must equal the Supabase project key.')
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
    console.log('[popsicle-slack] mention received', { team: body.team_id, channel: ev.channel })
    after(() => answerMention({ team: body.team_id!, channel: ev.channel, ts: ev.ts, thread_ts: ev.thread_ts, text: ev.text, user: ev.user })
      .catch(e => console.error('[popsicle-slack] failed', e)))
  }
  return new NextResponse(null, { status: 200 })
}
