// Demo dataset, transcribed from the Popsicle mobile app so the web demo tells
// exactly the same story. Figures, names, quotes and dates are verbatim.
import type { Account, Signal } from '@/types'

const now = Date.now()
const iso = (h: number) => new Date(now - h * 3600000).toISOString()
const at = (m: number, d: number) => new Date(2026, m - 1, d).toISOString()

// ---------------------------------------------------------------- accounts
type Extra = {
  contact_name: string
  trend: string
  repScore: number
  expiry: string
  flags: string[]
  breakdown: Array<{ k: string; v: number }>
  statusNote?: string
}
export const DEMO_EXTRA: Record<string, Extra> = {
  'Acme Corp': {
    contact_name: 'Sarah Chen', trend: '+12%', repScore: 74, expiry: 'Dec 31',
    flags: ['Exec Unresponsive', '8d Dark', 'Champion at Risk'],
    breakdown: [{ k: 'Engagement', v: 32 }, { k: 'Product Fit', v: 88 }, { k: 'Legal', v: 45 }, { k: 'Financial', v: 58 }],
  },
  'Nexus AI': {
    contact_name: 'Marcus Webb', trend: '+8%', repScore: 91, expiry: 'Jan 15',
    flags: ['Legal Clearing', 'PO Expected'], statusNote: 'On track',
    breakdown: [{ k: 'Engagement', v: 91 }, { k: 'Product Fit', v: 95 }, { k: 'Legal', v: 72 }, { k: 'Financial', v: 96 }],
  },
  'TechFlow Inc': {
    contact_name: 'Jamie Torres', trend: '-3%', repScore: 61, expiry: 'Feb 01',
    flags: ['Price Flinch', 'Finance Review'],
    breakdown: [{ k: 'Engagement', v: 48 }, { k: 'Product Fit', v: 72 }, { k: 'Legal', v: 30 }, { k: 'Financial', v: 55 }],
  },
  'Meridian Labs': {
    contact_name: 'Alex Park', trend: '+22%', repScore: 68, expiry: 'Mar 30',
    flags: ['Timeline Slip'],
    breakdown: [{ k: 'Engagement', v: 55 }, { k: 'Product Fit', v: 82 }, { k: 'Legal', v: 15 }, { k: 'Financial', v: 78 }],
  },
  'Brightwave': {
    contact_name: 'Andy G', trend: '+9%', repScore: 84, expiry: 'Feb 10',
    flags: ['Buyer Active', 'Onboarding Interest'], statusNote: 'Re-engaged',
    breakdown: [{ k: 'Engagement', v: 86 }, { k: 'Product Fit', v: 90 }, { k: 'Legal', v: 78 }, { k: 'Financial', v: 88 }],
  },
  'Axion Partners': {
    contact_name: 'Andy G', trend: '-9%', repScore: 41, expiry: 'Feb 28',
    flags: ['Legal Blocker', '+3-5 Weeks'],
    breakdown: [{ k: 'Engagement', v: 40 }, { k: 'Product Fit', v: 74 }, { k: 'Legal', v: 40 }, { k: 'Financial', v: 62 }],
  },
  'TechVault Inc': {
    contact_name: 'Mike Ross', trend: '-2%', repScore: 58, expiry: 'Mar 15',
    flags: ['Budget Concern', 'Finance Review'],
    breakdown: [{ k: 'Engagement', v: 48 }, { k: 'Product Fit', v: 76 }, { k: 'Legal', v: 70 }, { k: 'Financial', v: 44 }],
  },
  'Cobalt Health': {
    contact_name: 'Jamie Torres', trend: '+14%', repScore: 95, expiry: 'Closed Dec 20',
    flags: ['Contract Signed', 'Onboarding Started'], statusNote: 'Onboarding',
    breakdown: [{ k: 'Engagement', v: 94 }, { k: 'Product Fit', v: 96 }, { k: 'Legal', v: 100 }, { k: 'Financial', v: 100 }],
  },
}

const A = (id: string, name: string, domain: string, value: number, stage: string, owner: string,
  risk: 'high' | 'medium' | 'low', health: number, close: string, lastContactHours: number, tags: string[]): Account =>
  ({ id, name, domain, health_score: health, value, stage, owner, risk_level: risk,
     close_date: close, last_contact_date: iso(lastContactHours), tags, user_id: 'demo', created_at: iso(4000) }) as Account

export const DEMO_ACCOUNTS: Account[] = [
  A('demo-acme', 'Acme Corp', 'acmecorp.com', 480000, 'Negotiation', 'Sarah Chen', 'high', 74, at(12, 31), 192, ['Exec Unresponsive', '8d Dark', 'Champion at Risk']),
  A('demo-meridian', 'Meridian Labs', 'meridianlabs.com', 850000, 'Discovery', 'Alex Park', 'medium', 68, at(3, 30), 120, ['Timeline Slip']),
  A('demo-nexus', 'Nexus AI', 'nexus.ai', 320000, 'Closing', 'Marcus Webb', 'low', 91, at(1, 15), 20, ['Legal Clearing', 'PO Expected']),
  A('demo-techflow', 'TechFlow Inc', 'techflow.com', 210000, 'Proposal', 'Jamie Torres', 'medium', 61, at(2, 1), 72, ['Price Flinch', 'Finance Review']),
  A('demo-brightwave', 'Brightwave', 'brightwave.io', 180000, 'Closing', 'Andy G', 'low', 84, at(2, 10), 30, ['Buyer Active', 'Onboarding Interest']),
  A('demo-axion', 'Axion Partners', 'axionpartners.com', 95000, 'Negotiation', 'Andy G', 'high', 41, at(2, 28), 24, ['Legal Blocker', '+3-5 Weeks']),
  A('demo-techvault', 'TechVault Inc', 'techvault.com', 140000, 'Proposal', 'Mike Ross', 'medium', 58, at(3, 15), 72, ['Budget Concern', 'Finance Review']),
  A('demo-cobalt', 'Cobalt Health', 'cobalthealth.com', 150000, 'Closed Won', 'Jamie Torres', 'low', 95, at(12, 20), 48, ['Contract Signed', 'Onboarding Started']),
]

