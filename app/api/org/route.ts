import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET  → the caller's organisation: name, their role, the members with emails.
// POST → { action: 'rename', name } | { action: 'role', userId, role } | { action: 'remove', userId }
//        Admins only for every write. A removed member gets an org of their own back.
type Member = { user_id: string; role: string; email?: string; name?: string; created_at?: string }

async function loadOrg() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return { error: 'Unauthorized' as const, status: 401, supabase: null, me: '', org: null as null | { id: string; name: string; owner_id: string | null }, myRole: '' }
  const me = claims.claims.sub as string
  const { data: mine } = await supabase.from('org_members').select('org_id, role').eq('user_id', me).maybeSingle()
  if (!mine) return { error: null, status: 200, supabase, me, org: null, myRole: '' }
  const { data: org } = await supabase.from('orgs').select('id, name, owner_id').eq('id', mine.org_id).maybeSingle()
  return { error: null, status: 200, supabase, me, org: org as { id: string; name: string; owner_id: string | null } | null, myRole: mine.role as string }
}

export async function GET() {
  const { error, status, supabase, me, org, myRole } = await loadOrg()
  if (error || !supabase) return NextResponse.json({ error }, { status })
  if (!org) return NextResponse.json({ org: null, members: [], myRole: '', me })
  const { data: rows } = await supabase.from('org_members').select('user_id, role, created_at').eq('org_id', org.id)
  const members: Member[] = (rows ?? []) as Member[]
  try {
    const { data: profiles } = await supabase.from('user_emails').select('id, email, name').in('id', members.map(m => m.user_id))
    const byId = new Map(((profiles ?? []) as Array<{ id: string; email?: string; name?: string }>).map(p => [p.id, p]))
    for (const m of members) { const p = byId.get(m.user_id); if (p) { m.email = p.email; m.name = p.name } }
  } catch { /* view optional until the admin migration runs */ }
  return NextResponse.json({ org, members, myRole, me })
}

export async function POST(req: Request) {
  const { error, status, supabase, me, org, myRole } = await loadOrg()
  if (error || !supabase) return NextResponse.json({ error }, { status })
  if (!org) return NextResponse.json({ error: 'no_org' }, { status: 400 })
  if (myRole !== 'admin') return NextResponse.json({ error: 'admin_only' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { action?: string; name?: string; userId?: string; role?: string }

  if (body.action === 'rename' && body.name?.trim()) {
    const { error: e } = await supabase.from('orgs').update({ name: body.name.trim() }).eq('id', org.id)
    return NextResponse.json({ ok: !e, error: e?.message ?? null })
  }
  if (body.action === 'role' && body.userId && ['admin', 'member', 'viewer'].includes(String(body.role))) {
    if (body.userId === org.owner_id) return NextResponse.json({ error: 'The owner is always an admin.' }, { status: 400 })
    const { error: e } = await supabase.from('org_members').update({ role: body.role }).eq('org_id', org.id).eq('user_id', body.userId)
    return NextResponse.json({ ok: !e, error: e?.message ?? null })
  }
  if (body.action === 'remove' && body.userId) {
    if (body.userId === org.owner_id) return NextResponse.json({ error: 'The owner cannot be removed.' }, { status: 400 })
    if (body.userId === me) return NextResponse.json({ error: 'You cannot remove yourself.' }, { status: 400 })
    const { error: e } = await supabase.rpc('remove_org_member', { target: body.userId })
    return NextResponse.json({ ok: !e, error: e?.message ?? null })
  }
  return NextResponse.json({ error: 'bad_request' }, { status: 400 })
}
