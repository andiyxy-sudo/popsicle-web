import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Client render failures land here. Always logged (visible in Vercel → Logs,
// filter "client-error"); also stored in client_errors when that table exists.
//   create table client_errors (id uuid primary key default gen_random_uuid(),
//     created_at timestamptz default now(), user_id uuid, path text, message text,
//     stack text, digest text, ua text);
export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }
  const rec = {
    path: String(body.path ?? ''), message: String(body.message ?? '').slice(0, 2000),
    stack: String(body.stack ?? '').slice(0, 8000), digest: body.digest ? String(body.digest) : null,
    ua: String(body.ua ?? '').slice(0, 400),
  }
  console.error('[client-error]', JSON.stringify(rec))
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getClaims()
    const userId = (data?.claims?.sub as string | undefined) ?? null
    await supabase.from('client_errors').insert({ ...rec, user_id: userId })
  } catch { /* table may not exist yet; the console line is the floor */ }
  return NextResponse.json({ ok: true })
}