// ---------------------------------------------------------------- signals
const S = (id: string, account: string, type: string, sev: 'high' | 'watch' | 'positive',
  title: string, description: string, src: string, hours: number, risk: number | null,
  conf: number, quote?: string, rec?: string): Signal =>
  ({ id, account_id: null, account_name: account, signal_type: type, severity: sev, title, description,
     source_integration: src, risk_amount: risk, created_at: iso(hours), is_dismissed: false,
     ai_analysis: { confidence: conf, ...(quote ? { quote } : {}), ...(rec ? { recommendation: rec } : {}) } }) as unknown as Signal

export const DEMO_SIGNALS: Signal[] = [
  S('demo-sg-1', 'Acme Corp', 'silent_stall', 'high', 'Exec gone dark 8 days',
    'Sarah Chen (CFO) stopped responding to all outreach. Last email opened but no reply. Escalation risk rising.',
    'gmail', 4, 480000, 91, undefined, 'Switch channel: record a short video for the CRO before Friday'),
  S('demo-sg-2', 'Acme Corp', 'price_flinch', 'high', 'CFO flagged pricing concern',
    'CFO flagged pricing concern in the last call. Finance loop-in may add 3-4 weeks.',
    'gmail', 48, 480000, 87, 'We need to discuss the new pricing structure before we can commit to renewal. Finance team has concerns.',
    'Send the side-by-side comparison against their current Gong contract'),
  S('demo-sg-3', 'Acme Corp', 'legal_loopin', 'watch', 'Legal review requested',
    'Contract redlines sent, awaiting response since Nov 14.', 'gmail', 96, 480000, 78, undefined,
    'Chase Rachel Kim directly, escalate through Sarah Chen if no reply by Thursday'),
  S('demo-sg-4', 'Acme Corp', 'champion_change', 'high', 'Champion at risk',
    'Internal champion removed from latest email thread. Possible loss of internal backing.',
    'gmail', 96, 480000, 83, undefined, 'Re-engage James Park directly and confirm he is still sponsoring'),
  S('demo-sg-5', 'Acme Corp', 'call_buying_signal', 'positive', 'VP Eng confirmed technical fit',
    'VP Eng confirmed technical fit. Integration team standing by.', 'slack', 100, null, 92,
    'Technical integration looks solid. My team is ready to proceed once legal signs off.', undefined),
  S('demo-sg-6', 'Nexus AI', 'reengaged', 'positive', 'Champion re-engaged after break',
    'Champion re-engaged after holiday break. Strong buying intent signals across 3 channels.',
    'gmail', 20, null, 94, 'We are very close to signing. Just waiting on legal to clear the last two redlines.',
    'Lock the signature date this week'),
  S('demo-sg-7', 'Nexus AI', 'call_commitment', 'positive', 'Procurement confirmed budget approved',
    'Procurement confirmed budget approved. PO expected this week.', 'hubspot', 26, null, 90, undefined, undefined),
  S('demo-sg-8', 'Nexus AI', 'legal_loopin', 'watch', 'Legal review the only blocker',
    'Legal review is the only remaining blocker. Standard NDA redlines outstanding.', 'gmail', 30, null, 81,
    'Two clauses outstanding - data residency and liability cap. We will have edits by Thursday.', undefined),
  S('demo-sg-9', 'Meridian Labs', 'timeline_slip', 'watch', 'Renewal timeline pushed from Q1 to Q2',
    'Renewal timeline pushed from Q1 to Q2.', 'gmail', 8, 850000, 84, undefined,
    'Confirm the real date with Alex Park before forecasting it'),
  S('demo-sg-10', 'Meridian Labs', 'competitor_mention', 'high', 'CEO mentioned looking at alternatives',
    'CEO mentioned "looking at alternatives" in Slack.', 'slack', 10, 850000, 88,
    'looking at alternatives', 'Send the comparison one-pager and book an exec call'),
  S('demo-sg-11', 'Meridian Labs', 'call_sentiment_drop', 'watch', 'Product usage declined 18% MoM',
    'Product usage declined 18% month over month.', 'hubspot', 30, 850000, 79, undefined, 'Book an exec call'),
  S('demo-sg-12', 'TechFlow Inc', 'price_flinch', 'watch', 'CFO mentioned need to check with finance',
    'CFO mentioned "need to check with finance" on the Zoom discovery call.', 'zoom', 6, 210000, 86,
    'need to check with finance', 'Share the ROI sheet before their finance review'),
  S('demo-sg-13', 'Axion Partners', 'silent_stall', 'watch', 'Legal review stalled at day 3',
    'Legal review stalled at day 3. Auto-escalation triggers at day 5.', 'gmail', 12, 95000, 80, undefined,
    'Escalate now rather than waiting for day 5'),
  S('demo-sg-14', 'TechVault Inc', 'price_flinch', 'watch', 'Price flinch on WhatsApp',
    'Buyer raised budget concern on WhatsApp, 48h with no reply since.', 'gmail', 40, 140000, 77, undefined,
    'Share the ROI sheet'),
  S('demo-sg-15', 'Brightwave', 'reengaged', 'positive', 'Buyer active again after silence',
    'Buyer re-engaged and asked about onboarding timelines.', 'gmail', 30, null, 89, undefined, 'Lock the next step today'),
  S('demo-sg-16', 'Cobalt Health', 'call_commitment', 'positive', 'Contract signed, onboarding started',
    'Contract signed. Onboarding kickoff scheduled.', 'hubspot', 48, null, 96, undefined, undefined),
]

