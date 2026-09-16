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

  const { messages, stream: wantStream = false } = await req.json()

  // Demo account: answer from the showcase context block (no DB round-trip), so the
  // co-pilot's answers match exactly what is on screen.
  if (user.email === DEMO_EMAIL) {
    return runAnthropic(DEMO_AI_CONTEXT, messages, wantStream)
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
- Keep responses concise and well structured. Avoid long paragraphs.

Answer shape (follow exactly):
1. First line: a short title, under 8 words, no trailing punctuation. Example: Acme Corp, Executive Dark Period
2. Second line: TAGS: two or three short chips separated by " | ". First chip is the severity word (Critical, At risk, Watch, Healthy); others can be a figure or stage. Example: TAGS: Critical | $480K at risk
3. Then one short paragraph, two or three sentences, saying what is happening. Use **bold** for key numbers and names.
4. Then bullet points starting with "- " for the supporting evidence. When a bullet is about a specific account, write it as: - Account name | $figure | the evidence in one short sentence. Keep every bullet to one sentence.
5. Optionally a final block starting with "RECOMMENDED PLAY:" on its own line, then one or two sentences with the single best next move.
6. Optionally a line starting with "STATS:" holding up to three metric pairs separated by commas, each written as "value | label". Only use figures that appear in the context. Example: STATS: 8d | Dark period, 78% | Close probability
7. Last line: SOURCES: the integrations the answer actually drew on, comma separated, from this list only: gmail, slack, zoom, gcal, hubspot, fireflies, meet. Example: SOURCES: gmail, slack
When the question is about what to do next, write it as a playbook:
- Title it like "Acme Corp Recovery Playbook"
- Open with one sentence naming the move, with the key phrase in **bold**
- Then stage the bullets by when, each led by a short bold label and a colon: "Today:", "Tomorrow morning:", "Tomorrow afternoon:", "Backup play:"
- Each bullet is one specific instruction someone could carry out without asking a follow-up question
- Close with RECOMMENDED PLAY: the single highest-value action, phrased as an instruction, including what to say

If the question is genuinely ambiguous and a single detail would change the answer materially, do not guess. Reply with exactly one line:
CLARIFY: your one question | option one | option two | option three
Use two or three short options the person can pick. Only do this when it really matters; otherwise answer.

Use **bold** at most twice per bullet and only on the single figure or phrase that matters most: heavy bolding makes an answer unreadable.
Always label the closing block exactly "RECOMMENDED PLAY:" and never "Recommended move" or similar.
Write the play as one instruction sentence first, then at most two short supporting sentences: what to say, and when. Never pack several instructions into a single sentence.

Style: short sentences. No filler openings such as "Based on the data" or "It looks like". Never use em dashes. Never invent figures. Only list sources that genuinely appear in the context above.
`.trim()

  return runAnthropic(contextBlock, messages, wantStream)
}

// Shared Anthropic call used by both the demo and real-user paths.
async function runAnthropic(system: string, messages: { role: string; content: string }[], stream = false) {
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
        stream,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    })

    if (stream) {
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json({ error: err?.error?.message ?? `API error (${res.status})` }, { status: 200 })
      }
      // Forward only the text deltas, so the client can append as they arrive.
      const decoder = new TextDecoder()
      const out = new ReadableStream<Uint8Array>({
        async start(controller) {
          const reader = res.body!.getReader()
          let buf = ''
          try {
            for (;;) {
              const { done, value } = await reader.read()
              if (done) break
              buf += decoder.decode(value, { stream: true })
              const lines = buf.split('\n')
              buf = lines.pop() ?? ''
              for (const line of lines) {
                if (!line.startsWith('data:')) continue
                const payload = line.slice(5).trim()
                if (!payload || payload === '[DONE]') continue
                try {
                  const evt = JSON.parse(payload)
                  const text = evt?.delta?.text
                  if (typeof text === 'string' && text) {
                    controller.enqueue(new TextEncoder().encode(text.replace(/[—–]/g, '-')))
                  }
                } catch { /* partial frame */ }
              }
            }
          } finally {
            controller.close()
          }
        },
      })
      return new Response(out, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' } })
    }

    const data = await res.json()

    if (!res.ok) {
      const msg = data?.error?.message ?? `API error (${res.status})`
      return NextResponse.json({ error: msg }, { status: 200 })
    }

    const content = data.content?.[0]?.text ?? ''
    const cleaned = content.replace(/[--]/g, ' - ')

    return NextResponse.json({ content: cleaned })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to reach AI service'
    return NextResponse.json({ error: msg }, { status: 200 })
  }
}
