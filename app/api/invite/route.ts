import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

// POST { email, role }  → sends a Supabase invite email when SUPABASE_SERVICE_ROLE_KEY is
// set (auth.admin.inviteUserByEmail), and records the invite in team_invites either way.
// GET → pending invites for this user.
//   create table team_invites (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
//     invited_by uuid, email text, role text, status text default 'pending');
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = claims.claims.sub as string
  const meEmail = (claims.claims.email as string | undefined) ?? ''
  const body = await req.json().catch(() => ({})) as { email?: string; role?: string }
  const email = String(body.email ?? '').trim().toLowerCase()
  const role = ['admin', 'member', 'viewer'].includes(String(body.role)) ? String(body.role) : 'member'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  if (meEmail === 'demo@popsicle-labs.app') return NextResponse.json({ ok: true, sent: false, demo: true })

  let sent = false, sendError: string | null = null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && key) {
    const admin = createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { data: { invited_by: me, role }, redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/welcome` })
    if (error) sendError = error.message; else sent = true
  }
  try { await supabase.from('team_invites').insert({ invited_by: me, email, role, status: sent ? 'sent' : 'pending' }) } catch { /* table optional */ }
  return NextResponse.json({ ok: true, sent, error: sendError, note: !url || !key ? 'No SUPABASE_SERVICE_ROLE_KEY on the server: invite recorded, email not sent.' : null })
}

export async function GET() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase.from('team_invites').select('id, email, role, status, created_at').eq('invited_by', claims.claims.sub as string).order('created_at', { ascending: false }).limit(20)
  return NextResponse.json({ invites: data ?? [] })
}