// ---------------------------------------------------------------- people
export const DEMO_PEOPLE: Record<string, Array<{ name: string; role: string; badge: string; status: string; last: string; eng: number; desc: string }>> = {
  'Acme Corp': [
    { name: 'Sarah Chen', role: 'CFO', badge: 'DECISION MAKER', status: 'Disengaged', last: '2d ago', eng: 32,
      desc: 'Primary blocker. Raised pricing objection on Nov 12 call. Needs exec-to-exec engagement to unblock.' },
    { name: 'James Park', role: 'VP Engineering', badge: 'CHAMPION', status: 'Active', last: '4d ago', eng: 88,
      desc: 'Strong internal advocate. Confirmed technical requirements met. Ready to push forward once legal clears.' },
    { name: 'Mike Torres', role: 'Procurement', badge: 'INFLUENCER', status: 'Active', last: '6d ago', eng: 55,
      desc: 'Controls vendor approval process. Waiting on legal redlines. Key to getting PO issued quickly.' },
    { name: 'Rachel Kim', role: 'Legal Counsel', badge: 'BLOCKER', status: 'Quiet', last: '9d ago', eng: 20,
      desc: 'Reviewing contract redlines. No response since Nov 14. May need escalation through Sarah Chen.' },
  ],
  'Nexus AI': [
    { name: 'Marcus Webb', role: 'CEO', badge: 'DECISION MAKER', status: 'Active', last: '1d ago', eng: 91,
      desc: 'Highly engaged. Verbally committed. Pushing internally to close before Q1.' },
    { name: 'Priya Shah', role: 'CTO', badge: 'CHAMPION', status: 'Active', last: '2d ago', eng: 88,
      desc: 'Technical champion. Completed POC review and signed off. Advocating strongly with Marcus.' },
    { name: 'Tom Nguyen', role: 'Legal', badge: 'INFLUENCER', status: 'Active', last: '3d ago', eng: 65,
      desc: 'Standard legal review in progress. Two clauses outstanding. On track to resolve this week.' },
  ],
  'TechFlow Inc': [
    { name: 'Jamie Torres', role: 'VP Sales Ops', badge: 'DECISION MAKER', status: 'Slipping', last: '5d ago', eng: 48,
      desc: 'Primary contact but engagement slipping. Price sensitivity flagged. Needs ROI-focused re-engagement.' },
    { name: 'Lena Ford', role: 'IT Director', badge: 'INFLUENCER', status: 'Active', last: '7d ago', eng: 72,
      desc: 'Technically interested. Comparing API capabilities vs competitors. Could be a strong internal ally.' },
    { name: 'Brian Miles', role: 'CFO', badge: 'UNKNOWN', status: 'Never contacted', last: 'never', eng: 0,
      desc: 'Budget holder not yet engaged. Likely the reason for finance delay. Consider exec outreach.' },
  ],
}

