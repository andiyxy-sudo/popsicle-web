import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEMO_SIGNALS, DEMO_COMMS, DEMO_PEOPLE } from '@/lib/demo-dataset'
import { readSettings, voiceRule, languageRule } from '@/lib/settings'

// POST { signal_id } -> { subject, body, to }
// Drafts a follow-up email grounded in the signal's AI analysis plus the most
// recent real messages with that account. Server-side only: the Anthropic key
// never reaches the browser, and RLS scopes every read to the caller.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { signal_id, intent } = await req.json().catch(() => ({}))
  if (!signal_id) return NextResponse.json({ error: 'missing_signal_id' }, { status: 400 })

  // Demo signals live in the dataset, not the database. The draft is still
  // written by the model, grounded in the demo signal and the demo thread.
  const isDemo = String(signal_id).startsWith('demo-')
  type SigRow = { account_name: string | null; signal_type: string; severity: string; title: string; description: string | null; ai_analysis: Record<string, unknown> | null; source_integration: string | null; raw_content: string | null; created_at: string | null }
  let sig: SigRow | null = null
  if (isDemo) {
    const d = DEMO_SIGNALS.find(s => s.id === signal_id) as unknown as (SigRow & { ai_analysis?: Record<string, unknown> }) | undefined
    if (d) {
      const people = DEMO_PEOPLE[d.account_name ?? ''] ?? []
      const champion = people.find(p => /CHAMPION|DECISION|SPONSOR/.test(p.badge)) ?? people[0]
      const domain = (d.account_name ?? 'example').toLowerCase().replace(/[^a-z]/g, '') + '.com'
      sig = { ...d, ai_analysis: { ...(d.ai_analysis ?? {}), contact_name: champion?.name ?? '', sender_email: champion ? `${champion.name.split(' ')[0].toLowerCase()}@${domain}` : '' } }
    }
  } else {
    const { data } = await supabase
      .from('signals')
      .select('account_name, signal_type, severity, title, description, ai_analysis, source_integration, raw_content, created_at')
      .eq('id', signal_id)
      .maybeSingle()
    sig = (data as SigRow | null)
  }
  if (!sig) return NextResponse.json({ error: 'signal_not_found' }, { status: 404 })

  const ai = (sig.ai_analysis ?? {}) as Record<string, unknown>
  const to = typeof ai.sender_email === 'string' ? ai.sender_email : ''
  const contact = typeof ai.contact_name === 'string' ? ai.contact_name : ''

  // Recent real messages with this account, newest first, for thread context.
  let thread = ''
  if (isDemo && sig.account_name) {
    const comms = DEMO_COMMS[sig.account_name] ?? []
    if (comms.length) thread = comms.map(c => `[${/Andy G|Mike Ross|Jamie Torres|Billing System/.test(c.who) ? 'ME' : 'THEM'} ${c.when} via ${c.via}] ${c.who}, ${c.role}: ${c.quote}`).join('\n')
  } else if (sig.account_name) {
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
    '- Take no stance on pricing, discounts, contract terms, or internal decisions and commit to nothing not already in the thread; propose a conversation instead.',
    '- Do not invent numbers, dates, amounts, or names. If a specific figure is not in the material provided, leave it out.',
    ...(typeof intent === 'string' && intent.trim() ? [`- PURPOSE OF THIS EMAIL: ${intent.trim()}. Write specifically for that purpose (for example a comparison one-pager, an ROI sheet, a contract redline, a meeting invite, a written confirmation), not a generic check-in.`] : []),
  ].join('\n')
  // the user's own drafting preferences (Settings → Drafting) and language override the defaults above
  const mySettings = readSettings((claimsData.claims.user_metadata ?? {}) as Record<string, unknown>)
  const systemWithPrefs = `${system}\nThe user's own preferences override the tone and length above. ${voiceRule(mySettings)} ${languageRule(mySettings)}`

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 501 })

  // ---------- DETERMINISTIC GUARDS (house rule: guards over prompts) ----------
  // Grounding corpus = everything the model was shown + the system prompt.
  const corpus = (ctx.join('\n') + '\n' + system)
  const groundedDigits = new Set((corpus.match(/\d+/g) ?? []))
  const contactFirst = contact ? contact.split(' ')[0].toLowerCase() : null
  const DELIBERATION = [
    /\b(our|the|this) (signal|signals|analysis|monitoring|system|model|detector|detection|alert)\b/i,
    /\bwe (noticed|detected|flagged|scored|classified)\b/i,
    /\b(risk|health) (score|flag|level)\b/i,
    /\b(churn|deal) risk\b/i,
    /\binternal(ly)? (note|notes|deliberation|discussion)\b/i,
    /\bdo not repeat\b/i,
    /\btalking points?\b/i,
    /\bsentiment\b/i,
    /\bobjection\b/i,
  ]

  type Guard = { digits: 'pass' | 'fail'; greeting: 'pass' | 'rewritten'; deliberation: 'pass' | 'fail' }
  function applyGuards(bodyIn: string): { body: string; guard: Guard; ok: boolean } {
    let body = bodyIn
    const guard: Guard = { digits: 'pass', greeting: 'pass', deliberation: 'pass' }
    // Guard A: ungrounded digits -> discard
    for (const d of (body.match(/\d+/g) ?? [])) {
      if (!groundedDigits.has(d)) { guard.digits = 'fail'; break }
    }
    // Guard B: ungrounded greeting name -> rewrite (never discard for this)
    const gm = body.match(/^\s*(hi|hello|hey|dear)\s+([A-Z][a-zA-Z'.-]*)\s*[,!.]/i)
    if (gm) {
      const nm = gm[2].toLowerCase()
      if (!contactFirst || nm !== contactFirst) {
        body = body.replace(gm[0], `${gm[1].charAt(0).toUpperCase() + gm[1].slice(1).toLowerCase()},`)
        guard.greeting = 'rewritten'
      }
    }
    // Guard C: internal-deliberation phrasing -> discard
    if (DELIBERATION.some(r => r.test(body))) guard.deliberation = 'fail'
    return { body, guard, ok: guard.digits === 'pass' && guard.deliberation === 'pass' }
  }

  const HARD_MS = 30_000
  const controller = new AbortController()
  const hardTimer = setTimeout(() => controller.abort(), HARD_MS)
  let parsed: { subject?: string; body?: string } = {}
  let guard: Guard = { digits: 'pass', greeting: 'pass', deliberation: 'pass' }
  let attempts = 0
  let lastReason = ''
  try {
    for (attempts = 1; attempts <= 2; attempts++) {
      const sys = attempts === 1 ? systemWithPrefs : systemWithPrefs + '\nSTRICT: the previous draft was rejected for ' + lastReason + '. Use NO numbers at all, and never reference how you know things.'
      const aResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 700, system: sys, messages: [{ role: 'user', content: ctx.join('\n') }] }),
        signal: controller.signal,
      })
      if (!aResp.ok) { clearTimeout(hardTimer); return NextResponse.json({ error: 'draft_failed' }, { status: 502 }) }
      const aJson = await aResp.json()
      const raw = (aJson.content?.[0]?.text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
      try { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {} } catch { parsed = {} }
      if (!parsed.body) { lastReason = 'unparseable output'; continue }
      const g = applyGuards(parsed.body)
      guard = g.guard
      if (g.ok) { parsed.body = g.body; break }
      lastReason = [g.guard.digits === 'fail' ? 'containing numbers not present in the source material' : null, g.guard.deliberation === 'fail' ? 'referencing internal analysis or monitoring' : null].filter(Boolean).join(' and ')
      parsed = {}
    }
  } catch (e) {
    clearTimeout(hardTimer)
    const aborted = (e as { name?: string })?.name === 'AbortError'
    return NextResponse.json({ error: aborted ? 'draft_timeout' : 'draft_failed' }, { status: aborted ? 504 : 502 })
  }
  clearTimeout(hardTimer)
  if (!parsed.body) {
    // Guards over prompts: never ship an ungrounded draft. Fail honestly.
    return NextResponse.json({ error: 'draft_ungrounded', detail: lastReason || 'could not produce a grounded draft' }, { status: 422 })
  }

  // Subject guard: same digit rule applies
  if (parsed.subject && (parsed.subject.match(/\d+/g) ?? []).some(d => !groundedDigits.has(d))) {
    parsed.subject = `Re: ${sig.account_name || 'our conversation'}`
  }

  return NextResponse.json({
    subject: parsed.subject || `Re: ${sig.account_name || 'our conversation'}`,
    body: parsed.body,
    to,
    provenance: {
      grounded_in: [ 'signal', thread ? 'thread' : (sig.raw_content ? 'source message' : null) ].filter(Boolean),
      thread_messages: thread ? thread.split('\n').length : 0,
      guards: guard,
      attempts,
    },
  })
}
