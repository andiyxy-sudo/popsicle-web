import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST { to, subject, body, cc?, signal_id?, account_name?, mode? }
// Sends through the person's own Gmail (the send-email function), applies the Sending policy, and records
// the send. mode 'manual' means a person pressed send: always allowed. mode 'auto' means Popsicle is sending
// on its own, and every limit in Settings → Sending has to pass first.
const EXEC = /\b(ceo|cfo|coo|cto|cro|chief|president|founder|vp|vice president|head of|director|managing)\b/i
const cap = (s: string) => { const m = /([\d.]+)\s*([km])?/i.exec(s || ''); if (!m) return Infinity
  const n = parseFloat(m[1]); const u = (m[2] ?? '').toLowerCase(); return n * (u === 'm' ? 1e6 : u === 'k' ? 1e3 : 1) }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const user = session.user
  const b = await req.json().catch(() => ({}))
  const to = String(b.to ?? '').trim(), subject = String(b.subject ?? '').trim(), body = String(b.body ?? '').trim()
  const mode: 'manual' | 'auto' = b.mode === 'auto' ? 'auto' : 'manual'
  if (!to || !body) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

  if (mode === 'auto') {
    const meta = (user.user_metadata ?? {}) as { send_mode?: string; send_rules?: Record<string, unknown> }
    if (meta.send_mode !== 'without') return NextResponse.json({ error: 'auto_send_off', reason: 'Automatic sending is off. Every draft waits for you.' }, { status: 403 })
    const r = (meta.send_rules ?? {}) as { kinds?: string[]; neverExecs?: boolean; neverCritical?: boolean; maxDeal?: string }
    const kind = String(b.kind ?? '')
    if (r.kinds && kind && !r.kinds.includes(kind)) return NextResponse.json({ error: 'kind_not_allowed', reason: `"${kind}" is not one of the message kinds you allow.` }, { status: 403 })
    if (r.neverExecs !== false && EXEC.test(String(b.recipient_role ?? ''))) return NextResponse.json({ error: 'excluded', reason: 'That recipient is an executive, and executives always come to you first.' }, { status: 403 })
    if (b.account_name) {
      const { data: acct } = await supabase.from('accounts').select('risk_level, value').eq('name', b.account_name).maybeSingle()
      if (r.neverCritical !== false && acct?.risk_level === 'high') return NextResponse.json({ error: 'excluded', reason: 'That account is at critical risk, so it always comes to you first.' }, { status: 403 })
      if (r.maxDeal && r.maxDeal !== 'Any' && Number(acct?.value ?? 0) > cap(r.maxDeal)) return NextResponse.json({ error: 'excluded', reason: `That deal is above your ${r.maxDeal} ceiling for automatic sending.` }, { status: 403 })
    }
  }

  if ((user.email ?? '').toLowerCase() === 'demo@popsicle-labs.app') {
    return NextResponse.json({ ok: true, demo: true, message_id: null, threaded: false, logged: false,
      note: 'This is the demo workspace, which has no mailbox behind it. On a real account this would send from your own Gmail.' })
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const r = await fetch(`${base}/functions/v1/send-email`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ to, cc: b.cc ?? '', subject, body, signal_id: b.signal_id ?? null }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j?.ok) {
    const error = String(j?.error ?? 'send_failed')
    const reason = error === 'needs_scope' ? 'Popsicle can read your Gmail but not send from it yet. Reconnect Gmail and allow sending.'
      : error === 'gmail_not_connected' ? 'Gmail is not connected.' : String(j?.detail ?? 'The send failed.')
    return NextResponse.json({ error, reason }, { status: r.status === 403 ? 403 : 502 })
  }

  const { error: logErr } = await supabase.from('sends').insert({
    user_id: user.id, account_name: b.account_name ?? null, to_email: to, subject, signal_id: b.signal_id ?? null,
    message_id: j.message_id ?? null, threaded: !!j.threaded, mode, approved_by: mode === 'manual' ? 'user' : 'policy',
  })
  return NextResponse.json({ ok: true, message_id: j.message_id ?? null, threaded: !!j.threaded, logged: !logErr })
}