// ---------------------------------------------------------------- comms
export const DEMO_COMMS: Record<string, Array<{ who: string; role: string; via: string; quote: string; tone: 'positive' | 'negative' | 'neutral'; when: string }>> = {
  'Acme Corp': [
    { who: 'Sarah Chen', role: 'CFO', via: 'Gmail', tone: 'negative', when: '2d ago',
      quote: 'We need to discuss the new pricing structure before we can commit to renewal. Finance team has concerns.' },
    { who: 'James Park', role: 'VP Engineering', via: 'Slack', tone: 'positive', when: '4d ago',
      quote: 'Technical integration looks solid. My team is ready to proceed once legal signs off.' },
    { who: 'Mike Torres', role: 'Procurement', via: 'WhatsApp', tone: 'neutral', when: '6d ago',
      quote: 'Still waiting on legal review. Should have an update by end of week.' },
    { who: 'Sarah Chen', role: 'CFO', via: 'Gmail', tone: 'negative', when: '8d ago',
      quote: 'Can we schedule a call to go over the contract terms? A few things need clarification.' },
  ],
  'TechFlow Inc': [
    { who: 'Jamie Torres', role: 'VP Sales Ops', via: 'WhatsApp', tone: 'negative', when: '5d ago',
      quote: 'Looks interesting but I need to check with finance first before we go any further on pricing.' },
    { who: 'Lena Ford', role: 'IT Director', via: 'Gmail', tone: 'neutral', when: '7d ago',
      quote: 'Your API docs look solid. How does the integration compare to Gong\'s offering?' },
    { who: 'Jamie Torres', role: 'VP Sales Ops', via: 'Gmail', tone: 'neutral', when: '10d ago',
      quote: 'Can you send over the formal proposal and pricing options? We are evaluating 2-3 vendors.' },
  ],
  'Meridian Labs': [
    { who: 'Alex Park', role: 'Head of Revenue Ops', via: 'Gmail', tone: 'negative', when: '5d ago',
      quote: 'We have pushed the evaluation to Q2 now. Internal restructuring has slowed things down. Let us reconnect in Jan.' },
    { who: 'Dana Wu', role: 'Product Lead', via: 'Slack', tone: 'neutral', when: '8d ago',
      quote: 'Still very interested in the platform. Just needs exec sign-off which is a Q2 thing now.' },
    { who: 'Alex Park', role: 'Head of Revenue Ops', via: 'Gmail', tone: 'positive', when: '14d ago',
      quote: 'The demo went well. Team is aligned on fit. Budget is confirmed for next cycle.' },
  ],
  'Nexus AI': [
    { who: 'Marcus Webb', role: 'CEO', via: 'Gmail', tone: 'positive', when: '1d ago',
      quote: 'We are very close to signing. Just waiting on legal to clear the last two redlines. Should be done by Friday.' },
    { who: 'Priya Shah', role: 'CTO', via: 'Slack', tone: 'positive', when: '2d ago',
      quote: 'The API integration passed all our security tests. Ready on our end.' },
    { who: 'Tom Nguyen', role: 'Legal', via: 'Gmail', tone: 'neutral', when: '3d ago',
      quote: 'Two clauses outstanding - data residency and liability cap. We will have edits by Thursday.' },
  ],
}

// ---------------------------------------------------------------- timeline
export const DEMO_TIMELINE: Record<string, Array<{ title: string; body: string; when: string; kind: string; tags?: string[] }>> = {
  'Nexus AI': [
    { title: 'Final Contract Sent', kind: 'positive', when: '1d ago',
      body: 'Executed agreement sent to Marcus Webb for e-signature. Close expected Jan 15.' },
    { title: 'PO Expected Signal', kind: 'positive', when: '3d ago',
      body: 'Procurement team confirmed budget allocation. Purchase order in drafting stage.' },
    { title: 'Security Audit Passed', kind: 'positive', when: '5d ago',
      body: 'SOC2 compliance verified. No blockers from InfoSec team.' },
    { title: 'Legal Review Initiated', kind: 'watch', when: '8d ago',
      body: 'Nexus legal team requested contract redlines. Standard 2-week review window.' },
    { title: 'Technical Evaluation Complete', kind: 'call', when: '12d ago',
      body: 'Marcus Webb confirmed product-market fit. Integration team greenlit deployment.' },
  ],
  'TechFlow Inc': [
    { title: 'Phased Pricing Proposal Sent', kind: 'action', when: '7h ago',
      body: 'Popsicle generated 60/40 phased pricing option. CFO ROI calculator attached.' },
    { title: 'Follow-up Call Completed', kind: 'call', when: '3d ago',
      body: 'Product demo for finance stakeholders. ROI model presented showing 3.1x return.' },
    { title: 'Price Sensitivity Detected', kind: 'watch', when: '5d ago',
      body: 'Multiple references to budget constraints in Slack messages. Finance review in progress.' },
    { title: 'Budget Concern Flagged', kind: 'watch', when: '7d ago',
      body: '"Check with finance first" - Jamie Torres deferred pricing decision to CFO.' },
    { title: 'Proposal Delivered', kind: 'call', when: '10d ago',
      body: 'Full pricing proposal sent to Jamie Torres. Three-tier option with annual commitment discount.' },
  ],
  'Acme Corp': [
    { title: 'Popsicle Deployed Response', kind: 'action', when: '4h ago',
      body: 'Re-engagement email auto-sent to Sarah Chen. ROI value summary attached. Escalation brief prepared for CRO.' },
    { title: 'CFO Flagged Pricing', kind: 'negative', when: '2d ago',
      body: '"We need to discuss the new pricing before committing." Finance team concerns raised.' },
    { title: 'Zoom Call · Discovery', kind: 'call', when: '3d ago',
      body: '42 min call with Sarah Chen & team. AI detected 2 objections, 1 commitment, 3 next steps.',
      tags: ['Gong transcript', '2 objections', '1 commitment'] },
    { title: 'Champion at Risk Detected', kind: 'watch', when: '4d ago',
      body: 'Internal champion removed from latest email thread. Possible loss of internal backing.' },
    { title: 'Email Opened 3x, No Reply', kind: 'negative', when: '6d ago',
      body: 'Renewal pricing email opened by Sarah Chen three times. Zero response - high-intent ghosting pattern.' },
    { title: 'Exec Gone Dark', kind: 'negative', when: '8d ago',
      body: 'Sarah Chen (CFO) stopped responding to all outreach. Last email opened but no reply.' },
  ],
}

