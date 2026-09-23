// Demo dataset, transcribed from the Popsicle mobile app so the web demo tells
// exactly the same story. Figures, names, quotes and dates are verbatim.
import * as M from './metrics'
import type { Account, Signal } from '@/types'

// Demo clock: the start of the current hour. An hour boundary is the same instant everywhere, so
// server and client agree on every derived timestamp, and "today" is always the viewer's real
// today: dates are formatted in the viewer's own time zone. (It used to be 09:00 on the UTC
// calendar day, which showed yesterday's date for anyone ahead of UTC while the UTC date still
// lagged theirs; in Jakarta, every night from midnight to 7am.)
export const DEMO_NOW = Math.floor(Date.now() / 3600e3) * 3600e3
const now = DEMO_NOW
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
    contact_name: 'Sarah Chen', trend: '-15%', repScore: 36, expiry: 'Dec 31',
    flags: ['Exec Unresponsive', '8d Dark', 'Champion at Risk'],
    breakdown: [{ k: 'Engagement', v: 49 }, { k: 'Product Fit', v: 58 }, { k: 'Legal', v: 20 }, { k: 'Financial', v: 17 }],
  },
  'Nexus AI': {
    contact_name: 'Marcus Webb', trend: '+8%', repScore: 91, expiry: 'Jan 15',
    flags: ['Legal Clearing', 'PO Expected'], statusNote: 'On track',
    breakdown: [{ k: 'Engagement', v: 81 }, { k: 'Product Fit', v: 95 }, { k: 'Legal', v: 92 }, { k: 'Financial', v: 96 }],
  },
  'TechFlow Inc': {
    contact_name: 'Jamie Torres', trend: '-3%', repScore: 61, expiry: 'Feb 01',
    flags: ['Price Flinch', 'Finance Review'],
    breakdown: [{ k: 'Engagement', v: 40 }, { k: 'Product Fit', v: 78 }, { k: 'Legal', v: 62 }, { k: 'Financial', v: 64 }],
  },
  'Meridian Labs': {
    contact_name: 'Alex Park', trend: '-11%', repScore: 58, expiry: 'Mar 30',
    flags: ['Timeline Slip'],
    breakdown: [{ k: 'Engagement', v: 42 }, { k: 'Product Fit', v: 82 }, { k: 'Legal', v: 18 }, { k: 'Financial', v: 90 }],
  },
  'Brightwave': {
    contact_name: 'Andy G', trend: '+9%', repScore: 82, expiry: 'Feb 10',
    flags: ['Buyer Active', 'Onboarding Interest'], statusNote: 'Re-engaged',
    breakdown: [{ k: 'Engagement', v: 81 }, { k: 'Product', v: 78 }, { k: 'Support', v: 92 }, { k: 'Finance', v: 77 }],
  },
  'Axion Partners': {
    contact_name: 'Andy G', trend: '-9%', repScore: 38, expiry: 'Feb 28',
    flags: ['Legal Blocker', '+3-5 Weeks'],
    breakdown: [{ k: 'Engagement', v: 45 }, { k: 'Product', v: 56 }, { k: 'Support', v: 39 }, { k: 'Finance', v: 12 }],
  },
  'TechVault Inc': {
    contact_name: 'Mike Ross', trend: '-2%', repScore: 59, expiry: 'Mar 15',
    flags: ['Budget Concern', 'Finance Review'],
    breakdown: [{ k: 'Engagement', v: 51 }, { k: 'Product', v: 88 }, { k: 'Support', v: 72 }, { k: 'Finance', v: 25 }],
  },
  'Cobalt Health': {
    contact_name: 'Jamie Torres', trend: '+14%', repScore: 95, expiry: 'Closed Dec 20',
    flags: ['Contract Signed', 'Onboarding Started'], statusNote: 'Onboarding',
    breakdown: [{ k: 'Engagement', v: 87 }, { k: 'Product', v: 98 }, { k: 'Support', v: 97 }, { k: 'Finance', v: 98 }],
  },
  // Vertex Systems, transcribed from the mobile Overview (v11.20).
  'Vertex Systems': {
    contact_name: 'Dana Kim', trend: '+5%', repScore: 82, expiry: 'Jan 28',
    flags: ['Legal Review', 'Close Jan 28'],
    breakdown: [{ k: 'Engagement', v: 81 }, { k: 'Product Fit', v: 90 }, { k: 'Legal', v: 69 }, { k: 'Financial', v: 88 }],
  },
}

const A = (id: string, name: string, domain: string, value: number, stage: string, owner: string,
  risk: 'high' | 'medium' | 'low', health: number, close: string, lastContactHours: number, tags: string[]): Account =>
  ({ id, name, domain, health_score: health, value, stage, owner, risk_level: risk,
     close_date: close, last_contact_date: iso(lastContactHours), tags, user_id: 'demo', created_at: iso(4000) }) as Account

export const DEMO_ACCOUNTS: Account[] = [
  A('demo-acme', 'Acme Corp', 'acmecorp.com', 480000, 'Negotiation', 'Sarah Chen', 'high', 36, at(12, 31), 192, ['Exec Unresponsive', '8d Dark', 'Champion at Risk']),
  A('demo-meridian', 'Meridian Labs', 'meridianlabs.com', 850000, 'Discovery', 'Alex Park', 'medium', 58, at(3, 30), 120, ['Timeline Slip']),
  A('demo-nexus', 'Nexus AI', 'nexus.ai', 320000, 'Closing', 'Marcus Webb', 'low', 91, at(1, 15), 20, ['Legal Clearing', 'PO Expected']),
  A('demo-techflow', 'TechFlow Inc', 'techflow.com', 210000, 'Proposal', 'Jamie Torres', 'medium', 61, at(2, 1), 72, ['Price Flinch', 'Finance Review']),
  A('demo-brightwave', 'Brightwave', 'brightwave.io', 180000, 'Closing', 'Andy G', 'low', 82, at(2, 10), 30, ['Buyer Active', 'Onboarding Interest']),
  A('demo-axion', 'Axion Partners', 'axionpartners.com', 95000, 'Negotiation', 'Andy G', 'high', 38, at(2, 28), 24, ['Legal Blocker', '+3-5 Weeks']),
  A('demo-techvault', 'TechVault Inc', 'techvault.com', 140000, 'Proposal', 'Mike Ross', 'medium', 59, at(3, 15), 72, ['Budget Concern', 'Finance Review']),
  A('demo-cobalt', 'Cobalt Health', 'cobalthealth.com', 150000, 'Closed Won', 'Jamie Torres', 'low', 95, at(12, 20), 48, ['Contract Signed', 'Onboarding Started']),
  // ninth account, from the mobile Portfolio / Team / Intelligence screens
  A('demo-vertex', 'Vertex Systems', 'vertexsystems.com', 175000, 'Proposal', 'Dana Kim', 'low', 82, at(1, 28), 48, ['Legal Review', 'Close Jan 28']),
]

// ---------------------------------------------------------------- signals
const S = (id: string, account: string, type: string, sev: 'high' | 'watch' | 'positive',
  title: string, description: string, src: string, hours: number, risk: number | null,
  conf: number, quote?: string, rec?: string): Signal =>
  ({ id, account_id: null, account_name: account, signal_type: type, severity: sev, title, description,
     source_integration: src, risk_amount: risk, created_at: iso(hours), is_dismissed: false,
     ai_analysis: { confidence: conf, ...(quote ? { quote } : {}), ...(rec ? { recommendation: rec } : {}) } }) as unknown as Signal

// v11.116: a signal that was acted on (handled), for the protected-revenue and actions figures
const HD = (id: string, account: string, type: string, sev: 'high' | 'watch' | 'positive', title: string, description: string,
  src: string, hours: number, risk: number | null, conf: number, handledHoursAgo: number, action: string, quote?: string): Signal =>
  ({ ...(S(id, account, type, sev, title, description, src, hours, risk, conf, quote) as unknown as Record<string, unknown>),
     status: 'handled', handled_at: iso(handledHoursAgo), handled_action: action }) as unknown as Signal

