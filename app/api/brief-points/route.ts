// Pre-meeting talking points (mobile item 19), guards over prompts:
// - grounding corpus = signals + commitments + recent thread shown to the model
// - per-point digit guard (any number not in the corpus kills that point)
// - internal-deliberation blocklist kills the point (customer-safe phrasing only)
// - dedupe on normalized text
// Failing points are dropped silently; zero survivors -> empty list (client hides
// the section). Never a fabricated point, never an error state for optional content.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DELIBERATION = [
  /\b(our|the|this) (signal|signals|analysis|monitoring|system|model|detector|detection|alert)\b/i,
  /\bwe (noticed|detected|flagged|scored|classified)\b/i,
  /\b(risk|health) (score|flag|level)\b/i,
  /\b(churn|deal) risk\b/i,
  /\binternal(ly)?\b/i,
  /\bdo not repeat\b/i,
  /\bsentiment\b/i,
]

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ points: [] })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { account } = await req.json().catch(() => ({}))
  if (!account || typeof account !== 'string') return NextResponse.json({ points: [] })

  const [sigs, cms, msgs] = await Promise.all([
    supabase.from('signals').select('title, description, severity, ai_analysis')
      .eq('user_id', user.id).eq('account_name', account).eq('is_dismissed', false)
      .or('status.is.null,status.eq.open').order('surfaced_at', { ascending: false }).limit(4),
    supabase.from('commitments').select('text, owner, due_at').eq('user_id', user.id)
      .eq('account_name', account).eq('status', 'open').limit(5),
    supabase.from('messages').select('sender, subject, content, direction')
      .eq('user_id', user.id).eq('account_name', account)
      .order('received_at', { ascending: false }).limit(6),
  ])

  const ctx: string[] = [`Account: ${account}`]
  for (const sg of (sigs.data ?? [])) {
    const ai = (sg.ai_analysis ?? {}) as { summary?: string; quote?: string }
    ctx.push(`SIGNAL (${sg.severity}): ${sg.title}. ${sg.description ?? ''} ${ai.quote ? `Quote: "${ai.quote}"` : ''} [INTERNAL CONTEXT - never reference how this was learned]`)
  }
  for (const c of (cms.data ?? [])) ctx.push(`COMMITMENT (${c.owner === 'us' ? 'we promised' : c.owner === 'them' ? 'they promised' : 'promised'}): ${c.text}${c.due_at ? ` due ${new Date(c.due_at).toDateString()}` : ''}`)
  for (const m of (msgs.data ?? [])) ctx.push(`MSG (${m.direction ?? '?'}) ${m.sender ?? ''}: ${m.subject ?? ''} - ${String(m.content ?? '').slice(0, 400)}`)
  if (ctx.length <= 1) return NextResponse.json({ points: [] })

  const system = [
    'You prepare a seller for a customer meeting. From the material, produce up to 3 talking points.',
    'Each point: ONE sentence, phrased so it could be said to the customer directly.',
    'Never reference analysis, monitoring, detection, or how anything was learned.',
    'Use only facts present in the material. No invented numbers, dates, names.',
    'Return strict JSON: {"points": ["...", "..."]} and nothing else.',
  ].join('\n')

  const corpus = ctx.join('\n') + '\n' + system
  const grounded = new Set(corpus.match(/\d+/g) ?? [])
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 15_000)
    const aResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 400, system, messages: [{ role: 'user', content: ctx.join('\n') }] }),
      signal: controller.signal,
    })
    clearTimeout(t)
    if (!aResp.ok) return NextResponse.json({ points: [] })
    const aJson = await aResp.json()
    const raw = (aJson.content?.[0]?.text ?? '').trim()
    const m = raw.match(/\{[\s\S]*\}/)
    const parsed = m ? JSON.parse(m[0]) : {}
    const seen = new Set<string>()
    const points: string[] = []
    for (const pt of (Array.isArray(parsed.points) ? parsed.points : [])) {
      const text = String(pt).trim()
      if (!text || text.length > 220) continue
      if ((text.match(/\d+/g) ?? []).some(d => !grounded.has(d))) continue      // digit guard
      if (DELIBERATION.some(r => r.test(text))) continue                        // deliberation guard
      const norm = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').slice(0, 60)   // dedupe
      if (seen.has(norm)) continue
      seen.add(norm)
      points.push(text)
      if (points.length >= 3) break
    }
    return NextResponse.json({ points })
  } catch {
    return NextResponse.json({ points: [] })
  }
}