// ---------------------------------------------------------------- transcript
export const DEMO_TRANSCRIPT = {
  account: 'Acme Corp',
  title: 'Zoom Discovery Call',
  duration: 42,
  when: '3 days ago',
  analyser: 'Gong analyzed',
  summary: 'Sarah expressed interest in the platform but raised concerns about pricing vs current Gong contract. Her team wants a side-by-side comparison before committing budget. James (IT) confirmed technical readiness. Strong buying signals but finance is the blocker.',
  moments: [
    { t: '2:14', who: 'Sarah Chen', tag: null, text: 'Tell me more about how you detect signals compared to what we currently have with Gong.' },
    { t: '5:32', who: 'Andy G', tag: null, text: 'The key difference is we analyze across email, WhatsApp, and Slack in real-time - not just call recordings after the fact.' },
    { t: '12:08', who: 'Sarah Chen', tag: 'OBJECTION', text: 'The pricing feels high for what we need. We are paying $180K for Gong already and the board will not approve two overlapping tools.' },
    { t: '14:45', who: 'Andy G', tag: null, text: 'That is exactly why we built the migration path. You can phase out Gong as Popsicle ramps - most teams see full ROI within 60 days.' },
    { t: '22:30', who: 'Sarah Chen', tag: 'COMMITMENT', text: 'OK, I think we can work with that. Send me the comparison doc and I will take it to our CFO review next Tuesday.' },
    { t: '31:15', who: 'James (IT)', tag: 'OBJECTION', text: 'What about SSO integration? We need SAML 2.0 with Okta - that is a dealbreaker for our security team.' },
    { t: '32:40', who: 'Andy G', tag: null, text: 'Fully supported out of the box. We have 14 enterprise customers on Okta SAML today. I will send the security whitepaper.' },
    { t: '38:50', who: 'Sarah Chen', tag: 'NEXT STEP', text: 'Let us reconvene after the CFO review. Can you have the comparison doc and security whitepaper over by Thursday?' },
  ],
}

// ---------------------------------------------------------------- pulse
export const DEMO_PULSE = {
  health: 74, delta: '+6 pts this week', aiConfidence: 91,
  deals: 9, dealsDelta: '+2 wk', risk: 3, riskDelta: '+1 today',
  forecast: 1200000, forecastDelta: '+12%',
  loop: { signals: 12, cases: 5, actions: 4, impact: 560000 },
  brief: [
    { tone: 'high', pre: "Acme's CRO hasn't opened your last 3 emails, ", strong: 'switch to video before Friday' },
    { tone: 'positive', pre: 'Win rate ', strong: 'up 12% this quarter', post: ' - Nexus & Cobalt driving momentum' },
    { tone: 'watch', pre: 'Axion legal enters ', strong: 'day 4 tomorrow', post: ' - auto-escalation triggers at day 5' },
  ],
  listening: 47,
}

// ---------------------------------------------------------------- correspondence volume + baselines
export const DEMO_MESSAGES = (() => {
  const out: Array<{ id: string; account_name: string; sender: string; subject: string; content: string; integration: string; direction: string; received_at: string }> = []
  const accts = DEMO_ACCOUNTS.map(a => a.name)
  const subjects = ['Re: pricing review', 'Contract redlines', 'Rollout plan', 'Security questionnaire', 'Re: next steps', 'Legal review status', 'Renewal terms', 'Technical eval']
  let n = 0
  for (let week = 7; week >= 0; week--) {
    const volume = 7 + (7 - week) * 2
    for (let i = 0; i < volume; i++) {
      const a = accts[(n + i) % accts.length]
      out.push({
        id: `demo-msg-${n++}`, account_name: a,
        sender: i % 3 === 0 ? 'andy@popsicle-labs.app' : `contact@${a.toLowerCase().replace(/[^a-z]/g, '')}.com`,
        subject: subjects[(n + i) % subjects.length],
        content: 'Thanks for the note - circling back with the team and will confirm this week.',
        integration: ['gmail', 'gmail', 'slack', 'gmail', 'zoom'][(n + i) % 5],
        direction: i % 3 === 0 ? 'outbound' : 'inbound',
        received_at: iso((week * 7 + (i % 7)) * 24),
      })
    }
  }
  return out
})()

export const DEMO_BASELINES = [
  { account_name: 'Acme Corp', total_messages: 148, total_reply_pairs: 41, our_median_reply_hours: 3, their_median_reply_hours: 26, last_message_at: iso(192), avg_interval_hours: 30 },
  { account_name: 'Meridian Labs', total_messages: 126, total_reply_pairs: 38, our_median_reply_hours: 2, their_median_reply_hours: 31, last_message_at: iso(120), avg_interval_hours: 28 },
  { account_name: 'Nexus AI', total_messages: 97, total_reply_pairs: 30, our_median_reply_hours: 2, their_median_reply_hours: 5, last_message_at: iso(20), avg_interval_hours: 20 },
  { account_name: 'TechFlow Inc', total_messages: 84, total_reply_pairs: 22, our_median_reply_hours: 3, their_median_reply_hours: 14, last_message_at: iso(72), avg_interval_hours: 40 },
  { account_name: 'Axion Partners', total_messages: 61, total_reply_pairs: 15, our_median_reply_hours: 4, their_median_reply_hours: 19, last_message_at: iso(24), avg_interval_hours: 52 },
  { account_name: 'TechVault Inc', total_messages: 44, total_reply_pairs: 11, our_median_reply_hours: 5, their_median_reply_hours: 22, last_message_at: iso(72), avg_interval_hours: 60 },
  { account_name: 'Brightwave', total_messages: 38, total_reply_pairs: 12, our_median_reply_hours: 3, their_median_reply_hours: 6, last_message_at: iso(30), avg_interval_hours: 36 },
  { account_name: 'Cobalt Health', total_messages: 52, total_reply_pairs: 18, our_median_reply_hours: 3, their_median_reply_hours: 7, last_message_at: iso(48), avg_interval_hours: 34 },
]