export const DEMO_SIGNALS: Signal[] = [
  S('demo-sg-1', 'Acme Corp', 'silent_stall', 'high', 'Exec gone dark 8 days',
    'Sarah Chen (CFO) stopped responding to all outreach. Last email opened but no reply. Escalation risk rising.',
    'gmail', 4, 480000, 91, undefined, 'Switch channel: record a short video for the CRO before Friday'),
  S('demo-sg-2', 'Acme Corp', 'price_flinch', 'high', 'CFO flagged pricing concern',
    'CFO flagged pricing concern in the last call. Finance loop-in may add 3-4 weeks.',
    'gmail', 900, 480000, 87, 'We need to discuss the new pricing structure before we can commit to renewal. Finance team has concerns.',
    'Send the side-by-side comparison against their current Gong contract'),
  S('demo-sg-3', 'Acme Corp', 'legal_loopin', 'watch', 'Legal review requested',
    'Contract redlines sent, awaiting response since Nov 14.', 'gmail', 700, 480000, 78, undefined,
    'Chase Rachel Kim directly, escalate through Sarah Chen if no reply by Thursday'),
  S('demo-sg-4', 'Acme Corp', 'champion_change', 'high', 'Champion at risk',
    'Internal champion removed from latest email thread. Possible loss of internal backing.',
    'gmail', 1100, 480000, 83, undefined, 'Re-engage James Park directly and confirm he is still sponsoring'),
  S('demo-sg-5', 'Acme Corp', 'call_buying_signal', 'positive', 'VP Eng confirmed technical fit',
    'VP Eng confirmed technical fit. Integration team standing by.', 'slack', 500, null, 92,
    'Technical integration looks solid. My team is ready to proceed once legal signs off.', undefined),
  S('demo-sg-6', 'Nexus AI', 'reengaged', 'positive', 'Champion re-engaged after break',
    'Champion re-engaged after holiday break. Strong buying intent signals across 3 channels.',
    'gmail', 20, null, 94, 'We are very close to signing. Just waiting on legal to clear the last two redlines.',
    'Lock the signature date this week'),
  S('demo-sg-7', 'Nexus AI', 'call_commitment', 'positive', 'Procurement confirmed budget approved',
    'Procurement confirmed budget approved. PO expected this week.', 'hubspot', 600, null, 90, undefined, undefined),
  S('demo-sg-8', 'Nexus AI', 'legal_loopin', 'watch', 'Legal review the only blocker',
    'Legal review is the only remaining blocker. Standard NDA redlines outstanding.', 'gmail', 300, null, 81,
    'Two clauses outstanding - data residency and liability cap. We will have edits by Thursday.', undefined),
  S('demo-sg-9', 'Meridian Labs', 'timeline_slip', 'watch', 'Renewal timeline pushed from Q1 to Q2',
    'Renewal timeline pushed from Q1 to Q2.', 'gmail', 8, 850000, 84, undefined,
    'Confirm the real date with Alex Park before forecasting it'),
  S('demo-sg-10', 'Meridian Labs', 'competitor_mention', 'high', 'CEO mentioned looking at alternatives',
    'CEO mentioned "looking at alternatives" in Slack.', 'slack', 10, 850000, 88,
    'looking at alternatives', 'Send the comparison one-pager and book an exec call'),
  S('demo-sg-11', 'Meridian Labs', 'call_sentiment_drop', 'watch', 'Product usage declined 18% MoM',
    'Product usage declined 18% month over month.', 'hubspot', 400, 850000, 79, undefined, 'Book an exec call'),
  S('demo-sg-12', 'TechFlow Inc', 'price_flinch', 'watch', 'CFO mentioned need to check with finance',
    'CFO mentioned "need to check with finance" on the Zoom discovery call.', 'zoom', 6, 210000, 86,
    'need to check with finance', 'Share the ROI sheet before their finance review'),
  S('demo-sg-13', 'Axion Partners', 'silent_stall', 'watch', 'Legal review stalled at day 3',
    'Legal review stalled at day 3. Auto-escalation triggers at day 5.', 'gmail', 12, 95000, 80, undefined,
    'Escalate now rather than waiting for day 5'),
  S('demo-sg-14', 'TechVault Inc', 'price_flinch', 'watch', 'Price flinch on WhatsApp',
    'Buyer raised budget concern on WhatsApp, 48h with no reply since.', 'gmail', 650, 140000, 77, undefined,
    'Share the ROI sheet'),
  S('demo-sg-15', 'Brightwave', 'reengaged', 'positive', 'Buyer active again after silence',
    'Buyer re-engaged and asked about onboarding timelines.', 'gmail', 250, null, 89, undefined, 'Lock the next step today'),
  S('demo-sg-16', 'Cobalt Health', 'call_commitment', 'positive', 'Contract signed, onboarding started',
    'Contract signed. Onboarding kickoff scheduled.', 'hubspot', 1000, null, 96, undefined, undefined),
  S('demo-sg-17', 'Vertex Systems', 'commitment_overdue', 'watch', 'Proposal opened 5x, no next step set',
    'Dana Kim opened the proposal five times this week. No meeting or next step has been set. Close date Jan 28 leaves little slack for legal.', 'gmail', 350, 175000, 78,
    'Shared the proposal with leadership. Everyone is on board. Just waiting for legal to finish their review.',
    'Book the legal check-in now so the Jan 28 close holds.'),
  // ---- v11.116: the rest of the month's signals, so every headline figure adds up from the data ----
  // Acme Corp: the CFO has gone quiet and the deal is drifting (critical)
  S('demo-sg-18', 'Acme Corp', 'silent_stall', 'high', 'Renewal email opened a fourth time, no reply', 'Sarah Chen opened the FY27 renewal summary again. No reply in 8 days.', 'gmail', 2, 480000, 98, undefined, 'Send the year-on-year breakdown today'),
  S('demo-sg-19', 'Acme Corp', 'competitor_mention', 'high', 'Gong comparison requested again', 'James Park asked for the side-by-side against Gong a second time.', 'gmail', 6, 480000, 98, 'Can you send the comparison against what we pay Gong today?'),
  S('demo-sg-20', 'Acme Corp', 'timeline_slip', 'high', 'Thursday review postponed without a new date', 'The renewal review on Thursday was moved with no replacement slot.', 'gcal', 800, 480000, 98),
  S('demo-sg-21', 'Acme Corp', 'price_flinch', 'high', 'Finance asked for a 15% concession', 'Procurement asked whether a 15% reduction is possible before sign-off.', 'gmail', 1000, 480000, 97, 'Is there flexibility of around 15% on the renewal?'),
  S('demo-sg-22', 'Acme Corp', 'champion_change', 'high', 'Champion left off the latest thread', 'Priya Nair was removed from the renewal thread by the CFO.', 'gmail', 1200, 480000, 95),
  S('demo-sg-23', 'Acme Corp', 'deal_stage_backward', 'high', 'Deal moved back from Negotiation to Proposal in HubSpot', 'Stage regressed after the pricing call.', 'hubspot', 1300, 480000, 98),
  // Meridian Labs: the renewal is slipping and a rival is circling (critical)
  S('demo-sg-24', 'Meridian Labs', 'silent_stall', 'high', 'Alex Park silent for 5 days after daily replies', 'Usually replies within 4 hours. Last reply 5 days ago.', 'gmail', 1, 850000, 98, undefined, 'Ask to join the VP RevOps planning review directly'),
  S('demo-sg-25', 'Meridian Labs', 'competitor_mention', 'high', 'Rival vendor named in #meridian-renewal', 'A competing platform was named as a consolidation option.', 'slack', 3, 850000, 98, 'Their pitch is that we could replace two tools with one.'),
  S('demo-sg-26', 'Meridian Labs', 'timeline_slip', 'high', 'Budget decision moved to after planning month', 'VP RevOps is in planning until month end; decision deferred.', 'gmail', 7, 850000, 98, 'She is in planning until the end of the month.'),
  S('demo-sg-27', 'Meridian Labs', 'champion_change', 'high', 'Decision owner changed to VP RevOps', 'Budget authority moved from Alex Park to the VP of Revenue Operations.', 'zoom', 80, 850000, 98),
  S('demo-sg-28', 'Meridian Labs', 'price_flinch', 'high', 'Consolidation framed as a cost cut', 'Three renewals are due this quarter; the brief is to cut one.', 'zoom', 150, 850000, 96, 'We have three tools up for renewal and she wants to consolidate, not add.'),
  S('demo-sg-29', 'Meridian Labs', 'silent_stall', 'high', 'One-pager forwarded, no response from the VP', 'The consolidation one-pager was forwarded 11 days ago.', 'gmail', 160, 850000, 95),
  S('demo-sg-30', 'Meridian Labs', 'deal_stage_backward', 'high', 'Renewal moved from Q1 commit to Q2 in HubSpot', 'Close date pushed one quarter.', 'hubspot', 120, 850000, 98),
  S('demo-sg-31', 'Meridian Labs', 'meeting_cancelled', 'high', 'Quarterly business review cancelled', 'The QBR was cancelled by the customer with no reschedule.', 'gcal', 140, 850000, 98),
  // watch
  S('demo-sg-32', 'TechFlow Inc', 'timeline_slip', 'watch', 'Finance calendar closes for new spend in two weeks', 'Approval has to land before the finance cutoff.', 'zoom', 450, 210000, 93, 'Our finance calendar closes for new spend in two weeks.'),
  S('demo-sg-33', 'TechFlow Inc', 'price_flinch', 'watch', 'Asked for the discount in writing', 'Verbal discount will not pass procurement.', 'gmail', 550, 210000, 91),
  S('demo-sg-34', 'Axion Partners', 'legal_loopin', 'watch', 'SOC2 and pen test requested before PO', 'Security documents required before procurement can proceed.', 'slack', 8, 95000, 98, '3-5 week minimum delay. No workaround without security docs.'),
  S('demo-sg-35', 'Axion Partners', 'commitment_overdue', 'watch', 'Pre-approved redline 5 days late', 'The redline promised to Rachel Voss has not been sent.', 'gmail', 200, 95000, 98),
  S('demo-sg-36', 'TechVault Inc', 'silent_stall', 'watch', 'CFO has not opened the ROI package', 'Forwarded to finance two days ago; not yet opened.', 'gmail', 380, 140000, 92),
  S('demo-sg-37', 'TechVault Inc', 'price_flinch', 'watch', 'Asked to start at 60% of seats', 'Kevin Cho asked for a phased start.', 'whatsapp', 700, 140000, 90, 'Could we start at sixty percent and expand after we see the return?'),
  S('demo-sg-38', 'Vertex Systems', 'legal_loopin', 'watch', 'Contract with legal, no reviewer named', 'Legal received the contract; no reviewer assigned yet.', 'gmail', 480, 175000, 89),
  S('demo-sg-39', 'Nexus AI', 'legal_loopin', 'watch', 'MSA redlines returned with two clauses open', 'Liability cap and data residency still open.', 'gmail', 220, null, 87),
  // positive
  S('demo-sg-40', 'Nexus AI', 'call_buying_signal', 'positive', 'Rollout sequencing discussed: enterprise team first', 'Marcus Webb moved to planning the rollout.', 'zoom', 90, null, 98, 'Then enterprise first. Send the deployment plan.'),
  S('demo-sg-41', 'Nexus AI', 'reengaged', 'positive', 'Expansion to two more regions raised', 'Expansion language appeared on the wrap call.', 'zoom', 500, null, 98),
  S('demo-sg-42', 'Brightwave', 'call_buying_signal', 'positive', 'Finance reviewing, answer promised Friday', 'Tom Okafor opened the ROI deck three times.', 'gmail', 60, null, 98, 'Finance is reviewing, back to you Friday.'),
  S('demo-sg-43', 'Brightwave', 'reengaged', 'positive', 'RevOps lead joined the thread', 'A second stakeholder engaged.', 'gmail', 800, null, 95),
  S('demo-sg-44', 'Cobalt Health', 'reengaged', 'positive', 'Onboarding kickoff booked for Monday', 'Implementation lead confirmed.', 'gcal', 150, null, 98),
  S('demo-sg-45', 'Cobalt Health', 'call_buying_signal', 'positive', 'Asked about a second business unit', 'Expansion interest after signing.', 'zoom', 900, null, 94),
  S('demo-sg-46', 'Vertex Systems', 'call_buying_signal', 'positive', 'Dana Kim confirmed the January 28 close', 'Contract review in the final stage.', 'gmail', 100, null, 98, 'We are still aiming to close by January 28.'),
  S('demo-sg-47', 'TechFlow Inc', 'reengaged', 'positive', 'Controller replied within the hour', 'Faster than her usual reply time.', 'gmail', 130, null, 85),
  // handled this quarter: four saves (the $560K protected) and eight routine actions
  HD('demo-hd-1', 'Brightwave', 'silent_stall', 'high', 'Budget freeze mentioned by the VP', 'Brightwave paused new spend pending a budget review.', 'gmail', 900, 180000, 98, 860, 'Exec call'),
  HD('demo-hd-2', 'Vertex Systems', 'legal_loopin', 'high', 'Procurement asked to restart vendor review', 'A second vendor review was requested late in the cycle.', 'gmail', 780, 175000, 98, 740, 'Escalation'),
  HD('demo-hd-3', 'Cobalt Health', 'price_flinch', 'high', 'Renewal pricing challenged by finance', 'Finance questioned the renewal increase.', 'zoom', 1300, 150000, 98, 1250, 'Exec call'),
  HD('demo-hd-4', 'Nexus AI', 'timeline_slip', 'watch', 'Security questionnaire blocking the pilot extension', 'The pilot extension was on hold pending the questionnaire.', 'gmail', 64, 55000, 97, 50, 'Follow-up'),
  HD('demo-hd-5', 'Acme Corp', 'silent_stall', 'watch', 'Technical contact quiet after demo', 'Resolved after a follow-up.', 'gmail', 700, null, 85, 680, 'Follow-up'),
  HD('demo-hd-6', 'TechFlow Inc', 'price_flinch', 'watch', 'Asked about annual prepay', 'Answered with the prepay terms.', 'gmail', 500, null, 87, 480, 'Follow-up'),
  HD('demo-hd-7', 'Axion Partners', 'legal_loopin', 'watch', 'DPA template requested', 'DPA sent the same day.', 'gmail', 420, null, 90, 410, 'Follow-up'),
  HD('demo-hd-8', 'TechVault Inc', 'silent_stall', 'watch', 'No reply after the demo', 'Rebooked for the following week.', 'gmail', 380, null, 86, 360, 'Follow-up'),
  HD('demo-hd-9', 'Meridian Labs', 'champion_change', 'watch', 'New RevOps director introduced', 'Intro call held.', 'zoom', 1100, null, 89, 1080, 'Exec call'),
  HD('demo-hd-10', 'Vertex Systems', 'reengaged', 'positive', 'COO asked for the security summary', 'Sent.', 'gmail', 112, null, 95, 100, 'Follow-up'),
  HD('demo-hd-11', 'Nexus AI', 'legal_loopin', 'watch', 'Data residency question', 'Answered with the region options.', 'gmail', 70, null, 88, 60, 'Escalation'),
  HD('demo-hd-12', 'Cobalt Health', 'invoice_delay', 'watch', 'First invoice queried by AP', 'Resolved with a corrected PO number.', 'gmail', 38, null, 91, 30, 'Invoice chase'),
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
  // transcribed from the mobile People tab (v11.19); eng + desc derived from the comms/timeline on screen
  'TechVault Inc': [
    { name: 'Kevin Cho', role: 'VP Engineering', badge: 'CHAMPION', status: 'Active', last: '1d ago', eng: 84,
      desc: 'Champion. Technical eval scored 9.2/10 and he endorsed personally. Needs CFO ROI sign-off to release budget.' },
    { name: 'Elena Wu', role: 'CFO', badge: 'DECISION MAKER', status: 'Never contacted', last: 'never', eng: 0,
      desc: 'Holds the budget. Wants to see ROI numbers before approving. No direct contact yet.' },
    { name: 'James Burke', role: 'IT Director', badge: 'TECHNICAL', status: 'Active', last: '7d ago', eng: 68,
      desc: 'Security review complete with no issues. SSO integration tested in staging.' },
  ],
  'Cobalt Health': [
    { name: 'Lisa Park', role: 'CFO', badge: 'EXEC SPONSOR', status: 'Active', last: '5d ago', eng: 86,
      desc: 'Signed the contract Dec 20. Praised the onboarding and is looking forward to the QBR.' },
    { name: 'Raj Kapoor', role: 'Head of Revenue Ops', badge: 'CHAMPION', status: 'Active', last: '1d ago', eng: 94,
      desc: 'Reports 94% adoption after week 2. Credits WhatsApp signal capture with 3 hours saved per rep per week.' },
    { name: 'Amy Walsh', role: 'VP Product', badge: 'POWER USER', status: 'Active', last: '3d ago', eng: 80,
      desc: 'Wants to explore the analytics module and demo it to the wider product team. $75K upsell path.' },
  ],
  // transcribed from the mobile People tab, batch 2 (v11.20)
  'Axion Partners': [
    { name: 'Rachel Voss', role: 'Procurement', badge: 'CHAMPION', status: 'Active', last: '5d ago', eng: 62,
      desc: 'Budget is approved on her side. Asked for a pre-approved redline to get through the legal gate faster.' },
    { name: 'David Hartley', role: 'General Counsel', badge: 'BLOCKER', status: 'Active', last: '2d ago', eng: 45,
      desc: 'Requires SOC2 Type II, penetration test results and a completed DPA before proceeding. 3-5 week delay.' },
    { name: 'Maya Singh', role: 'CTO', badge: 'EXEC SPONSOR', status: 'Quiet', last: '14d ago', eng: 28,
      desc: 'Showed initial interest, then forwarded to procurement. No C-suite engagement since.' },
  ],
  'Brightwave': [
    { name: 'Tom Okafor', role: 'VP Product', badge: 'CHAMPION', status: 'Active', last: '2h ago', eng: 88,
      desc: 'Re-initiated contact after a 2-week gap. Asking for the implementation timeline and training before Q2 kickoff.' },
    { name: 'Nadia Reyes', role: 'CFO', badge: 'DECISION MAKER', status: 'Active', last: '5d ago', eng: 74,
      desc: 'Budget approved on their end. Tom is leading the technical review.' },
    { name: 'Peter Liang', role: 'VP Engineering', badge: 'TECHNICAL', status: 'Active', last: '3d ago', eng: 80,
      desc: 'Ran a POC with the API. Integration is clean, no red flags from his team.' },
  ],
  'Meridian Labs': [
    { name: 'Alex Park', role: 'Head of Revenue Ops', badge: 'CHAMPION', status: 'Active', last: '3d ago', eng: 55,
      desc: 'Original champion but influence limited post-restructure. Supportive but needs exec above her to move.' },
    { name: 'Dana Wu', role: 'Product Lead', badge: 'INFLUENCER', status: 'Active', last: '5d ago', eng: 70,
      desc: 'Enthusiastic about product fit. Could be elevated to co-champion. Has exec access.' },
    { name: 'Rachel Jones', role: 'CFO', badge: 'UNKNOWN', status: 'Never contacted', last: 'never', eng: 0,
      desc: 'Q2 budget decision maker. Not yet engaged. Critical to get on a call before Feb to lock timing.' },
  ],
  'Vertex Systems': [
    { name: 'Dana Kim', role: 'VP Operations', badge: 'CHAMPION', status: 'Active', last: '2d ago', eng: 84,
      desc: 'Highly engaged champion. Actively driving internal buy-in. Keep close and support with exec materials.' },
    { name: 'Chris Lee', role: 'IT Manager', badge: 'INFLUENCER', status: 'Active', last: '3d ago', eng: 88,
      desc: 'Completed security review, passed. Key technical validator. Recommending to VP.' },
    { name: 'Helen Brooks', role: 'CFO', badge: 'DECISION MAKER', status: 'Active', last: '8d ago', eng: 72,
      desc: 'Reviewed financials. Positive on ROI case. Approving after legal clears.' },
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
      quote: "Can you send over the formal proposal and pricing options? We're evaluating 2-3 vendors." },
  ],
  'Meridian Labs': [
    { who: 'Alex Park', role: 'Head of Revenue Ops', via: 'Gmail', tone: 'negative', when: '5d ago',
      quote: "We've pushed the evaluation to Q2 now. Internal restructuring has slowed things down. Let's reconnect in Jan." },
    { who: 'Dana Wu', role: 'Product Lead', via: 'Slack', tone: 'neutral', when: '8d ago',
      quote: 'Still very interested in the platform. Just needs exec sign-off which is a Q2 thing now.' },
    { who: 'Alex Park', role: 'Head of Revenue Ops', via: 'Gmail', tone: 'positive', when: '14d ago',
      quote: 'The demo went well. Team is aligned on fit. Budget is confirmed for next cycle.' },
  ],
  'Nexus AI': [
    { who: 'Marcus Webb', role: 'CEO', via: 'Gmail', tone: 'positive', when: '1d ago',
      quote: "We're very close to signing. Just waiting on legal to clear the last two redlines. Should be done by Friday." },
    { who: 'Priya Shah', role: 'CTO', via: 'Slack', tone: 'positive', when: '2d ago',
      quote: 'The API integration passed all our security tests. Ready on our end.' },
    { who: 'Tom Nguyen', role: 'Legal', via: 'Gmail', tone: 'neutral', when: '3d ago',
      quote: "Two clauses outstanding - data residency and liability cap. We'll have edits by Thursday." },
  ],
  // transcribed from the mobile Comms tab (v11.19)
  'TechVault Inc': [
    { who: 'Kevin Cho', role: 'VP Engineering', via: 'WhatsApp', tone: 'neutral', when: '1d ago',
      quote: 'Need to run this by our CFO first - she wants to see the ROI numbers before approving the budget.' },
    { who: 'Mike Ross', role: 'Account Executive', via: 'Gmail', tone: 'positive', when: '3d ago',
      quote: 'Sent ROI calculator and phased pricing option (60/40 split). Kevin opened both attachments same day.' },
    { who: 'Kevin Cho', role: 'VP Engineering', via: 'Slack', tone: 'positive', when: '7d ago',
      quote: 'Technical eval scored 9.2/10. My team loves the real-time signal detection. Budget is the only blocker.' },
    { who: 'James Burke', role: 'IT Director', via: 'Gmail', tone: 'positive', when: '12d ago',
      quote: 'Security review complete - no issues found. SSO integration tested successfully in our staging environment.' },
  ],
  'Cobalt Health': [
    { who: 'Lisa Park', role: 'CFO', via: 'Gmail', tone: 'positive', when: '5d ago',
      quote: 'Thanks for the seamless onboarding. Team is already using the dashboard daily. Looking forward to the QBR.' },
    { who: 'Raj Kapoor', role: 'Head of RevOps', via: 'Slack', tone: 'positive', when: '7d ago',
      quote: 'Adoption is at 94% after week 2. The WhatsApp signal capture alone saved us 3 hours per rep per week.' },
    { who: 'Amy Walsh', role: 'VP Product', via: 'Gmail', tone: 'positive', when: '10d ago',
      quote: 'Would love to explore the analytics module. Can we schedule a demo for the wider product team?' },
    { who: 'Billing System', role: 'Auto-generated', via: 'Gmail', tone: 'positive', when: 'Dec 28',
      quote: 'Wire transfer of $37,500 received and reconciled against PO-2026-0275. Receipt sent to ops@cobalthealth.com.' },
  ],
  // transcribed from the mobile Comms tab, batch 2 (v11.20)
  'Axion Partners': [
    { who: 'David Hartley', role: 'General Counsel', via: 'Gmail', tone: 'negative', when: '2d ago',
      quote: 'Before we can proceed, we need SOC2 Type II certification, penetration test results, and a completed DPA.' },
    { who: 'Rachel Voss', role: 'Procurement', via: 'Phone', tone: 'neutral', when: '5d ago',
      quote: 'Budget is approved but legal gate is non-negotiable. Can you send a pre-approved redline to expedite?' },
    { who: '#axion-deal', role: 'Internal', via: 'Slack', tone: 'negative', when: '7d ago',
      quote: 'Legal hold confirmed. Rachel flagged 3-5 week minimum delay. No workaround without security docs.' },
    { who: 'Maya Singh', role: 'CTO', via: 'Gmail', tone: 'neutral', when: '21d ago',
      quote: 'Interesting platform. Forwarding to Rachel in procurement to handle the commercial side.' },
  ],
  'Brightwave': [
    { who: 'Tom Okafor', role: 'VP Product', via: 'Gmail', tone: 'positive', when: '2d ago',
      quote: 'What does the implementation timeline look like? We want training done before Q2 kickoff.' },
    { who: 'Nadia Reyes', role: 'CFO', via: 'WhatsApp', tone: 'positive', when: '5d ago',
      quote: 'Budget approved on our end. Tom is leading the technical review - you should hear from him soon.' },
    { who: 'Peter Liang', role: 'VP Engineering', via: 'Slack', tone: 'positive', when: '8d ago',
      quote: 'Ran a POC with the API last week. Integration is clean - no red flags from my team.' },
    { who: 'Andy G', role: 'Account Executive', via: 'Gmail', tone: 'neutral', when: '14d ago',
      quote: 'Sent personalized ROI deck after 2-week silence. Open confirmed within 4 minutes. 3 page views logged.' },
  ],
  'Vertex Systems': [
    { who: 'Dana Kim', role: 'VP Operations', via: 'Gmail', tone: 'positive', when: 'Mar 12',
      quote: 'Shared the proposal with leadership. Everyone is on board. Just waiting for legal to finish their review.' },
    { who: 'Chris Lee', role: 'IT Manager', via: 'Slack', tone: 'positive', when: 'Mar 9',
      quote: 'Completed the security review. Your platform passed everything. Recommending to VP.' },
    { who: 'Dana Kim', role: 'VP Operations', via: 'Gmail', tone: 'positive', when: 'Mar 4',
      quote: 'Great demo last week. The workflow automation feature is exactly what we need.' },
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
  // transcribed from the mobile Timeline tab (v11.19)
  'TechVault Inc': [
    { title: 'CFO Approval Required', kind: 'watch', when: '1d ago',
      body: 'Kevin Cho flagged finance review needed. ROI numbers requested.' },
    { title: 'ROI Package Sent', kind: 'positive', when: '3d ago',
      body: 'Phased pricing (60/40) + ROI calculator delivered. Both opened by Kevin.' },
    { title: 'Technical Eval Passed', kind: 'positive', when: '7d ago',
      body: 'Engineering scored 9.2/10. Kevin personally endorsed. No technical blockers.' },
    { title: 'Demo Completed', kind: 'positive', when: '12d ago',
      body: 'Full product demo with engineering team. Strong alignment on requirements.' },
  ],
  'Cobalt Health': [
    { title: 'QBR Scheduled - Feb 15', kind: 'positive', when: '1d ago',
      body: 'First quarterly review set. Agenda includes upsell discussion for analytics module.' },
    { title: 'Onboarding Complete', kind: 'positive', when: '7d ago',
      body: '94% adoption in 2 weeks. Team using dashboard daily. NPS 72.' },
    { title: 'Contract Signed', kind: 'positive', when: 'Dec 20',
      body: 'Lisa Park (CFO) signed. Jamie Torres assigned as CSM. Go-live Dec 22.' },
    { title: 'First Payment Received', kind: 'positive', when: 'Dec 28',
      body: '$37.5K wire transfer processed. Auto-reconciled against PO.' },
  ],
  // transcribed from the mobile Timeline tab, batch 2 (v11.20)
  'Axion Partners': [
    { title: 'Legal Hold - Security Audit', kind: 'negative', when: '2d ago',
      body: 'General Counsel requires SOC2 + pen test before PO. 3-5 week delay.' },
    { title: 'Procurement Call Complete', kind: 'watch', when: '5d ago',
      body: 'Rachel Voss confirmed budget approved. Legal gate is the only blocker.' },
    { title: 'Proposal Sent', kind: 'positive', when: '10d ago',
      body: 'Competitive pricing proposal delivered. Rachel forwarded to legal same day.' },
    { title: 'CTO Referral', kind: 'positive', when: '21d ago',
      body: 'Maya Singh forwarded to procurement after initial interest. Positive signal.' },
  ],
  'Brightwave': [
    { title: 'Contract Review Started', kind: 'positive', when: '2d ago',
      body: 'Tom Okafor reviewing terms. Internal approval expected by Friday.' },
    { title: 'Re-engaged After Silence', kind: 'positive', when: '5d ago',
      body: 'Tom re-initiated contact after 2-week gap. Asking onboarding questions.' },
    { title: 'Buyer Went Dark', kind: 'watch', when: '19d ago',
      body: 'No response for 14 days. Re-engagement sequence triggered by Popsicle.' },
    { title: 'Initial Proposal Sent', kind: 'positive', when: '21d ago',
      body: 'Full pricing with implementation roadmap. Opened within 4 minutes.' },
  ],
  'Meridian Labs': [
    { title: 'Urgency Campaign Deployed', kind: 'positive', when: '2d ago',
      body: 'Cost-of-delay analysis sent showing $47K/month impact of Q2 push. Re-engagement sequence initiated.' },
    { title: 'Engagement Dropping', kind: 'negative', when: '4d ago',
      body: 'Email response times increasing. Meeting requests going unanswered for 5+ days.' },
    { title: 'Exec Sign-off Needed', kind: 'watch', when: '7d ago',
      body: 'Decision escalated to VP level. Alex Park unable to approve unilaterally.' },
    { title: 'Timeline Pushed to Q2', kind: 'watch', when: '10d ago',
      body: '"Thinking more Q2 now" - pushed without explanation. No reason given for delay.' },
    { title: 'Discovery Call Completed', kind: 'call', when: '14d ago',
      body: 'Initial meeting with Alex Park. Strong interest in revenue intelligence capabilities.' },
  ],
  'Vertex Systems': [
    { title: 'Close Date Confirmed', kind: 'positive', when: '1d ago',
      body: 'Dana Kim confirmed Jan 28 target. Contract review in final stage.' },
    { title: 'Deal Health: Strong', kind: 'positive', when: '3d ago',
      body: 'All engagement metrics positive. Regular communication cadence maintained.' },
    { title: 'Leadership Aligned', kind: 'positive', when: '7d ago',
      body: 'VP of Sales and CRO both expressed support. Internal champion secured at executive level.' },
    { title: 'Security Review Passed', kind: 'positive', when: '10d ago',
      body: 'IT team completed security assessment. All compliance checkboxes cleared.' },
    { title: 'Initial Proposal Delivered', kind: 'call', when: '15d ago',
      body: 'Comprehensive proposal sent to Dana Kim. Competitive pricing for 50-seat deployment.' },
  ],
}

