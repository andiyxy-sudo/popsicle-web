import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadMetricsData } from '@/lib/metricsData'
import { orgIdsServer } from '@/lib/org'
import { snapshotFor, type Decision } from '@/lib/decisions'

// GET  /api/decisions[?account=Acme%20Corp]  → decisions, newest first, each with its evidence snapshot
// POST /api/decisions { account, decision, owner?, due?, review_id?, source? }
//      → stores the decision with a snapshot of the evidence as it stands now, and (with an owner or a
//        due date) a tracked commitment so the follow-up shows up if it slips.
const hashText = (t: string) => { let h = 5381; for (const ch of t.toLowerCase().replace(/\s+/g, ' ').trim()) h = ((h << 5) + h + ch.charCodeAt(0)) | 0; return (h >>> 0).toString(36) }

export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get('account')
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((claims.claims.email as string | undefined) === 'demo@popsicle-labs.app') {
    const d = await import('@/lib/demo-dataset')
    return NextResponse.json({ decisions: d.DEMO_DECISIONS.filter(x => !account || x.account_name === account) })
  }
  const ids = await orgIdsServer(supabase, claims.claims.sub as string)
  let q = supabase.from('decisions').select('*').in('user_id', ids).order('created_at', { ascending: false }).limit(200)
  if (account) q = q.eq('account_name', account)
  const { data, error } = await q
  if (error) return NextResponse.json({ decisions: [], note: error.message.includes('decisions') ? 'Run supabase/migrations/20260922_decisions.sql' : error.message })
  return NextResponse.json({ decisions: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { account?: string; decision?: string; owner?: string; due?: string; review_id?: string; source?: string }
  const text = (body.decision ?? '').trim()
  if (!text) return NextResponse.json({ error: 'A decision needs some words.' }, { status: 400 })
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { accts, sigs, now, demo } = await loadMetricsData(supabase, claims.claims as Record<string, unknown>)
  const evidence = body.account ? snapshotFor(body.account, accts, sigs, now) : { capturedAt: new Date(now).toISOString(), figures: {}, signals: [] }
  const due = body.due ? new Date(body.due.length <= 10 ? body.due + 'T09:00:00' : body.due).toISOString() : null
  const base = { account_name: body.account ?? null, decision: text, owner: body.owner?.trim() || null, due_at: due, status: 'open' as const, source: body.source ?? 'review', review_id: body.review_id ?? null, evidence }

  if (demo) {
    // the demo account can't write; the client keeps this for the session
    const d: Decision = { ...base, id: `demo-dec-${Date.now()}`, created_at: new Date().toISOString(), by: 'You' }
    return NextResponse.json({ decision: d, demo: true })
  }
  const uid = claims.claims.sub as string
  let commitment_id: string | null = null
  if (base.owner || due) {
    const { data: c } = await supabase.from('commitments').insert({
      user_id: uid, account_name: base.account_name, text, text_hash: hashText(text), owner: base.owner, due_at: due,
      promised_at: new Date().toISOString(), source: 'review', status: 'open', backfilled: false,
    }).select('id').maybeSingle()
    commitment_id = (c as { id?: string } | null)?.id ?? null
  }
  const { data, error } = await supabase.from('decisions').insert({ ...base, user_id: uid, commitment_id }).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message.includes('decisions') ? 'Decisions need a one-time setup: run supabase/migrations/20260922_decisions.sql' : error.message }, { status: 500 })
  return NextResponse.json({ decision: data })
}