// contracts kept from the earlier extraction
export const DEMO_CONTRACTS: Record<string, Array<{ name: string; type: string; status: string; value: string; po: string; start: string; end: string; invoice: string }>> = {
  'Acme Corp': [
    { name: 'Enterprise License', type: 'Annual subscription', status: 'RENEWAL DUE', value: '$480K', po: 'PO-2026-0418', start: 'Jan 1, 2026', end: 'Dec 31, 2026', invoice: 'Last invoice paid Nov 2, 2026' },
  ],
  'Nexus AI': [
    { name: 'Platform Agreement', type: 'Annual subscription', status: 'IN LEGAL', value: '$320K', po: 'Pending', start: 'Feb 1, 2027', end: 'Jan 31, 2028', invoice: 'Not yet invoiced' },
  ],
  'Cobalt Health': [
    { name: 'Enterprise License', type: 'Annual subscription', status: 'SIGNED', value: '$150K', po: 'PO-2026-0902', start: 'Dec 20, 2026', end: 'Dec 19, 2027', invoice: 'Invoice issued Dec 20, 2026' },
  ],
}


// The Overview 'AI risk signals' lines, verbatim from the mobile app.
export const DEMO_RISK_LINES: Record<string, Array<{ tone: 'high' | 'watch' | 'positive'; text: string }>> = {
  'Acme Corp': [
    { tone: 'high', text: 'Executive dark 8 days - email opened 3x with no reply. Escalation risk rising.' },
    { tone: 'high', text: 'CFO flagged pricing concern in last call. Finance loop-in may add 3-4 weeks.' },
    { tone: 'watch', text: 'Legal review requested. Contract redlines sent, awaiting response since Nov 14.' },
    { tone: 'positive', text: 'VP Eng confirmed technical fit. Integration team standing by.' },
  ],
  'Nexus AI': [
    { tone: 'positive', text: 'Champion re-engaged after holiday break. Strong buying intent signals across 3 channels.' },
    { tone: 'positive', text: 'Procurement confirmed budget approved. PO expected this week.' },
    { tone: 'watch', text: 'Legal review is the only remaining blocker. Standard NDA redlines outstanding.' },
  ],
  'TechFlow Inc': [
    { tone: 'watch', text: 'Price flinch detected - "need to check with finance" via WhatsApp. Budget may be tighter than stated.' },
    { tone: 'watch', text: 'Competitor mention on last call. Evaluating a lower-cost alternative.' },
    { tone: 'high', text: 'No reply to proposal sent 5 days ago. Champion may be losing momentum.' },
    { tone: 'positive', text: 'IT team expressed strong interest in API capabilities.' },
  ],
  'Meridian Labs': [
    { tone: 'watch', text: 'Timeline slipped from Q1 to Q2 without explanation. Internal priority shift suspected.' },
    { tone: 'watch', text: 'Champion changed - original contact moved to different team. New relationship needs building.' },
    { tone: 'positive', text: 'Strong budget signals. $850K pre-approved in Q2 budget cycle.' },
    { tone: 'high', text: 'No exec engagement yet on a deal this size. Risk of losing to do-nothing.' },
  ],
}

// ---------- Team (transcribed from the mobile Team screen, v11.9) ----------
// Fixed figures so the demo reads exactly like the design. Live mode builds
// the same shape from accounts + signals inside TeamReal.
export type TeamRep = {
  name: string; title: string; color: string
  accounts: string[]; arr: number
  signals: number; saved: number; protectedValue: number
  avgResp: number; saveRate: number; churnDelta: number; performance: number
  badge?: string; badgeTone?: 'accent' | 'blue' | 'warn'
  trend: 'improving' | 'steady' | 'needs coaching'
  spark: number[]            // 7 points, Mon..Sun, response hours
  activity: number[][]       // 5 rows (8-10 .. 4-6) x 7 cols (Mo..Su), 0..4
  ownership: 'active' | 'stale'; ownershipNote?: string
  followThrough: number; closure: number
}
export type TeamQueueItem = { account: string; sev: 'critical' | 'high' | 'medium'; summary: string; age: string; rep: string; signalId?: string }
export type TeamModel = {
  protectedTotal: number; protectedDeltaPct: number
  waitingCount: number; waitingValue: number; criticalWithOneRep: boolean
  bullets: Array<{ tone: string; text: string }>
  arr: number; accountCount: number
  split: Array<{ k: string; color: string; value: number; accts: number }>
  timeToAction: number; timeToActionDelta: number
  coveragePct: number; covered: number
  signalsThisWeek: number; actioned: number; autoDeployedPct: number
  reps: TeamRep[]
  queue: TeamQueueItem[]; unresolvedPct: number
  newCritical: number; stabilized: number; actionsTaken: number; signalsPerDay: number; signalsPerDayDelta: number
  criticalOwned: string; activeFollowUp: string
  followThrough: number; loopClosure: number
}