// ---------------------------------------------------------------- transcript
export type DemoTranscript = { account: string; title: string; duration: number; when: string; analyser?: string; summary: string; moments: Array<{ t: string; who: string; tag: string | null; text: string }> }

// One transcript per call event on the deal timelines. Keyed by "<account>::<timeline title>".
export const DEMO_TRANSCRIPTS: Record<string, DemoTranscript> = {
  'Acme Corp::Zoom Call · Discovery': {
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
},

  'Meridian Labs::Discovery Call Completed': {
    account: 'Meridian Labs', title: 'Discovery Call', duration: 38, when: '14 days ago', analyser: 'Zoom · AI analyzed',
    summary: 'Alex Park walked through their current stack and the gap Popsicle would fill. Strong technical interest, but he flagged twice that budget sits with a VP who was not on the call. No decision-maker present, and no date set to get one. That gap is why this deal has since gone quiet.',
    moments: [
      { t: '1:52', who: 'Alex Park', tag: null, text: 'We have Gong for calls but nothing reads the email and WhatsApp side, which is where most of our deals actually happen.' },
      { t: '8:30', who: 'Andy G', tag: null, text: 'That is the gap we built for. Every channel, same detection, and the signal reaches the rep the day it happens rather than in the weekly review.' },
      { t: '15:10', who: 'Alex Park', tag: 'OBJECTION', text: 'The capability is clear. My concern is budget. This size of spend goes to our VP of Revenue Operations and she was not in this conversation.' },
      { t: '19:45', who: 'Alex Park', tag: 'RISK', text: 'I should be honest that we have three tools up for renewal this quarter and she is looking to consolidate, not add.' },
      { t: '26:20', who: 'Andy G', tag: null, text: 'Then the case has to be consolidation. If we replace two of those three, the conversation changes from cost to saving.' },
      { t: '31:05', who: 'Alex Park', tag: 'COMMITMENT', text: 'Send me a one-pager framed that way and I will forward it to her this week.' },
      { t: '35:40', who: 'Alex Park', tag: 'NEXT STEP', text: 'If she bites, we set up a call with her and your team. I will let you know either way by Friday.' },
    ],
  },

  'Vertex Systems::Initial Proposal Delivered': {
    account: 'Vertex Systems', title: 'Proposal Review Call', duration: 31, when: '15 days ago', analyser: 'Zoom · AI analyzed',
    summary: 'Dana Kim took the 50-seat proposal line by line and pushed only on the implementation timeline, not the price. She confirmed a January 28 target and named the two people who have to sign. The cleanest call on the board this quarter.',
    moments: [
      { t: '2:40', who: 'Dana Kim', tag: null, text: 'Pricing is in the range we expected for fifty seats, so let us not spend time there.' },
      { t: '9:15', who: 'Dana Kim', tag: 'OBJECTION', text: 'What worries me is implementation. We have been burned before by a six-week onboarding that turned into five months.' },
      { t: '12:50', who: 'Andy G', tag: null, text: 'Connect the sources and signals start landing the same day. Two weeks to full coverage, and we do the integration work, not your team.' },
      { t: '18:22', who: 'Dana Kim', tag: 'COMMITMENT', text: 'If that holds, I am comfortable putting this in front of our COO next week.' },
      { t: '24:05', who: 'Dana Kim', tag: 'NEXT STEP', text: 'Send the contract to legal and I will chase the COO. We are still aiming to close by January 28.' },
      { t: '29:30', who: 'Dana Kim', tag: null, text: 'One favour: put the two-week onboarding commitment in writing in the contract so I can point to it.' },
    ],
  },

  'Nexus AI::Technical Evaluation Complete': {
    account: 'Nexus AI', title: 'Technical Evaluation Wrap', duration: 45, when: '12 days ago', analyser: 'Zoom · AI analyzed',
    summary: 'Marcus Webb closed out the evaluation with a clear pass. Security and the integration team both signed off, and he moved straight to talking about rollout sequencing rather than whether to buy. Expansion language appeared twice.',
    moments: [
      { t: '3:15', who: 'Marcus Webb', tag: null, text: 'Evaluation is done. Latency and accuracy both came in better than what we run today.' },
      { t: '11:40', who: 'Marcus Webb', tag: 'COMMITMENT', text: 'Security has signed off and the integration team is ready to deploy. We are a yes on the technical side.' },
      { t: '20:05', who: 'Marcus Webb', tag: null, text: 'The question now is sequencing. Do we start with the enterprise team or roll out everyone at once?' },
      { t: '28:50', who: 'Andy G', tag: null, text: 'Start with the team carrying the most pipeline. They generate the proof the rest of the org will want to see.' },
      { t: '34:20', who: 'Marcus Webb', tag: 'NEXT STEP', text: 'Then enterprise first. Send the deployment plan and I will get the kickoff on the calendar.' },
      { t: '41:10', who: 'Marcus Webb', tag: 'COMMITMENT', text: 'If the first quarter goes the way I expect, we will be talking about the other two regions before renewal.' },
    ],
  },

  'TechFlow Inc::Follow-up Call Completed': {
    account: 'TechFlow Inc', title: 'Finance Stakeholder Demo', duration: 34, when: '3 days ago', analyser: 'Zoom · AI analyzed',
    summary: 'Product demo for the finance side. The 3.1x ROI model landed, but their controller asked for a phased start rather than a full annual commitment, and nobody in the room could approve either. The phased option is now the live question.',
    moments: [
      { t: '4:05', who: 'Priya Raman', tag: null, text: 'Walk me through how you arrived at 3.1x, because that is the number my CFO will ask about first.' },
      { t: '12:30', who: 'Andy G', tag: null, text: 'It is two lines: revenue protected from deals that would have slipped, and time returned to reps. Both come from your own numbers, not ours.' },
      { t: '17:55', who: 'Priya Raman', tag: 'OBJECTION', text: 'The model is credible. Committing to a full year in one go is the part I cannot get through this quarter.' },
      { t: '22:40', who: 'Priya Raman', tag: null, text: 'Is there a version where we start at sixty percent of the seats and expand once we see the return?' },
      { t: '27:15', who: 'Andy G', tag: 'NEXT STEP', text: 'Yes. I will send a phased structure: sixty percent now, the rest on renewal once the ROI is measured.' },
      { t: '31:50', who: 'Priya Raman', tag: 'RISK', text: 'Fair warning, our CFO has final say and he has not seen any of this yet.' },
    ],
  },

  'TechFlow Inc::Proposal Delivered': {
    account: 'TechFlow Inc', title: 'Proposal Walkthrough', duration: 28, when: '10 days ago', analyser: 'Zoom · AI analyzed',
    summary: 'Three-tier pricing presented to Jamie Torres. He favoured the middle tier and asked for the annual discount in writing. No objection to the product, only to how quickly the decision can move through their finance calendar.',
    moments: [
      { t: '2:10', who: 'Jamie Torres', tag: null, text: 'The middle tier is where we land. The top one has seats we would not use this year.' },
      { t: '9:35', who: 'Jamie Torres', tag: 'OBJECTION', text: 'The annual discount needs to be in the document. Verbal will not survive our procurement process.' },
      { t: '14:20', who: 'Andy G', tag: 'COMMITMENT', text: 'I will put the discount in the proposal and resend it today.' },
      { t: '19:45', who: 'Jamie Torres', tag: 'RISK', text: 'Our finance calendar closes for new spend in two weeks. After that we are into next quarter.' },
      { t: '25:30', who: 'Jamie Torres', tag: 'NEXT STEP', text: 'Get me the revised document and I will start the internal approval on Monday.' },
    ],
  },
}

