// The demo workspace's Actions page. Every item is tied to a Concern in lib/demo-dataset.ts, so clicking
// through lands on the Concern that produced it, and the people and accounts match the rest of the demo.
// Buyer-facing actions wait for approval; internal ones show as already done. That is the product's rule
// (anything that leaves the company needs a person, unless Sending is set to "without you").
import { DEMO_NOW } from '@/lib/demo-dataset'

export type DemoDraft = {
  id: string; signal: string
  kind: string                     // what it is: Comparison, Redline, Meeting invite, Follow-up
  due: string; overdue: boolean    // "2d over", "5d late", "Due today", "From Concern"
  title: string
  to: string; role: string; account: string; via: string
  body: string
}
export type DemoAuto = { id: string; signal: string; what: string; detail: string; at: string }

const ago = (hours: number) => new Date(DEMO_NOW - hours * 3600e3).toISOString()

export const DEMO_DRAFTS: DemoDraft[] = [
  { id: 'da-1', signal: 'demo-sg-19', kind: 'Comparison', due: '2d over', overdue: true,
    title: 'Send the Gong comparison and security whitepaper to Sarah Chen',
    to: 'Sarah Chen', role: 'CFO', account: 'Acme Corp', via: 'gmail',
    body: 'As promised, here are the Gong comparison and our security whitepaper. Happy to walk your finance team through the new pricing structure whenever suits you this week.' },
  { id: 'da-2', signal: 'demo-sg-35', kind: 'Redline', due: '5d late', overdue: true,
    title: 'Send the pre-approved redline to Rachel Voss',
    to: 'Rachel Voss', role: 'Procurement', account: 'Axion Partners', via: 'slack',
    body: 'Here is the pre-approved redline. Sorry this took longer than promised. Let me know if legal needs anything else before the PO.' },
  { id: 'da-3', signal: 'demo-sg-38', kind: 'Meeting invite', due: 'Due today', overdue: false,
    title: 'Book a legal check-in with Dana Kim ahead of the Jan 28 close',
    to: 'Dana Kim', role: 'Legal', account: 'Vertex Systems', via: 'gmail',
    body: 'Could we book a short legal check-in ahead of the Jan 28 close? I have sent a few times that work for us. Happy to bring our counsel so nothing waits on a second round.' },
  { id: 'da-4', signal: 'demo-sg-21', kind: 'Follow-up', due: 'From Concern', overdue: false,
    title: 'Follow up with Sarah Chen on the pricing questions',
    to: 'Sarah Chen', role: 'CFO', account: 'Acme Corp', via: 'gmail',
    body: 'I know finance has questions on the new pricing structure. Would 20 minutes this week help? I can bring the numbers your team needs to commit.' },
]

export const DEMO_AUTO: DemoAuto[] = [
  { id: 'au-1', signal: 'demo-sg-1', what: 'Manager alerted', detail: 'Acme Corp: exec gone dark 8 days', at: ago(4) },
  { id: 'au-2', signal: 'demo-sg-25', what: 'Team notified', detail: 'Slack: rival vendor named in #meridian-renewal', at: ago(3) },
  { id: 'au-3', signal: 'demo-sg-34', what: 'CRM updated', detail: 'HubSpot: next step logged on Axion Partners', at: ago(8) },
  { id: 'au-4', signal: 'demo-sg-17', what: 'Reminder set', detail: 'Vertex Systems: proposal opened 5x, owner nudged to set a next step', at: ago(26) },
]