export const DEMO_TEAM: TeamModel = {
  protectedTotal: 560_000, protectedDeltaPct: 38,
  waitingCount: 7, waitingValue: 2_170_000, criticalWithOneRep: true,
  bullets: [
    { tone: '#2f8f5b', text: 'Exec calls have 83% success rate vs 74% for email, the highest-impact intervention by far.' },
    { tone: '#E85A25', text: "Andy G's 1.2h avg response is 45% faster than team average, strongest signal coverage." },
    { tone: '#d38b1d', text: "Jamie Torres' 3.1h response correlates with lower save rate, coaching on urgency recommended." },
    { tone: '#0E0D0B', text: 'Mike Ross closed 2 deals with zero escalation, replicate his re-engagement sequence across the team.' },
  ],
  arr: 2_640_000, accountCount: 9,
  split: [
    { k: 'Critical', color: '#c43d2b', value: 1_330_000, accts: 2 },
    { k: 'Watching', color: '#d38b1d', value: 655_000, accts: 4 },
    { k: 'Healthy', color: '#2f8f5b', value: 650_000, accts: 3 },
  ],
  timeToAction: 2.2, timeToActionDelta: -1.8,
  coveragePct: 89, covered: 8,
  signalsThisWeek: 47, actioned: 40, autoDeployedPct: 62,
  reps: [
    {
      name: 'Andy G', title: 'VP of Sales', color: '#FF6B35',
      accounts: ['Acme', 'Techflow', 'Axion', 'Meridian'], arr: 1_640_000,
      signals: 24, saved: 4, protectedValue: 284_000, avgResp: 1.2, saveRate: 89, churnDelta: -19, performance: 88,
      badge: 'Top performer', badgeTone: 'accent', trend: 'improving',
      spark: [2.0, 1.6, 2.3, 1.4, 1.7, 1.3, 1.1],
      activity: [
        [0, 3, 4, 4, 3, 1, 0],
        [3, 3, 3, 3, 2, 0, 0],
        [2, 2, 2, 2, 1, 0, 0],
        [2, 3, 3, 3, 2, 0, 0],
        [1, 2, 4, 3, 1, 0, 0],
      ],
      ownership: 'active', followThrough: 88, closure: 82,
    },
    {
      name: 'Mike Ross', title: 'AE Senior', color: '#2f6f9f',
      accounts: ['Nexus', 'Cobalt', 'Brightwave'], arr: 650_000,
      signals: 14, saved: 2, protectedValue: 176_000, avgResp: 2.4, saveRate: 78, churnDelta: -14, performance: 78,
      badge: 'Most closes', badgeTone: 'blue', trend: 'steady',
      spark: [2.4, 2.3, 2.5, 2.2, 2.4, 2.3, 2.4],
      activity: [
        [0, 1, 3, 3, 3, 0, 0],
        [2, 2, 2, 2, 2, 0, 0],
        [1, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 0, 0],
        [0, 0, 2, 0, 0, 0, 0],
      ],
      ownership: 'stale', ownershipNote: 'Stale 3d', followThrough: 74, closure: 71,
    },
    {
      name: 'Jamie Torres', title: 'AE', color: '#7C5CFC',
      accounts: ['Techvault', 'Vertex'], arr: 350_000,
      signals: 9, saved: 1, protectedValue: 100_000, avgResp: 3.1, saveRate: 65, churnDelta: -11, performance: 66,
      badge: 'Improving', badgeTone: 'warn', trend: 'needs coaching',
      spark: [2.6, 2.9, 3.0, 2.9, 3.4, 3.2, 3.5],
      activity: [
        [0, 1, 2, 3, 1, 1, 0],
        [1, 2, 2, 2, 1, 0, 0],
        [1, 1, 2, 1, 1, 0, 0],
        [1, 1, 1, 1, 2, 0, 0],
        [0, 0, 1, 0, 0, 0, 0],
      ],
      ownership: 'active', followThrough: 64, closure: 58,
    },
  ],
  queue: [
    { account: 'Acme Corp', sev: 'critical', summary: 'CFO silent 8 days · 3 emails opened, 0 replies', age: '8d', rep: 'Andy G' },
    { account: 'Meridian Labs', sev: 'critical', summary: 'Gong POC confirmed by CEO · competitor active', age: '5d', rep: 'Andy G' },
    { account: 'TechFlow Inc', sev: 'high', summary: 'COO budget concern on Zoom · "need to check finance"', age: '3h', rep: 'Andy G' },
    { account: 'Axion Partners', sev: 'high', summary: 'Legal stall day 3 · redline not sent yet', age: '3d', rep: 'Andy G' },
    { account: 'TechVault Inc', sev: 'high', summary: 'VP Eng WhatsApp: price concern · no follow-up', age: '2d', rep: 'Jamie Torres' },
    { account: 'Vertex Systems', sev: 'medium', summary: 'Proposal opened 5× · no next step set', age: '4d', rep: 'Jamie Torres' },
    { account: 'Brightwave', sev: 'medium', summary: 'Re-engagement email opened · no reply sent', age: '1d', rep: 'Mike Ross' },
  ],
  unresolvedPct: 15,
  newCritical: 2, stabilized: 3, actionsTaken: 40, signalsPerDay: 6.7, signalsPerDayDelta: 2.1,
  criticalOwned: '9/9', activeFollowUp: '6/9',
  followThrough: 75, loopClosure: 71,
}

