import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages } = await req.json()

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

  const contextBlock = `
You are Popsicle, a revenue intelligence AI assistant. You help sales and revenue teams understand their pipeline health, identify risks, and prioritize action.

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

ACTIVE ACCOUNTS (${accounts.length} total):
${accounts.map(a => `- ${a.name} | Stage: ${a.stage ?? 'unknown'} | Value: ${a.value ? '$' + a.value.toLocaleString() : 'unknown'} | Health: ${a.health_score ?? 'unknown'} | Risk: ${a.risk_level ?? 'unknown'} | Last contact: ${a.last_contact_date ?? 'never'}`).join('\n')}

RECENT SIGNALS (${signals.length} active):
${signals.map(s => `- [${s.severity?.toUpperCase() ?? 'INFO'}] ${s.title} (${s.account_name ?? 'unknown account'}, via ${s.source_integration ?? 'unknown'}) - ${new Date(s.created_at).toLocaleDateString()}`).join('\n')}

Rules:
- Be specific and action-oriented. Name accounts and numbers.
- Never make up data not in the context above. Say "not enough data" when unsure.
- Use "at risk" not "high severity" when referring to danger signals.
- No em-dashes in your response. Use a hyphen or rewrite the sentence.
- Keep responses concise. Use bullet points for lists of accounts or actions.
`.trim()

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
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: contextBlock,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
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