// Kept for anything still importing the single transcript.
export const DEMO_TRANSCRIPT = DEMO_TRANSCRIPTS['Acme Corp::Zoom Call · Discovery']

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
  // drafted from each account's timeline and comms (v11.59)
  'Meridian Labs': [
    { name: 'Enterprise Platform', type: 'Annual subscription · proposed', status: 'PENDING EXEC SIGN-OFF', value: '$850K', po: 'Not raised', start: 'Apr 1, 2027', end: 'Mar 31, 2028', invoice: 'Budget pre-approved in the Q2 cycle; decision escalated to VP level' },
  ],
  'Brightwave': [
    { name: 'Growth Plan', type: 'Annual subscription', status: 'IN REVIEW', value: '$180K', po: 'Pending', start: 'Mar 1, 2027', end: 'Feb 28, 2028', invoice: 'Tom Okafor reviewing terms; internal approval expected by Friday' },
  ],
  'Axion Partners': [
    { name: 'Enterprise License', type: 'Annual subscription · redline', status: 'LEGAL HOLD', value: '$95K', po: 'Blocked', start: 'TBD', end: 'TBD', invoice: 'SOC2 Type II, penetration test results and DPA required before PO' },
  ],
  'TechFlow Inc': [
    { name: 'Growth Plan, phased', type: '60/40 phased annual', status: 'PROPOSAL SENT', value: '$210K', po: 'Not raised', start: 'Feb 1, 2027', end: 'Jan 31, 2028', invoice: 'Phased pricing option sent; CFO ROI calculator attached' },
  ],
  'TechVault Inc': [
    { name: 'Growth Plan, phased', type: '60% start, expand after ROI', status: 'AWAITING CFO', value: '$140K', po: 'Not raised', start: 'Mar 15, 2027', end: 'Mar 14, 2028', invoice: 'ROI package delivered; finance review requested by Kevin Cho' },
  ],
  'Vertex Systems': [
    { name: '50-seat Deployment', type: 'Annual subscription', status: 'CONTRACT REVIEW', value: '$175K', po: 'Pending', start: 'Feb 1, 2027', end: 'Jan 31, 2028', invoice: 'Legal received the contract last week; close target Jan 28' },
  ],
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
  // Cobalt Health AI Executive Brief, transcribed from the mobile Overview (v11.19)
  'Cobalt Health': [
    { tone: 'positive', text: 'Contract signed Dec 20 - onboarding kicked off with implementation team.' },
    { tone: 'positive', text: 'Jamie Torres assigned as CSM - first QBR scheduled for Feb 15, 2026.' },
    { tone: 'watch', text: 'Expansion opportunity: $75K upsell for analytics module - champion interested.' },
    { tone: 'positive', text: 'NPS score: 72 after initial deployment. Strong internal advocacy building.' },
  ],
  // AI Executive Briefs / AI Risk Signals, transcribed from the mobile Overview, batch 2 (v11.20)
  'Axion Partners': [
    { tone: 'high', text: 'Legal team loop-in adds 3-5 weeks to close timeline - highest delay risk.' },
    { tone: 'high', text: 'No C-suite engagement yet - deal depends entirely on mid-level champion.' },
    { tone: 'watch', text: 'Competitor (Clari) mentioned in internal Slack - evaluation may be underway.' },
    { tone: 'watch', text: 'Send pre-approved redline contract to bypass legal review cycle.' },
  ],
  'Brightwave': [
    { tone: 'positive', text: 'Buyer re-engaged after 2-week silence - strong buying intent confirmed via onboarding questions.' },
    { tone: 'positive', text: 'Tom Okafor actively requesting implementation timeline - close readiness 88%.' },
    { tone: 'watch', text: 'Send onboarding preview package within 24 hours to maintain momentum.' },
    { tone: 'watch', text: 'Previous stall was budget-related - confirm finance approval before contract send.' },
  ],
  'Vertex Systems': [
    { tone: 'positive', text: 'Champion proactively sharing materials internally. Strong buy-in from IT and operations.' },
    { tone: 'positive', text: 'Legal received contract last week - no objections raised yet.' },
    { tone: 'watch', text: 'Close date is Jan 28. Legal timeline may be tight without active follow-up.' },
  ],
  'TechVault Inc': [
    { tone: 'watch', text: '"Check with finance first" on WhatsApp - price sensitivity confirmed.' },
    { tone: 'watch', text: 'CFO not yet involved - decision requires budget committee sign-off.' },
    { tone: 'positive', text: 'Technical evaluation scored 9.2/10 - product fit is strong.' },
    { tone: 'watch', text: 'Send phased pricing proposal: 60% start, expand after ROI proven.' },
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
  exposure?: number          // mobile Coverage & Ownership: exposure per rep
  improvedAccts?: number; stabilized?: number   // mobile Stabilization Efficiency
}
export type TeamAction = { rep: string; account: string; when: string; action: string; driver: string; from: number; to: number; recovered: number }
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
  // mobile-only sections
  exposure?: { total: number; stabilizedThisWeek: number; aiConfidence: number; updated: string }
  unowned?: { count: number; risk: number; stale: number }
  actionsFeed?: TeamAction[]
  executionInsight?: string
  headline?: string
}

