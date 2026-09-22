import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

// POST { confirm: 'DELETE' } → permanently removes everything this user has put into Popsicle:
// their accounts, signals, commitments, decisions, connected sources, Slack channel choices and briefing
// settings, and their place in the organisation. Teammates' own data is untouched. The sign-in itself
// remains, so they can start again. The demo account can't be deleted.
const TABLES = ['signals', 'commitments', 'decisions', 'slack_tracked_channels', 'slack_digests', 'integrations', 'accounts', 'org_members']

export async function POST(req: NextRequest) {
  const { confirm } = await req.json().catch(() => ({})) as { confirm?: string }
  if (confirm !== 'DELETE') return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 })
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((claims.claims.email as string | undefined) === 'demo@popsicle-labs.app') return NextResponse.json({ error: 'The demo workspace can\u2019t be deleted.' }, { status: 400 })
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return NextResponse.json({ error: 'Deletion isn\u2019t configured on the server (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 500 })
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const uid = claims.claims.sub as string
  const removed: Record<string, number | string> = {}
  for (const t of TABLES) {
    const { error, count } = await admin.from(t).delete({ count: 'exact' }).eq('user_id', uid)
    removed[t] = error ? (/does not exist|relation/.test(error.message) ? 'n/a' : `error: ${error.message}`) : (count ?? 0)
  }
  const failed = Object.entries(removed).filter(([, v]) => typeof v === 'string' && v.startsWith('error'))
  if (failed.length) return NextResponse.json({ error: `Some data couldn\u2019t be removed: ${failed.map(([t]) => t).join(', ')}. Nothing else changed; try again or contact support.`, removed }, { status: 500 })
  return NextResponse.json({ ok: true, removed })
}
