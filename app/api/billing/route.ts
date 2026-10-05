import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PROVIDER, type Subscription } from '@/lib/billing/provider'

// GET /api/billing → what this workspace is on today. While no payment provider is connected, every
// workspace reads as a design partner (free, with an end date) or beta, which is the truth.
export async function GET() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const meta = (claims.claims.user_metadata ?? {}) as Record<string, unknown>
  const billing = (meta.billing ?? {}) as Partial<Subscription> & { endsAt?: string }

  // the demo workspace shows a working subscription, with usage drawn from its own signals
  const isDemo = String(claims.claims.email ?? '').toLowerCase() === 'demo@popsicle-labs.app'
  if (isDemo) {
    const used = 576                      // Concerns raised this month in the demo company (47 of them still open)
    const renews = new Date('2026-10-14T00:00:00Z')
    return NextResponse.json({
      plan: 'growth', status: 'active', seatsUsed: 3, seatsIncluded: null,
      renewsAt: renews.toISOString(), amount: 1999,
      invoiceEmail: 'billing@popsicle-labs.app', paymentMethod: 'Visa ending 4417',
      concernsUsed: used, sourcesUsed: 4, provider: PROVIDER,
    })
  }

  // The plan is the ORG's (orgs.plan, read through entitlements), the one source of truth shared with the
  // phone. user_metadata.billing only still supplies payment details, until a payment provider is connected.
  const { data: entRaw } = await supabase.rpc('entitlements')
  const ent = (entRaw ?? {}) as { plan?: string; paid?: boolean; concerns_this_period?: number; sources_used?: number; resets_on?: string }
  const { count } = await supabase.from('org_members').select('id', { count: 'exact', head: true })
  const seatsUsed = count ?? 1
  const plan = String(ent.plan ?? billing.plan ?? 'free')

  const sub: Subscription = {
    plan,
    status: plan === 'design_partner' ? 'design_partner' : ent.paid ? ((billing.status as Subscription['status']) ?? 'active') : 'none',
    seatsUsed,
    seatsIncluded: billing.seatsIncluded ?? null,
    renewsAt: ent.paid ? (billing.renewsAt ?? billing.endsAt ?? null) : (ent.resets_on ?? null),
    amount: billing.amount ?? null,
    invoiceEmail: (billing.invoiceEmail as string) ?? (claims.claims.email as string) ?? null,
    paymentMethod: (billing.paymentMethod as string) ?? null,
    concernsUsed: ent.concerns_this_period ?? 0,   // this billing period, excluding Concerns the engine never raised
    sourcesUsed: ent.sources_used ?? 0,            // calendars excluded, as the limit counts them
    provider: PROVIDER,
  }
  return NextResponse.json(sub)
}

// POST /api/billing { plan, mode: 'checkout' | 'invoice' }
// With a provider connected this starts checkout. Without one it records the interest and tells the truth.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { plan, mode } = await req.json().catch(() => ({}))
  if (!plan) return NextResponse.json({ error: 'no_plan' }, { status: 400 })

  if (PROVIDER === 'none') {
    await supabase.from('feedback').insert({
      user_id: user.id, kind: 'billing_interest',
      message: `Wants ${mode === 'invoice' ? 'an invoice for' : 'to buy'} the ${plan} plan`,
    }).select().maybeSingle()
    return NextResponse.json({ ok: true, provider: 'none', recorded: true,
      message: mode === 'invoice'
        ? 'Noted. We will send an invoice by email; nothing is charged automatically.'
        : 'Noted. Card payment is not switched on yet, so we will follow up by email to set this up.' })
  }
  // Stripe or Paddle: create the session here and return its URL.
  return NextResponse.json({ error: 'provider_not_implemented', provider: PROVIDER }, { status: 501 })
}
