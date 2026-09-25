// A thin seam between the product and whoever takes the money. Today no provider is configured, so the
// product says so honestly instead of pretending. When Stripe or Paddle is chosen, only this file and one
// environment variable change: the panel, the plans and the limits stay exactly as they are.
export type ProviderId = 'none' | 'stripe' | 'paddle'

export const PROVIDER: ProviderId = (process.env.NEXT_PUBLIC_BILLING_PROVIDER as ProviderId) || 'none'
export const providerReady = () => PROVIDER !== 'none'

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  none: 'not connected yet', stripe: 'Stripe', paddle: 'Paddle',
}

export interface Subscription {
  plan: string                  // a PlanId, or 'design_partner', or 'beta'
  status: 'active' | 'trialing' | 'design_partner' | 'past_due' | 'cancelled' | 'none'
  seatsUsed: number
  seatsIncluded: number | null
  renewsAt: string | null       // ISO
  amount: number | null         // monthly USD
  invoiceEmail: string | null
  paymentMethod: string | null  // "Visa ending 4417", never a full number
  concernsUsed: number          // raised so far this month
  sourcesUsed: number           // channels currently connected
  provider: ProviderId
}