export const DEMO_TEAM: TeamModel = {
  // Mobile Team Intelligence is the source of truth (v11.23)
  protectedTotal: 560_000, protectedDeltaPct: 38,
  waitingCount: 7, waitingValue: 2_170_000, criticalWithOneRep: false,
  headline: 'Mike Ross is 2.5x slower on first action.',
  bullets: [
    { tone: '#2f8f5b', text: 'Exec calls have 83% success rate vs 74% for follow-ups, the highest-impact intervention by far.' },
    { tone: '#E85A25', text: "Andy G's 2.1h response is half the team median. 12 signals caught, 4 deals recovered, $284K protected." },
    { tone: '#d38b1d', text: 'Mike Ross at 6.7h time-to-action. Loop closure 13 points below team average. Coaching on urgency recommended.' },
    { tone: '#0E0D0B', text: 'Jamie Torres closed the Meridian invoice dispute (+$44K) and holds Cobalt at NPS 72. Improving on follow-through, 81%.' },
  ],
  exposure: { total: 892_000, stabilizedThisWeek: 284_000, aiConfidence: 87, updated: '12 min ago' },
  arr: 2_640_000, accountCount: 9,
  split: [
    { k: 'Critical', color: '#c43d2b', value: 575_000, accts: 2 },
    { k: 'Watching', color: '#d38b1d', value: 1_200_000, accts: 3 },
    { k: 'Healthy', color: '#2f8f5b', value: 825_000, accts: 4 },
  ],
  timeToAction: 4.2, timeToActionDelta: 0,
  coveragePct: 85, covered: 8,
  signalsThisWeek: 47, actioned: 40, autoDeployedPct: 62,
  reps: [
    {
      name: 'Andy G', title: 'VP of Sales', color: '#FF6B35',
      accounts: ['Acme Corp', 'Brightwave', 'Axion Partners', 'Vertex Systems'], arr: 930_000, exposure: 480_000,
      signals: 12, saved: 4, protectedValue: 284_000, avgResp: 2.1, saveRate: 88, churnDelta: -19, performance: 88,
      badge: 'Top performer', badgeTone: 'accent', trend: 'improving',
      improvedAccts: 4, stabilized: 142_000,
      spark: [3.1, 2.8, 3.0, 2.4, 2.6, 2.2, 2.1],
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
      accounts: ['Nexus AI', 'TechFlow Inc', 'TechVault Inc'], arr: 670_000, exposure: 295_000,
      signals: 9, saved: 2, protectedValue: 176_000, avgResp: 6.7, saveRate: 64, churnDelta: -14, performance: 64,
      badge: 'Most closes', badgeTone: 'blue', trend: 'needs coaching',
      improvedAccts: 3, stabilized: 98_000,
      spark: [5.2, 5.6, 5.9, 6.1, 6.4, 6.6, 6.7],
      activity: [
        [0, 1, 3, 3, 3, 0, 0],
        [2, 2, 2, 2, 2, 0, 0],
        [1, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 0, 0],
        [0, 0, 2, 0, 0, 0, 0],
      ],
      ownership: 'stale', ownershipNote: 'Stale 3d', followThrough: 64, closure: 58,
    },
    {
      name: 'Jamie Torres', title: 'AE', color: '#7C5CFC',
      accounts: ['Meridian Labs', 'Cobalt Health'], arr: 1_000_000, exposure: 167_000,
      signals: 6, saved: 1, protectedValue: 100_000, avgResp: 3.8, saveRate: 81, churnDelta: -11, performance: 74,
      badge: 'Improving', badgeTone: 'warn', trend: 'steady',
      improvedAccts: 2, stabilized: 44_000,
      spark: [4.1, 4.0, 3.9, 4.0, 3.8, 3.9, 3.8],
      activity: [
        [0, 1, 2, 3, 1, 1, 0],
        [1, 2, 2, 2, 1, 0, 0],
        [1, 1, 2, 1, 1, 0, 0],
        [1, 1, 1, 1, 2, 0, 0],
        [0, 0, 1, 0, 0, 0, 0],
      ],
      ownership: 'active', followThrough: 81, closure: 74,
    },
  ],
  queue: [
    { account: 'Acme Corp', sev: 'critical', summary: 'CFO silent 8 days · 3 emails opened, 0 replies', age: '8d', rep: 'Andy G' },
    { account: 'Meridian Labs', sev: 'critical', summary: 'Timeline pushed to Q2 · exec sign-off needed', age: '5d', rep: 'Jamie Torres' },
    { account: 'TechFlow Inc', sev: 'high', summary: 'Price flinch on WhatsApp · "check with finance first"', age: '3h', rep: 'Mike Ross' },
    { account: 'Axion Partners', sev: 'high', summary: 'Legal hold day 3 · SOC2 + pen test before PO', age: '3d', rep: 'Andy G' },
    { account: 'TechVault Inc', sev: 'high', summary: 'CFO approval required · ROI numbers requested', age: '2d', rep: 'Mike Ross' },
    { account: 'Vertex Systems', sev: 'medium', summary: 'Proposal opened 5x · no next step set', age: '4d', rep: 'Andy G' },
    { account: 'Brightwave', sev: 'medium', summary: 'Contract review started · approval expected Friday', age: '1d', rep: 'Andy G' },
  ],
  unresolvedPct: 15,
  newCritical: 2, stabilized: 3, actionsTaken: 14, signalsPerDay: 6.7, signalsPerDayDelta: 2.1,
  criticalOwned: '8/10', activeFollowUp: '6/10',
  unowned: { count: 2, risk: 245_000, stale: 2 },
  followThrough: 78, loopClosure: 71,
  executionInsight: 'Mike Ross is 2.5x slower than team median on first action. Loop closure rate 13 points below team average.',
  actionsFeed: [
    { rep: 'Andy G', account: 'Brightwave', when: 'Mar 18', action: 'Executive sponsor call - re-engagement confirmed', driver: 'Exec Disengagement', from: 74, to: 31, recovered: 62_000 },
    { rep: 'Mike Ross', account: 'Nexus AI', when: 'Mar 11', action: 'Multi-stakeholder follow-up after 5-day dark period', driver: 'Silent Stall', from: 55, to: 28, recovered: 38_000 },
    { rep: 'Jamie Torres', account: 'Meridian Labs', when: 'Mar 6', action: 'Invoice dispute resolved - AP contact re-engaged', driver: 'Invoice Delay', from: 66, to: 48, recovered: 44_000 },
    { rep: 'Andy G', account: 'Vertex Systems', when: 'Mar 3', action: 'Competitive battle card delivered to champion', driver: 'Competitor Activity', from: 61, to: 38, recovered: 36_000 },
  ],
}