// ---------- Intelligence (transcribed from the mobile Intelligence screen, v11.10) ----------
export type IntelModel = {
  riskDeltaPct: number; driver: string; holdingPct: number; protectedTotal: number
  bullets: Array<{ tone: string; lead: string; rest: string }>
  weekNo: number; newRisk: number; firstWeekRisk: number
  stabilized: number; netChangePct: number
  drivers: Array<{ k: string; v: number }>              // v < 0 = reduced risk (green, shown with +)
  weeks: Array<{ label: string; added: number; stabilized: number }>
  riskSits: Array<{ k: string; pct: number; exposure: number; color: string }>
  actions: Array<{ k: string; used: number; success: number; churn: number }>
  successRate: number; successTarget: number; recovered: number; caughtEarly: number
  fasterDays: number; insight: string
  forecast?: { forecast: number; actual: number }
  sources: Array<{ k: string; n: number }>
  renewals: Array<{ account: string; days: number; value: number; status: 'at risk' | 'monitor' | 'on track' }>
}

export const DEMO_INTELLIGENCE: IntelModel = {
  riskDeltaPct: 75, driver: 'executive disengagement', holdingPct: 78, protectedTotal: 560_000,
  bullets: [
    { tone: '#c43d2b', lead: '3 accounts deteriorated', rest: ': Acme, TechFlow, Meridian.' },
    { tone: '#2f8f5b', lead: 'Brightwave re-engaged', rest: ' after 2 weeks dark.' },
    { tone: '#2f8f5b', lead: 'Cobalt closed-won', rest: ' for $150K, first this quarter.' },
    { tone: '#0E0D0B', lead: 'Focus today:', rest: ' Meridian CEO video, Axion legal prep.' },
  ],
  weekNo: 8, newRisk: 579_000, firstWeekRisk: 330_000,
  stabilized: 290_000, netChangePct: 8,
  drivers: [
    { k: 'Exec disengagement', v: 85_000 },
    { k: 'SLA resolution', v: -62_000 },
    { k: 'New competitor', v: 54_000 },
    { k: 'Usage recovery', v: -31_000 },
  ],
  weeks: [
    { label: 'W1', added: 330_000, stabilized: 210_000 },
    { label: 'W2', added: 342_000, stabilized: 236_000 },
    { label: 'W3', added: 318_000, stabilized: 258_000 },
    { label: 'W4', added: 365_000, stabilized: 244_000 },
    { label: 'W5', added: 412_000, stabilized: 262_000 },
    { label: 'W6', added: 448_000, stabilized: 275_000 },
    { label: 'W7', added: 508_000, stabilized: 281_000 },
    { label: 'W8', added: 579_000, stabilized: 290_000 },
  ],
  riskSits: [
    { k: 'Executive disengagement', pct: 34, exposure: 452_000, color: '#c43d2b' },
    { k: 'Invoice delays', pct: 28, exposure: 372_000, color: '#d38b1d' },
    { k: 'Competitor activity', pct: 22, exposure: 293_000, color: '#FF6B35' },
    { k: 'Product usage decline', pct: 16, exposure: 213_000, color: '#5C5855' },
  ],
  actions: [
    { k: 'Exec call', used: 6, success: 83, churn: -31 },
    { k: 'Follow-up', used: 28, success: 74, churn: -18 },
    { k: 'Escalation', used: 14, success: 68, churn: -22 },
    { k: 'Invoice chase', used: 9, success: 45, churn: -8 },
  ],
  successRate: 78, successTarget: 80, recovered: 7, caughtEarly: 47,
  fasterDays: 3.4,
  insight: 'Executive calls cut churn most per intervention (−31%) but are used least. Follow-ups carry the volume at 74% effectiveness.',
  forecast: { forecast: 1_240_000, actual: 1_180_000 },
  sources: [
    { k: 'Gmail / Outlook', n: 310 },
    { k: 'WhatsApp', n: 194 },
    { k: 'Slack', n: 128 },
    { k: 'LinkedIn', n: 96 },
    { k: 'Calls & CRM', n: 119 },
  ],
  renewals: [
    { account: 'Meridian Labs', days: 32, value: 850_000, status: 'at risk' },
    { account: 'Vertex Systems', days: 58, value: 140_000, status: 'monitor' },
    { account: 'Brightwave', days: 74, value: 180_000, status: 'on track' },
    { account: 'Cobalt Systems', days: 88, value: 150_000, status: 'on track' },
  ],
}

// ---------- Portfolio head (transcribed from the mobile Portfolio screen, v11.12) ----------
export type PortfolioHead = {
  stats: Array<{ n: string; lbl: string; tone: 'critical' | 'warn' | 'good' | 'ink'; strong?: boolean }>
}
export const DEMO_PORTFOLIO: PortfolioHead = {
  stats: [
    { n: '2', lbl: 'high risk · $1.33M at risk', tone: 'critical' },
    { n: '4', lbl: 'medium · $655K exposure', tone: 'warn' },
    { n: '2', lbl: 'closing or won · $470K', tone: 'good' },
    { n: '58', lbl: 'avg health · ▲ 4 this week', tone: 'ink', strong: true },
  ],
}
export const DEMO_PORTFOLIO_HEADLINE = {
  highCount: 2, highValue: 1_330_000, darkHours: 48, closingName: 'Nexus', healthyCount: 2,
}
