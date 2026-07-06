import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { DEMO_AI_CONTEXT } from '@/lib/demo-ai-context'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages } = await req.json()

  // Demo account: answer from the showcase context block (no DB round-trip), so the
  // co-pilot's answers match exactly what is on screen.
  if (user.email === DEMO_EMAIL) {
    return runAnthropic(DEMO_AI_CONTEXT, messages)
  }

  // Fetch context: recent signals + at-risk accounts
  const [signalsRes, accountsRes] = await Promise.all([
    supabase
      .from('signals')
      .select('title, severity, account_name, source_integration, ai_analysis, created_at')
      .eq('user_id', user.id)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('accounts')
      .select('name, domain, health_score, value, stage, risk_level, last_contact_date')
      .eq('user_id', user.id)
      .limit(30),
  ])

  const signals = signalsRes.data ?? []
  const accounts = accountsRes.data ?? []

  // ---- self-extract relevant message content ----
  // Figure out which companies or terms the question refers to (account names
  // first, distinctive keywords as fallback) and pull their most recent
  // full-text messages, so the AI analyzes actual email/Slack content instead
  // of replying "not enough data".
  const lastUser = [...(messages ?? [])].reverse().find((m: { role: string; content: string }) => m.role === 'user')
  const question = String(lastUser?.content ?? '').toLowerCase()
  const nameSet = new Set<string>()
  for (const a of accounts) if (a.name && question.includes(String(a.name).toLowerCase())) nameSet.add(String(a.name))
  for (const s of signals) if (s.account_name && question.includes(String(s.account_name).toLowerCase())) nameSet.add(String(s.account_name))

  type RelMsg = { sender: string | null; subject: string | null; content: string | null; received_at: string | null; direction: string | null; integration: string | null }
  const relevantMsgs: RelMsg[] = []
  const seen = new Set<string>()
  const fetchFor = async (terms: string[]) => {
    for (const term of terms.slice(0, 3)) {
      const p = `%${term.replace(/[%_,()]/g, ' ').trim().slice(0, 60)}%`
      const { data: rows } = await supabase
        .from('messages')
        .select('sender, subject, content, received_at, direction, integration')
        .eq('user_id', user.id)
        .or(`account_name.ilike.${p},sender.ilike.${p},subject.ilike.${p}`)
        .order('received_at', { ascending: false })
        .limit(8)
      for (const r of (rows ?? []) as RelMsg[]) {
        const k = `${r.sender}|${r.received_at}`
        if (!seen.has(k)) { seen.add(k); relevantMsgs.push(r) }
      }
    }
  }
  if (nameSet.size) {
    await fetchFor(Array.from(nameSet))
  } else {
    const stop = new Set(['about', 'which', 'their', 'there', 'would', 'could', 'should', 'email', 'emails', 'gmail', 'slack', 'message', 'messages', 'analyse', 'analyze', 'recommend', 'account', 'accounts', 'signal', 'signals', 'popsicle', 'please', 'latest', 'recent', 'between', 'against', 'steps'])
    const words = Array.from(new Set((question.match(/[a-z0-9][a-z0-9&.-]{4,}/g) ?? []).filter(w => !stop.has(w)))).slice(0, 3)
    if (words.length) await fetchFor(words)
  }
  const picked = relevantMsgs
    .sort((a, b) => String(b.received_at ?? '').localeCompare(String(a.received_at ?? '')))
    .slice(0, 8)
  const msgBlock = picked.length
    ? `\n\nRELEVANT MESSAGES (full text, newest first, pulled from the user's synced data because the question mentions these companies or terms):\n${picked.map(m => `--- [${m.integration ?? '?'} ${m.direction ?? ''} ${m.received_at ? new Date(m.received_at).toLocaleDateString() : ''}] From: ${m.sender ?? '?'} | Subject: ${m.subject ?? '(none)'}\n${String(m.content ?? '').replace(/\s+/g, ' ').slice(0, 1500)}`).join('\n')}`
    : ''

  const contextBlock = `
You are Popsicle, a revenue intelligence AI assistant. You help sales and revenue teams understand their pipeline health, identify risks, and prioritize action.

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

ACTIVE ACCOUNTS (${accounts.length} total):
${accounts.map(a => `- ${a.name} | Stage: ${a.stage ?? 'unknown'} | Value: ${a.value ? '$' + a.value.toLocaleString() : 'unknown'} | Health: ${a.health_score ?? 'unknown'} | Risk: ${a.risk_level ?? 'unknown'} | Last contact: ${a.last_contact_date ?? 'never'}`).join('\n')}

RECENT SIGNALS (${signals.length} active):
${signals.map(s => `- [${s.severity?.toUpperCase() ?? 'INFO'}] ${s.title} (${s.account_name ?? 'unknown account'}, via ${s.source_integration ?? 'unknown'}) - ${new Date(s.created_at).toLocaleDateString()}`).join('\n')}${msgBlock}

Rules:
- Be specific and action-oriented. Name accounts and numbers.
- When RELEVANT MESSAGES are present, analyze their actual content directly: quote or paraphrase what was said, then give recommendations grounded in it. Do not say you lack the message.
- Never make up data not in the context above. Say "not enough data" when unsure.
- Use "at risk" not "high severity" when referring to danger signals.
- No em-dashes in your response. Use a hyphen or rewrite the sentence.
- Keep responses concise and well structured. Lead with a one-line summary, then use bullet points (start each with "- ") for lists of accounts, risks, or actions. Use **bold** for key numbers and account names. Avoid long paragraphs.
`.trim()

  return runAnthropic(contextBlock, messages)
}

// Shared Anthropic call used by both the demo and real-user paths.
async function runAnthropic(system: string, messages: { role: string; content: string }[]) {
  // Explicit check so we get a clear message instead of a silent failure
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI is not configured. Add ANTHROPIC_API_KEY in Vercel environment variables.' }, { status: 500 })
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      const msg = data?.error?.message ?? `API error (${res.status})`
      return NextResponse.json({ error: msg }, { status: 200 })
    }

    const content = data.content?.[0]?.text ?? ''
    const cleaned = content.replace(/[—–]/g, ' - ')

    return NextResponse.json({ content: cleaned })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to reach AI service'
    return NextResponse.json({ error: msg }, { status: 200 })
  }
}
