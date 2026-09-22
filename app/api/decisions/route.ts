import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadMetricsData } from '@/lib/metricsData'
import { orgIdsServer } from '@/lib/org'
import { snapshotFor, type Decision } from '@/lib/decisions'

// GET  /api/decisions[?account=Acme%20Corp]  → decisions, newest first, each with its evidence snapshot
// POST /api/decisions { account, decision, owner?, due?, review_id?, source? }
//      → stores the decision with a snapshot of the evidence as it stands now, and (with an owner or a
//        due date) a tracked commitment so the follow-up shows up if it slips.

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
  const setupHint = (m: string) => /relation .*decisions|decisions.* does not exist/i.test(m) ? 'Decisions need a one-time setup: run supabase/migrations/20260922_decisions.sql' : m

  // With an owner or a due date, the follow-up is also tracked as a commitment. On commitments, `owner`
  // records WHO MADE the promise ('us' | 'them' | 'unattributed'): a decision's follow-up is ours, so 'us'.
  // The named person stays on decisions.owner. `text_hash` is a generated column (never send it) and
  // `source` accepts 'call' | 'manual'. Every insert is checked; nothing reports success unless it saved.
  let commitment_id: string | null = null
  if (base.owner || due) {
    const { data: c, error: cErr } = await supabase.from('commitments').insert({
      user_id: uid, account_name: base.account_name, text, owner: 'us', due_at: due,
      promised_at: new Date().toISOString(), source: 'manual', status: 'open', backfilled: false,
    }).select('id').single()
    if (cErr || !c) return NextResponse.json({ error: `Couldn\u2019t save the follow-up commitment: ${cErr?.message ?? 'no row returned'}` }, { status: 500 })
    commitment_id = (c as { id: string }).id
  }

  const { data, error } = await supabase.from('decisions').insert({ ...base, user_id: uid, commitment_id }).select('*').single()
  if (error || !data) {
    // don't leave an orphan commitment behind a decision that didn't save
    if (commitment_id) await supabase.from('commitments').delete().eq('id', commitment_id)
    return NextResponse.json({ error: `Couldn\u2019t save the decision: ${setupHint(error?.message ?? 'no row returned')}` }, { status: 500 })
  }
  return NextResponse.json({ decision: data })
}

// PATCH { id, status } → mark a decision open, done or reversed (organisation members can update)
export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json().catch(() => ({})) as { id?: string; status?: string }
  if (!id || !['open', 'done', 'reversed'].includes(status ?? '')) return NextResponse.json({ error: 'Need an id and a status of open, done or reversed.' }, { status: 400 })
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((claims.claims.email as string | undefined) === 'demo@popsicle-labs.app' || id.startsWith('demo-')) return NextResponse.json({ ok: true, demo: true })
  const { data, error } = await supabase.from('decisions').update({ status }).eq('id', id).select('id, status').maybeSingle()
  if (error || !data) return NextResponse.json({ error: `Couldn\u2019t update the decision: ${error?.message ?? 'not found or not allowed'}` }, { status: 500 })
  return NextResponse.json({ ok: true, decision: data })
}
