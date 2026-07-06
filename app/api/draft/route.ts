import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST { signal_id } -> { subject, body, to }
// Drafts a follow-up email grounded in the signal's AI analysis plus the most
// recent real messages with that account. Server-side only: the Anthropic key
// never reaches the browser, and RLS scopes every read to the caller.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { signal_id } = await req.json().catch(() => ({}))
  if (!signal_id) return NextResponse.json({ error: 'missing_signal_id' }, { status: 400 })

  const { data: sig } = await supabase
    .from('signals')
    .select('account_name, signal_type, severity, title, description, ai_analysis, source_integration, raw_content, created_at')
    .eq('id', signal_id)
    .maybeSingle()
  if (!sig) return NextResponse.json({ error: 'signal_not_found' }, { status: 404 })

  const ai = (sig.ai_analysis ?? {}) as Record<string, unknown>
  const to = typeof ai.sender_email === 'string' ? ai.sender_email : ''
  const contact = typeof ai.contact_name === 'string' ? ai.contact_name : ''

  // Recent real messages with this account, newest first, for thread context.
  let thread = ''
  if (sig.account_name) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('sender, subject, content, received_at, direction')
      .ilike('account_name', sig.account_name)
      .order('received_at', { ascending: false })
      .limit(6)
    if (msgs?.length) {
      thread = msgs.map(m =>
        `[${m.direction === 'outbound' ? 'ME' : 'THEM'} ${String(m.received_at || '').slice(0, 10)}] ${m.subject || ''}: ${String(m.content || '').replace(/\s+/g, ' ').slice(0, 300)}`
      ).join('\n')
    }
  }

  const ctx: string[] = []
  ctx.push(`SIGNAL: [${sig.severity}] ${sig.signal_type}: ${sig.title || ''}`)
  if (sig.description) ctx.push(`Description: ${sig.description}`)
  if (typeof ai.summary === 'string' && ai.summary) ctx.push(`Analysis: ${ai.summary}`)
  if (typeof ai.reason === 'string' && ai.reason) ctx.push(`Reason: ${ai.reason}`)
  if (typeof ai.quote === 'string' && ai.quote) ctx.push(`Their exact words: "${ai.quote}"`)
  if (contact) ctx.push(`Contact name: ${contact}`)
  if (sig.account_name) ctx.push(`Account: ${sig.account_name}`)
  if (thread) ctx.push(`\nRECENT THREAD (newest first):\n${thread}`)
  else if (sig.raw_content) ctx.push(`\nSOURCE MESSAGE:\n${String(sig.raw_content).slice(0, 1200)}`)

  const system = [
    'You draft a follow-up email for a salesperson responding to a revenue signal.',
    'Reply with ONLY a JSON object: {"subject": string, "body": string}. No prose, no markdown fences.',
    'Rules:',
    '- The goal depends on the signal: recover a stalling deal, address an objection directly, re-book a cancelled meeting, or reinforce positive momentum. Match the move to the signal.',
    '- Warm, direct, human. 60 to 130 words. No corporate filler, no "I hope this email finds you well", no "just checking in", no "circling back".',
    '- Reference something concrete from their words or the thread so it reads personal, but NEVER quote their message back at them verbatim and never mention monitoring, signals, or analysis.',
    `- Greet the contact by first name if known${contact ? ` (${contact.split(' ')[0]})` : ''}, otherwise open without a name.`,
    '- One clear, low-friction ask (a specific question or a 20-minute call with two proposed windows described relatively, e.g. "early next week").',
    '- Sign off with just "Best," followed by [Your name] on the next line.',
    '- Never use em dashes or en dashes anywhere. Use commas, colons, or periods.',
    '- If the thread shows they already answered something, do not re-ask it.',
  ].join('\n')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 501 })

  const aResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 700,
      system,
      messages: [{ role: 'user', content: ctx.join('\n') }],
    }),
  })
  if (!aResp.ok) return NextResponse.json({ error: 'draft_failed' }, { status: 502 })
  const aJson = await aResp.json()
  const raw = (aJson.content?.[0]?.text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  let parsed: { subject?: string; body?: string } = {}
  try { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {} } catch { /* fall through */ }
  if (!parsed.body) return NextResponse.json({ error: 'draft_unparseable' }, { status: 502 })

  return NextResponse.json({
    subject: parsed.subject || `Re: ${sig.account_name || 'our conversation'}`,
    body: parsed.body,
    to,
  })
}