// ---------- Intelligence (transcribed from the mobile Intelligence screen, v11.10) ----------
export type IntelModel = {
  riskDeltaPct: number; driver: string; holdingPct: number; protectedTotal: number
  bullets: Array<{ tone: string; lead: string; rest: string }>
  weekNo: number; newRisk: number; firstWeekRisk: number
  stabilized: number; netChangePct: number
  drivers: Array<{ k: string; v: number }>              // v < 0 = reduced risk (green, shown with +)
  weeks: Array<{ label: string; added: number; stabilized: number; top?: { account: string; title: string; amount: number } }>
  riskSits: Array<{ k: string; pct: number; exposure: number; color: string }>
  actions: Array<{ k: string; used: number; success: number; churn: number }>
  successRate: number; successTarget: number; recovered: number; caughtEarly: number
  fasterDays: number; insight: string
  forecast?: { forecast: number; actual: number }
  sources: Array<{ k: string; n: number }>
  renewals: Array<{ account: string; days: number; value: number; status: 'at risk' | 'monitor' | 'on track' }>
  // mobile-only
  hero?: { protectedTotal: number; caughtEarly: number; recovered: number; fasterDays: number }
  performance?: { riskChangePct: number; successRatePct: number; stabilized: number }
  storyChips?: string[]
  bySegment?: Array<{ k: string; v: number; color: string }>
  byHealth?: Array<{ k: string; n: number; color: string }>
  exposureTrend?: { total: number; vsPrior: number; peak: string; trajectory: string; weeks: string[]; shape: number[] }
}

