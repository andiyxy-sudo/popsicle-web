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
  const secret = process.env.SLACK_SIGNING_SECRET
  if (!secret || !ts || !sig) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) return false          // replay protection
  const mine = 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${ts}:${raw}`).digest('hex')
  try { return crypto.timingSafeEqual(Buffer.from(mine), Buffer.from(sig)) } catch { return false }
}

export async function POST(req: Request) {
  const raw = await req.text()
  if (!verified(raw, req.headers.get('x-slack-request-timestamp'), req.headers.get('x-slack-signature'))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 })
  }
  const body = JSON.parse(raw) as { type: string; challenge?: string; team_id?: string; event?: { type: string; channel: string; ts: string; thread_ts?: string; text: string; user?: string; bot_id?: string } }

  if (body.type === 'url_verification') return NextResponse.json({ challenge: body.challenge })

  // Slack retries if we are slow; the first delivery is already being answered
  if (req.headers.get('x-slack-retry-num')) return new NextResponse(null, { status: 200 })

  const ev = body.event
  if (body.type === 'event_callback' && ev?.type === 'app_mention' && !ev.bot_id && body.team_id) {
    // acknowledge within Slack's 3 seconds; answer after the response is sent
    after(() => answerMention({ team: body.team_id!, channel: ev.channel, ts: ev.ts, thread_ts: ev.thread_ts, text: ev.text, user: ev.user }).catch(() => {}))
  }
  return new NextResponse(null, { status: 200 })
}
