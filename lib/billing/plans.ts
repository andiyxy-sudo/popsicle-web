// The plan catalogue: one place, used by the billing panel, the limits and (later) the checkout.
// Popsicle charges a flat fee per company. Users are never capped: the band is set by how much
// Popsicle reads and raises (Concerns per month) and which sources it reads.
export type PlanId = 'trial' | 'starter' | 'growth' | 'pro' | 'enterprise'

export interface Plan {
  id: PlanId
  name: string
  price: number | null           // monthly USD; 0 = free, null = "talk to us"
  priceText: string
  tagline: string
  concerns: number | null        // Concerns included per month; null = agreed per deal
  concernsText: string
  sourcesText: string
  teamGuide: string              // a RECOMMENDATION shown on the card; users are never capped
  features: string[]
  soon?: string[]                // named here are honest 'Soon' items, shown with a tag
  available?: string             // when the plan itself is not open yet, e.g. 'Coming in H1 2027'
  selfServe: boolean
}

export const PLANS: Plan[] = [
  { id: 'trial', name: 'Trial', price: 0, priceText: 'Free', tagline: 'Try it for 14 days',
    concerns: 300, concernsText: '300 Concerns', sourcesText: '2 sources · for 14 days', teamGuide: 'Any team size',
    selfServe: true,
    features: ['Everything in Growth', 'No card, no sales call', 'Finds risk in your last 30 days'] },
  { id: 'starter', name: 'Starter', price: 499, priceText: '$499', tagline: 'For one team',
    concerns: 1000, concernsText: '1,000 Concerns', sourcesText: '2 sources · per month', teamGuide: '5 to 10 people',
    selfServe: true,
    features: ['Flags what puts revenue at risk', 'Shows the message behind every flag', 'Drafts the reply and takes the action once you approve'] },
  { id: 'growth', name: 'Growth', price: 1999, priceText: '$1,999', tagline: 'For a whole revenue team',
    concerns: 5000, concernsText: '5,000 Concerns', sourcesText: 'Every source · per month', teamGuide: '10 to 25 people',
    selfServe: true,
    features: ['Everything in Starter, on every channel', 'A daily briefing in Slack', 'Reviews, meeting prep and reminders'] },
  { id: 'pro', name: 'Pro', price: 3999, priceText: '$3,999', tagline: 'For several teams',
    concerns: 12000, concernsText: '12,000 Concerns', sourcesText: 'Every source · per month', teamGuide: '25 to 100 people',
    selfServe: false,
    available: 'Coming H1 2027',
    features: ['Everything in Growth', 'See how each rep is doing', 'Guided setup and a quarterly review'],
    soon: [] },
  { id: 'enterprise', name: 'Enterprise', price: null, priceText: 'From $8,000', tagline: 'For the whole company',
    concerns: null, concernsText: 'Agreed with you', sourcesText: 'Every source', teamGuide: '100+ people',
    selfServe: false,
    available: 'Coming H1 2027',
    features: ['Everything in Pro', 'Single sign-on, audit log, admin controls', 'Security review and signed agreement'],
    soon: [] },
]

export const planOf = (id?: string | null) => PLANS.find(p => p.id === id) ?? null
export const PAID_PLANS = PLANS.filter(p => p.id !== 'trial')