export const DEMO_INTELLIGENCE: IntelModel = {
  // Mobile Revenue Intelligence is the source of truth (v11.23)
  riskDeltaPct: 35, driver: 'executive disengagement', holdingPct: 78, protectedTotal: 560_000,
  hero: { protectedTotal: 560_000, caughtEarly: 42, recovered: 7, fasterDays: 3.4 },
  performance: { riskChangePct: 8, successRatePct: 78, stabilized: 284_000 },
  storyChips: ['3 Deteriorated', '1 Recovered', '+$85K Net Risk'],
  bullets: [
    { tone: '#c43d2b', lead: '3 accounts deteriorated', rest: ': Acme, TechFlow, Meridian.' },
    { tone: '#2f8f5b', lead: 'Brightwave re-engaged', rest: ' after 2 weeks dark.' },
    { tone: '#d38b1d', lead: 'Net pipeline risk +$85K', rest: ' · intervention rate 78%.' },
    { tone: '#E85A25', lead: 'Focus today:', rest: ' Meridian CRO video + Axion legal prep.' },
  ],
  weekNo: 8, newRisk: 579_000, firstWeekRisk: 429_000,
  stabilized: 290_000, netChangePct: 8,
  drivers: [
    { k: 'Exec disengagement', v: 85_000 },
    { k: 'SLA resolution', v: -62_000 },
    { k: 'New competitor', v: 45_000 },
  ],
  weeks: [
    // shape read off the mobile chart: rises W1-W3, dips W4, climbs to W8 (+35% W1 to W8)
    { label: 'W1', added: 429_000, stabilized: 210_000 },
    { label: 'W2', added: 452_000, stabilized: 236_000 },
    { label: 'W3', added: 461_000, stabilized: 258_000 },
    { label: 'W4', added: 440_000, stabilized: 244_000 },
    { label: 'W5', added: 494_000, stabilized: 262_000 },
    { label: 'W6', added: 517_000, stabilized: 275_000 },
    { label: 'W7', added: 534_000, stabilized: 281_000 },
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
  successRate: 78, successTarget: 80, recovered: 7, caughtEarly: 42,
  fasterDays: 3.4,
  insight: 'Executive calls cut churn most per intervention (−31%) but are used least. Follow-ups carry the volume at 74% effectiveness.',
  forecast: { forecast: 1_240_000, actual: 1_180_000 },
  sources: [
    { k: 'Gmail / Outlook', n: 372 },
    { k: 'WhatsApp', n: 251 },
    { k: 'Slack', n: 152 },
    { k: 'Zoom / Calls', n: 72 },
  ],
  renewals: [
    { account: 'Meridian Labs', days: 32, value: 245_000, status: 'at risk' },
    { account: 'NovaCorp', days: 58, value: 310_000, status: 'monitor' },
    { account: 'Brightwave', days: 74, value: 195_000, status: 'on track' },
    { account: 'Vertex Systems', days: 88, value: 142_000, status: 'on track' },
  ],
  bySegment: [{ k: 'Enterprise', v: 607_000, color: '#c43d2b' }, { k: 'Mid-Market', v: 214_000, color: '#d38b1d' }, { k: 'SMB', v: 71_000, color: '#7C5CFC' }],
  byHealth: [{ k: 'Critical', n: 3, color: '#c43d2b' }, { k: 'Monitor', n: 2, color: '#d38b1d' }, { k: 'Healthy', n: 3, color: '#2f8f5b' }],
  exposureTrend: { total: 892_000, vsPrior: 145_000, peak: '$1.04M (W3)', trajectory: 'Worsening +12%/wk', weeks: ['W1', 'W2', 'W3', 'W4', 'Now'], shape: [0.3, 0.45, 0.4, 0.62, 0.55, 0.78, 0.7, 0.95] },
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

// ---------- Signals stat row (transcribed from the mobile Signals screen, v11.13) ----------
export const DEMO_PULSE_WEEK = { signals: 47, fresh: 12 }
export const DEMO_SIGNALS_HEAD = [
  { n: '2', lbl: 'critical · $1.33M at risk', tone: 'critical' as const },
  { n: '4', lbl: 'watch · $655K exposure', tone: 'warn' as const },
  { n: '1', lbl: 'positive · $320K closing', tone: 'good' as const },
  { n: '47', lbl: 'signals this week · 12 new', tone: 'ink' as const, strong: true },
]

// ---------- Forecast movers (transcribed from the mobile Forecast screen, v11.14) ----------
export const DEMO_MOVERS = [
  { name: 'Nexus AI', tag: 'Closing', tone: 'good' as const, note: 'PO expected this week · legal clear', swing: 320_000, prob: 84 },
  { name: 'Meridian Labs', tag: 'Renewal at risk', tone: 'critical' as const, note: 'Timeline slipping to Q2 · 5 days dark', swing: -850_000, prob: 41 },
  { name: 'Acme Corp', tag: 'Stalled', tone: 'critical' as const, note: 'CFO silent 8 days · competitor in play', swing: -480_000, prob: 38 },
  { name: 'Brightwave', tag: 'Expansion', tone: 'good' as const, note: 'Pilot converting · RevOps re-engaged', swing: 180_000, prob: 72 },
]

// ---------- Integrations (demo volume: seven sources, 847 signals in 30 days, v11.17) ----------
// thisMonth sums to 847 and lines up with the Intelligence "Signal sources"
// column (Gmail 310 · WhatsApp 194 · Slack 128 · Calendar & Meet 96 · calls & CRM 119).
const _d = (daysAgo: number, h = 9) => new Date(DEMO_NOW - daysAgo * 86400000 - (24 - h) * 3600000).toISOString()
const _sync = (minsAgo: number) => new Date(DEMO_NOW - minsAgo * 60000).toISOString()
export const DEMO_INTEGRATION_ACTIVE = ['gmail', 'whatsapp', 'slack', 'zoom']
export const DEMO_INTEGRATION_STATS: Record<string, { total: number; thisMonth: number; high: number; watch: number; positive: number; lastSignal: string | null; connectedAt: string | null; lastSynced: string | null; identity?: string | null }> = {
  // mobile Signal Source Breakdown: 847 signals · 4 active sources
  gmail:    { total: 1_214, thisMonth: 372, high: 49, watch: 201, positive: 122, lastSignal: _sync(18), connectedAt: _d(112), lastSynced: _sync(12), identity: 'andy@popsicle-labs.app' },
  whatsapp: { total: 761,   thisMonth: 251, high: 28, watch: 141, positive: 82,  lastSignal: _sync(41), connectedAt: _d(88),  lastSynced: _sync(12), identity: '+62 812 · Popsicle Sales' },
  slack:    { total: 478,   thisMonth: 152, high: 17, watch: 84,  positive: 51,  lastSignal: _sync(66), connectedAt: _d(104), lastSynced: _sync(12), identity: 'Popsicle Labs' },
  zoom:     { total: 237,   thisMonth: 72,  high: 9,  watch: 35,  positive: 28,  lastSignal: _d(1, 16), connectedAt: _d(61),  lastSynced: _sync(48), identity: 'andy@popsicle-labs.app' },
}

// ---------- Forecast headline figures (mobile Pulse + Intelligence: $1.24M forecast, $1.18M actual, v11.23) ----------
export const DEMO_FORECAST = {
  commit: 1_240_000, weighted: 1_180_000, bestCase: 2_400_000, atRisk: 1_330_000,
  riskyDeals: 2, dealsToClose: 4, accuracy: 86, daysLeft: 8, commitDeltaPct: 12,
}

// ---------- Pulse stat strip (desktop design, aligned to mobile: 4 integrations, v11.25) ----------
export const DEMO_PULSE_STRIP = {
  atRisk: 1_200_000, atRiskDelta: 85_000, high: 3, med: 4, low: 2,
  active: 47, newToday: 12, critical: 18, warn: 16, positive: 13,
  protectedTotal: 560_000, protectedDeltaPct: 38, saved: 4, actions: 12, hitPct: 94,
  aiConfidence: 91, integrations: 4, syncedAgo: '2 min ago',
}

// ---------- Pulse late commitments (from the demo timelines and transcript, v11.29) ----------
export const DEMO_LATE_COMMITMENTS = [
  { id: 'demo-lc-1', text: 'Send the Gong comparison doc and security whitepaper to Sarah Chen', account: 'Acme Corp', daysLate: 2 },
  { id: 'demo-lc-2', text: 'Send pre-approved redline contract to Rachel Voss', account: 'Axion Partners', daysLate: 5 },
  { id: 'demo-lc-3', text: 'Book the legal check-in with Dana Kim ahead of the Jan 28 close', account: 'Vertex Systems', daysLate: 0 },
]

// Full source threads behind the headline comms quotes. Keyed by "<account>::<who>".
export const DEMO_THREADS: Record<string, { account: string; channel: string; subject: string; when: string; participants: string[]; messages: Array<{ who: string; role?: string; when: string; text: string; mine?: boolean; flag?: string }> }> = {
  'Acme Corp::Sarah Chen': {
    account: 'Acme Corp', channel: 'Gmail', subject: 'Re: Renewal pricing — FY27', when: 'last 8 days', participants: ['Sarah Chen', 'Andy G', 'James Park'],
    messages: [
      { who: 'Andy G', when: '8 days ago', mine: true, text: 'Hi Sarah — attaching the FY27 renewal summary ahead of Thursday. Same scope as this year, with the two seats you added in March rolled in.\n\nHappy to walk through it live if that is easier.' },
      { who: 'Sarah Chen', role: 'CFO', when: '6 days ago', text: 'Thanks Andy. Reviewing with the team this week.' },
      { who: 'Andy G', when: '4 days ago', mine: true, text: 'Checking in — anything you need from me before Thursday?' },
      { who: 'Sarah Chen', role: 'CFO', when: '2 days ago', flag: 'OBJECTION', text: 'We need to discuss the new pricing structure before we can commit to renewal. Finance team has concerns about the increase relative to what we budgeted in Q3.\n\nCan we hold Thursday until I have had that conversation internally?' },
      { who: 'Andy G', when: '2 days ago', mine: true, text: 'Understood. Let me send the year-on-year breakdown so the increase is easy to defend internally — most of it is the seats you added, not a rate change.' },
      { who: 'Sarah Chen', role: 'CFO', when: '—', flag: 'SIGNAL', text: '(no reply · email opened 4 times since)' },
    ],
  },
  'Axion Partners::Rachel Voss': {
    account: 'Axion Partners', channel: 'Slack · #axion-deal', subject: 'Security review and redline status', when: 'last 6 days', participants: ['Rachel Voss', 'Andy G', 'Legal (Axion)'],
    messages: [
      { who: 'Rachel Voss', role: 'Head of Procurement', when: '6 days ago', text: 'Our legal team has flagged a few clauses in the MSA. Sending the redline over today.' },
      { who: 'Andy G', when: '6 days ago', mine: true, text: 'Great — send it across and we will turn it around fast. Most of what comes back is standard for us.' },
      { who: 'Rachel Voss', role: 'Head of Procurement', when: '5 days ago', flag: 'RISK', text: 'Legal hold confirmed. They want SOC2 Type II, penetration test results and a signed DPA before the PO can be raised. Realistically three to five weeks.' },
      { who: 'Andy G', when: '5 days ago', mine: true, text: 'All three exist. Sending SOC2 and the pen test summary now, DPA follows today. If your team reviews in parallel rather than in sequence we can pull that timeline in considerably.' },
      { who: 'Rachel Voss', role: 'Head of Procurement', when: '5 days ago', flag: 'COMMITMENT', text: 'Send them and I will push for parallel review.' },
      { who: 'Andy G', when: '—', mine: true, flag: 'SIGNAL', text: '(pre-approved redline contract still unsent · 5 days late)' },
    ],
  },
  'TechVault Inc::Kevin Cho': {
    account: 'TechVault Inc', channel: 'WhatsApp', subject: 'Budget approval and ROI', when: 'last 5 days', participants: ['Kevin Cho', 'Andy G'],
    messages: [
      { who: 'Kevin Cho', role: 'VP Sales', when: '5 days ago', text: 'Demo went well with the team. Everyone liked what they saw.' },
      { who: 'Andy G', when: '5 days ago', mine: true, text: 'Glad to hear it. What is the next step on your side?' },
      { who: 'Kevin Cho', role: 'VP Sales', when: '4 days ago', flag: 'OBJECTION', text: 'Need to run this by our CFO first. He will want to see ROI numbers before approving the spend.' },
      { who: 'Andy G', when: '4 days ago', mine: true, text: 'Sending an ROI package built on your own pipeline numbers rather than generic benchmarks. It should answer the question before he asks it.' },
      { who: 'Kevin Cho', role: 'VP Sales', when: '2 days ago', flag: 'COMMITMENT', text: 'Got it, forwarding to finance today. Will come back to you once he has looked.' },
      { who: 'Kevin Cho', role: 'VP Sales', when: '—', flag: 'SIGNAL', text: '(quiet since · CFO has not responded)' },
    ],
  },
  'Meridian Labs::Alex Park': {
    account: 'Meridian Labs', channel: 'Gmail', subject: 'Re: Consolidation one-pager', when: 'last 12 days', participants: ['Alex Park', 'Andy G'],
    messages: [
      { who: 'Andy G', when: '12 days ago', mine: true, text: 'Alex — the one-pager we discussed, framed as consolidation rather than new spend. It shows which two of your three renewals Popsicle replaces.' },
      { who: 'Alex Park', role: 'Director of RevOps', when: '11 days ago', flag: 'COMMITMENT', text: 'This is exactly the framing she needs. Forwarding today.' },
      { who: 'Andy G', when: '7 days ago', mine: true, text: 'Any read from her yet?' },
      { who: 'Alex Park', role: 'Director of RevOps', when: '6 days ago', text: 'Not yet. She is in planning until the end of the month.' },
      { who: 'Andy G', when: '3 days ago', mine: true, text: 'Worth me joining a short call with her directly? Happy to take the consolidation question head on.' },
      { who: 'Alex Park', role: 'Director of RevOps', when: '—', flag: 'SIGNAL', text: '(no reply in 3 days · previously replied within a day)' },
    ],
  },
}

// What the demo rep did recently, and what happened since: the agent's follow-through.
export const DEMO_FOLLOWUPS = [
  { id: 'demo-fu-1', account: 'Brightwave', did: 'You sent Tom Okafor the ROI deck on Tuesday', since: 'He opened it three times and replied that finance is reviewing, back to you Friday', view: 'That is a yes forming. Leave it until Friday, then book the signing call', when: new Date(Date.now() - 2 * 86_400_000).toISOString() },
  { id: 'demo-fu-2', account: 'TechVault Inc', did: 'You sent Kevin Cho the ROI package two days ago', since: 'He forwarded it to finance. The CFO has not opened it', view: 'Waiting will not change that. Offer Kevin a fifteen-minute walkthrough with the CFO this week', when: new Date(Date.now() - 2 * 86_400_000).toISOString() },
]

// ---------------------------------------------------------------------------
// v11.116: the demo's headline figures, COMPUTED from the data above with the same functions
// the screens and the explanations use. Nothing below is typed in by hand.
// ---------------------------------------------------------------------------
export const DEMO_RATINGS = [
  { type: 'Silent stall', useful: 31, rated: 33 }, { type: 'Price flinch', useful: 24, rated: 27 },
  { type: 'Competitor mention', useful: 17, rated: 19 }, { type: 'Timeline slip', useful: 15, rated: 17 },
  { type: 'Legal loop-in', useful: 13, rated: 14 }, { type: 'Champion change', useful: 9, rated: 10 },
  { type: 'Buying signal', useful: 7, rated: 8 },
]
const _acc = DEMO_ACCOUNTS as unknown as M.Acct[], _sig = DEMO_SIGNALS as unknown as M.Sig[]
export const DEMO_X = {
  atRisk: M.atRisk(_acc, _sig), active: M.activeSignals(_acc, _sig, DEMO_NOW), protectedRevenue: M.protectedRevenue(_acc, _sig),
  commit: M.commit(_acc, _sig), totalArr: M.totalArr(_acc), ratedPrecision: M.ratedPrecision(DEMO_RATINGS),
}
{
  const open = _sig.filter(x => !x.is_dismissed && (!x.status || x.status === 'open'))
  const lvl = (l: string) => _acc.filter(a => a.risk_level === l).length
  Object.assign(DEMO_PULSE_STRIP, {
    atRisk: DEMO_X.atRisk.value, atRiskDelta: 0, high: lvl('high'), med: lvl('medium'), low: lvl('low'),
    active: open.length, newToday: open.filter(x => x.created_at && DEMO_NOW - new Date(x.created_at).getTime() <= 24 * 3600e3).length,
    critical: open.filter(x => x.severity === 'high').length, warn: open.filter(x => x.severity === 'watch').length, positive: open.filter(x => x.severity === 'positive').length,
    protectedTotal: DEMO_X.protectedRevenue.value, saved: DEMO_X.protectedRevenue.parts.length, actions: _sig.filter(x => x.status === 'handled').length,
    aiConfidence: Math.round(_sig.map(x => Number((x.ai_analysis as { confidence?: number } | null)?.confidence)).filter(Number.isFinite).reduce((a, b, _i, arr) => a + b / arr.length, 0)),
  })
  Object.assign(DEMO_FORECAST, { commit: DEMO_X.commit.value, atRisk: DEMO_X.atRisk.value })
  const watchOnly = [...new Set(open.filter(x => x.severity === 'watch' && Number(x.risk_amount || 0) > 0).map(x => x.account_name || ''))]
    .filter(n => n && !open.some(x => x.account_name === n && x.severity === 'high'))
  const watchVal = watchOnly.reduce((t, n) => t + Math.max(0, ...open.filter(x => x.account_name === n).map(x => Number(x.risk_amount || 0))), 0)
  const posAccts = [...new Set(open.filter(x => x.severity === 'positive').map(x => x.account_name || ''))].filter(Boolean)
  DEMO_SIGNALS_HEAD.splice(0, DEMO_SIGNALS_HEAD.length,
    { n: String(DEMO_X.atRisk.parts.length), lbl: `critical · ${DEMO_X.atRisk.valueText} at risk`, tone: 'critical' as const },
    { n: String(watchOnly.length), lbl: `watch · ${M.money(watchVal)} exposure`, tone: 'warn' as const },
    { n: String(posAccts.length), lbl: 'positive · momentum', tone: 'good' as const },
    { n: String(open.length), lbl: `open signals · ${DEMO_PULSE_STRIP.newToday} new today`, tone: 'ink' as const, strong: true } as never,
  )
}

// v11.117: Intelligence, Team and Revenue Loop figures computed from the same data
{
  const caught = M.caughtEarly(_acc, _sig), saves = DEMO_X.protectedRevenue.parts.length
  if (DEMO_INTELLIGENCE.hero) Object.assign(DEMO_INTELLIGENCE.hero, { protectedTotal: DEMO_X.protectedRevenue.value, caughtEarly: caught.value, recovered: saves })
  Object.assign(DEMO_INTELLIGENCE, { protectedTotal: DEMO_X.protectedRevenue.value })
  for (const r of DEMO_TEAM.reps) r.exposure = M.repExposure(r.name, r.accounts, _acc, _sig).value
  if (DEMO_TEAM.exposure) DEMO_TEAM.exposure.total = M.teamExposure(DEMO_TEAM.reps.map(r => ({ name: r.name, accounts: r.accounts })), _acc, _sig).value
}
export const DEMO_LOOP = {
  signals: M.newToday(_acc, _sig, DEMO_NOW).value, cases: M.activeCases(_acc, _sig).value,
  ready: M.actionsReady(_acc, _sig).value, protectedValue: DEMO_X.protectedRevenue.value,
}

// v11.121: past decisions, each with the evidence that existed when it was made (institutional memory)
import { snapshotFor } from './decisions'
import { asOf } from './replay'
export const DEMO_DECISIONS = [
  { id: 'demo-dec-1', account_name: 'Acme Corp', decision: 'Hold the price; offer an 8% multi-year discount only if they sign by the 30th', owner: 'Andy G', due_at: iso(-72), status: 'open' as const, source: 'review', review_id: 'demo-review-1',
    evidence: { ...snapshotFor('Acme Corp', _acc, asOf(_sig, DEMO_NOW - 7 * 864e5), DEMO_NOW - 7 * 864e5), capturedAt: new Date(DEMO_NOW - 7 * 864e5).toISOString() }, created_at: new Date(DEMO_NOW - 7 * 864e5).toISOString(), by: 'Andy G' },
  { id: 'demo-dec-2', account_name: 'Meridian Labs', decision: 'Escalate to the VP of RevOps directly; Jamie to request a 20-minute consolidation review', owner: 'Jamie Torres', due_at: iso(-48), status: 'open' as const, source: 'review', review_id: 'demo-review-1',
    evidence: { ...snapshotFor('Meridian Labs', _acc, asOf(_sig, DEMO_NOW - 7 * 864e5), DEMO_NOW - 7 * 864e5), capturedAt: new Date(DEMO_NOW - 7 * 864e5).toISOString() }, created_at: new Date(DEMO_NOW - 7 * 864e5).toISOString(), by: 'Andy G' },
  { id: 'demo-dec-3', account_name: 'Brightwave', decision: 'No discount; lead with the ROI case and wait for finance’s Friday answer', owner: 'Andy G', due_at: null, status: 'done' as const, source: 'review', review_id: 'demo-review-0',
    evidence: { ...snapshotFor('Brightwave', _acc, asOf(_sig, DEMO_NOW - 36.5 * 864e5), DEMO_NOW - 36.5 * 864e5), capturedAt: new Date(DEMO_NOW - 36.5 * 864e5).toISOString() }, created_at: new Date(DEMO_NOW - 36.5 * 864e5).toISOString(), by: 'Andy G' },
]

