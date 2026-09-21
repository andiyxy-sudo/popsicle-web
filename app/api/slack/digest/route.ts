import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadMetricsData } from '@/lib/metricsData'
import { buildDigest } from '@/lib/slack/digest'
import { tokenForUser, postToSlack } from '@/lib/slack/popsicle'

// GET  → { settings, preview }   the daily briefing's settings and what it would say right now
// POST { action: 'save', enabled, channel_id, channel_name, send_hour, timezone, deal_updates }
// POST { action: 'test' }        send the briefing to the chosen channel now
type Settings = { enabled: boolean; channel_id: string | null; channel_name: string | null; send_hour: number; timezone: string; deal_updates: boolean; last_sent_on?: string | null }
const DEFAULTS: Settings = { enabled: false, channel_id: null, channel_name: null, send_hour: 9, timezone: 'UTC', deal_updates: false }

async function ctx() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return null
  const demo = (claims.claims.email as string | undefined) === 'demo@popsicle-labs.app'
  return { supabase, claims: claims.claims as Record<string, unknown>, uid: claims.claims.sub as string, demo }
}

export async function GET() {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { accts, sigs, now } = await loadMetricsData(c.supabase, c.claims)
  let settings = DEFAULTS, note: string | undefined
  if (!c.demo) {
    const { data, error } = await c.supabase.from('slack_digests').select('*').eq('user_id', c.uid).maybeSingle()
    if (error) note = 'One-time setup needed: run supabase/migrations/20260922_slack_digest.sql'
    else if (data) settings = { ...DEFAULTS, ...(data as Settings) }
  }
  return NextResponse.json({ settings, preview: buildDigest(accts, sigs, now, settings.timezone), demo: c.demo, note })
}

export async function POST(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as Partial<Settings> & { action?: string }
  if (body.action === 'save') {
    if (c.demo) return NextResponse.json({ ok: true, demo: true })
    const row = { user_id: c.uid, enabled: !!body.enabled, channel_id: body.channel_id ?? null, channel_name: body.channel_name ?? null,
      send_hour: Math.min(23, Math.max(0, Number(body.send_hour ?? 9))), timezone: body.timezone || 'UTC', deal_updates: !!body.deal_updates, updated_at: new Date().toISOString() }
    const { error } = await c.supabase.from('slack_digests').upsert(row, { onConflict: 'user_id' })
    if (error) return NextResponse.json({ error: error.message.includes('slack_digests') ? 'One-time setup needed: run supabase/migrations/20260922_slack_digest.sql' : error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'test') {
    if (c.demo) return NextResponse.json({ error: 'The demo account isn\u2019t connected to a real Slack. The preview shows exactly what would be posted.' }, { status: 400 })
    const { data: s } = await c.supabase.from('slack_digests').select('*').eq('user_id', c.uid).maybeSingle()
    const channel = (s as Settings | null)?.channel_id
    if (!channel) return NextResponse.json({ error: 'Choose a channel and save first.' }, { status: 400 })
    const token = await tokenForUser(c.uid)
    if (!token) return NextResponse.json({ error: 'No working Slack connection. Reconnect Slack under Integrations.' }, { status: 400 })
    const { accts, sigs, now } = await loadMetricsData(c.supabase, c.claims)
    const r = await postToSlack(token, channel, buildDigest(accts, sigs, now, (s as Settings).timezone))
    if (!r.ok) return NextResponse.json({ error: r.error === 'not_in_channel' ? 'Popsicle isn\u2019t in that channel yet. In Slack, type /invite and pick Popsicle, then try again.' : `Slack said: ${r.error}` }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
