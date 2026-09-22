import { NextRequest, NextResponse } from 'next/server'
import { buildDigest, buildDealUpdate } from '@/lib/slack/digest'
import { tokenForUser, postToSlack, slackAdmin } from '@/lib/slack/popsicle'
import type * as M from '@/lib/metrics'
import { fetchAll } from '@/lib/fetchAll'

// Called every hour by Supabase (pg_cron). Sends each team's briefing at their chosen local hour,
// once a day, and (if they asked) a daily update to each linked deal channel where something changed.
// Protected by CRON_SECRET: the scheduler sends it in the x-cron-key header.
export const runtime = 'nodejs'
type Row = { user_id: string; enabled: boolean; channel_id: string | null; send_hour: number; timezone: string; deal_updates: boolean; last_sent_on: string | null; last_deal_updates_on: string | null }

const localParts = (tz: string, now: Date) => {
  try {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now)
    const g = (t: string) => f.find(p => p.type === t)?.value ?? ''
    return { date: `${g('year')}-${g('month')}-${g('day')}`, hour: Number(g('hour')) }
  } catch { return { date: now.toISOString().slice(0, 10), hour: now.getUTCHours() } }
}

export async function GET(req: NextRequest) {
  const key = process.env.CRON_SECRET?.trim()
  if (!key || req.headers.get('x-cron-key') !== key) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const db = slackAdmin()
  const { data: rows } = await db.from('slack_digests').select('*').eq('enabled', true)
  const now = new Date(), report: Array<Record<string, unknown>> = []
  for (const r of (rows ?? []) as Row[]) {
    const { date, hour } = localParts(r.timezone || 'UTC', now)
    if (hour !== r.send_hour) continue
    const briefingDue = r.channel_id && r.last_sent_on !== date
    const dealsDue = r.deal_updates && r.last_deal_updates_on !== date
    if (!briefingDue && !dealsDue) continue
    const token = await tokenForUser(r.user_id)
    if (!token) { report.push({ user: r.user_id, skipped: 'no working Slack key' }); continue }
    // the team's data: every member of the owner's organisation
    const { data: mem } = await db.from('org_members').select('org_id').eq('user_id', r.user_id).maybeSingle()
    let ids = [r.user_id]
    if (mem?.org_id) { const { data: all } = await db.from('org_members').select('user_id').eq('org_id', mem.org_id); ids = ((all ?? []) as Array<{ user_id: string }>).map(x => x.user_id) }
    const [accts, sigs] = await Promise.all([
      fetchAll<M.Acct>(async (from, to) => db.from('accounts').select('name, value, stage, risk_level, health_score, owner, close_date').in('user_id', ids).range(from, to) as never, { max: 5000 }),
      fetchAll<M.Sig>(async (from, to) => db.from('signals').select('id, account_name, signal_type, severity, title, description, risk_amount, created_at, status, is_dismissed, source_integration, handled_at, handled_action, ai_analysis').in('user_id', ids).order('created_at', { ascending: false }).range(from, to) as never, { max: 20000 }),
    ])
    if (briefingDue) {
      const res = await postToSlack(token, r.channel_id!, buildDigest(accts, sigs, now.getTime(), r.timezone))
      report.push({ user: r.user_id, briefing: res.ok ? 'sent' : res.error })
      if (res.ok) await db.from('slack_digests').update({ last_sent_on: date }).eq('user_id', r.user_id)
    }
    if (dealsDue) {
      const { data: links } = await db.from('slack_tracked_channels').select('channel_id, linked_account_id').in('user_id', ids).eq('is_tracked', true).not('linked_account_id', 'is', null)
      const { data: named } = await db.from('accounts').select('id, name').in('user_id', ids)
      const byId = new Map(((named ?? []) as Array<{ id: string; name: string }>).map(x => [x.id, x.name]))
      const seen = new Set<string>(); let posted = 0
      for (const l of (links ?? []) as Array<{ channel_id: string; linked_account_id: string }>) {
        if (seen.has(l.channel_id)) continue; seen.add(l.channel_id)
        const name = byId.get(l.linked_account_id); if (!name) continue
        const text = buildDealUpdate(name, accts, sigs, now.getTime())
        if (text) { const res = await postToSlack(token, l.channel_id, text); if (res.ok) posted++ }
      }
      await db.from('slack_digests').update({ last_deal_updates_on: date }).eq('user_id', r.user_id)
      report.push({ user: r.user_id, dealUpdates: posted })
    }
  }
  return NextResponse.json({ ok: true, at: now.toISOString(), report })
}
