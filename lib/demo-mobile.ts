// Verbatim transcription of the mobile demo screens (all 3 batches, 60 screens).
// Batch 3 (Acme Corp, Nexus AI, TechFlow Inc: overview, comms, people, timeline,
// Acme Zoom transcript) matched the existing DEMO_* structures line for line, so
// nothing new was added for it here.
// Everything here is demo-only. Figures and copy are as shown on the phone; where
// a screen was cut off, the field is marked with a `partial` note rather than
// filled in. Wire into pages once all batches have landed.

// ---------------------------------------------------------------- Team Intelligence (mobile)
export const MOBILE_TEAM = {
  subtitle: 'Execution intelligence across live revenue signals.',
  exposureSummary: {
    live: true,
    totalExposure: 892_000, stabilizedThisWeek: 284_000,
    medianTimeToActionHours: 4.2, signalCoveragePct: 85,
    aiConfidencePct: 87, updated: '12 min ago',
  },
  saves: {
    period: 'Q4 2026',
    rows: [
      { rank: 1, rep: 'Andy G', signalsCaught: 12, dealsRecovered: 4, protectedValue: 284_000 },
      { rank: 2, rep: 'Mike Ross', signalsCaught: 9, dealsRecovered: 2, protectedValue: 176_000 },
      { rank: 3, rep: 'Jamie Torres', signalsCaught: 6, dealsRecovered: 1, protectedValue: 100_000 },
    ],
    teamTotal: 560_000, vsQ3Pct: 38,
  },
  revenueMovementThisWeek: { collapsed: true as const, partial: 'card was collapsed on screen' },
  coverageOwnership: {
    unowned: 2,
    criticalCoverage: '8/10 owned', activeFollowUp: '6/10 with active follow-up',
    unownedRisk: 245_000, staleAccounts: 2,
    reps: [
      { rep: 'Andy G', accounts: 4, exposure: 480_000, status: 'Active' },
      { rep: 'Mike Ross', accounts: 3, exposure: 295_000, status: 'Stale 3d' },
      { rep: 'Jamie Torres', accounts: 2, exposure: 167_000, status: 'Active' },
    ],
  },
  stabilizationEfficiency: {
    subtitle: 'Ranked by revenue stabilized · last 7 days',
    rows: [
      { rep: 'Andy G', improvedAccts: 4, churnDelta: -19, followThru: 88, stabilized: 142_000 },
      { rep: 'Mike Ross', improvedAccts: 3, churnDelta: -14, followThru: 64, stabilized: 98_000 },
      { rep: 'Jamie Torres', improvedAccts: 2, churnDelta: -11, followThru: 81, stabilized: 44_000 },
    ],
  },
  actionsFeed: {
    subtitle: '14 actions taken · last 7 days',
    filters: ['All', 'Critical only', 'My accounts'],
    rows: [
      { rep: 'Andy G', account: 'Brightwave', when: '6mo ago', action: 'Executive sponsor call - re-engagement confirmed', driver: 'Exec Disengagement', from: 74, to: 31, recovered: 62_000 },
      { rep: 'Mike Ross', account: 'Nexus AI', when: '6mo ago', action: 'Multi-stakeholder follow-up after 5-day dark period', driver: 'Silent Stall', from: 55, to: 28, recovered: 38_000 },
      { rep: 'Jamie Torres', account: 'Meridian Labs', when: '6mo ago', action: 'Invoice dispute resolved - AP contact re-engaged', driver: 'Invoice Delay', from: 66, to: 48, recovered: 44_000 },
      { rep: 'Andy G', account: 'Vertex Systems', when: '6mo ago', action: 'Competitive battle card delivered to champion', driver: 'Competitor Activity', from: 61, to: 38, recovered: 36_000 },
    ],
  },
  executionQuality: {
    subtitle: 'Process metrics across the team',
    timeToActionHours: 4.2, followThroughPct: 78, loopClosurePct: 71,
    rows: [
      { rep: 'Andy G', t2a: 2.1, ft: 88, closure: 82 },
      { rep: 'Jamie T', t2a: 3.8, ft: 81, closure: 74 },
      { rep: 'Mike R', t2a: 6.7, ft: 64, closure: 58 },
    ],
    insight: 'Mike Ross is 2.5x slower than team median on first action. Two critical accounts lack second-touch. Loop closure rate 13 points below team average.',
  },
}

// ---------------------------------------------------------------- Revenue Intelligence (mobile)
export const MOBILE_INTELLIGENCE = {
  subtitle: 'Historical and predictive analysis across revenue signals.',
  hero: { label: 'Revenue protected by Popsicle', value: 560_000, sub: 'saved this quarter', signalsCaughtEarly: 42, dealsRecovered: 7, avgResponseImprovementDays: 3.4 },
  ranges: ['30 Days', '60 Days', '90 Days'],
  performanceSummary: { title: 'Revenue Performance Summary', sub: 'Last 30 Days', live: true, riskChangePct: 8, successRatePct: 78, stabilized: 284_000 },
  weeksStory: {
    title: "This Week's Story", tag: 'AI Summary',
    bullets: [
      { tone: 'critical', lead: '3 accounts deteriorated', rest: ' - Acme, TechFlow, Meridian' },
      { tone: 'good', lead: 'Brightwave re-engaged', rest: ' after 2 weeks dark' },
      { tone: 'warn', lead: 'Net pipeline risk ', rest: '+$85K · intervention rate 78%' },
      { tone: 'accent', lead: 'Focus today:', rest: ' Meridian CRO video + Axion legal prep' },
    ],
    chips: ['3 Deteriorated', '1 Recovered', '+$85K Net Risk'],
  },
  riskTrend: {
    title: 'Revenue at Risk Trend', label: 'At risk · W8', value: 579_000, deltaPct: 35,
    toggles: ['At Risk', 'Stabilized', 'Both'], weeks: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
    // read off the curve: rises W1-W3, dips W4, climbs to W8
    shape: [0.18, 0.27, 0.31, 0.22, 0.45, 0.55, 0.62, 0.97],
    drivers: [
      { k: 'Exec disengagement', v: 85_000 },
      { k: 'SLA resolution', v: -62_000 },
      { k: 'New competitor', v: 45_000 },
    ],
  },
  churnDistribution: { critical: 3, monitor: 2, healthy: 3 },
  riskComposition: {
    subtitle: 'Top Revenue Drivers (30d)',
    rows: [
      { k: 'Executive Disengagement', pct: 34 },
      { k: 'Invoice Delays', pct: 28 },
      { k: 'Competitor Activity', pct: 22 },
      { k: 'Product Usage Decline', pct: 16 },
    ],
  },
  interventionEffectiveness: [
    { k: 'Draft Follow-up', successPct: 74 },
    { k: 'Exec Escalation', successPct: 68 },
    { k: 'Invoice Chase', successPct: 45 },
  ],
  forecastVsActual: { forecast: 1_240_000, actualMtd: 1_180_000, variance: -60_000 },
  exposureTrend: {
    title: 'Revenue Exposure Trend', sub: '$892K total · +$145K vs prior period',
    weeks: ['W1', 'W2', 'W3', 'W4', 'Now'], shape: [0.3, 0.45, 0.4, 0.62, 0.55, 0.78, 0.7, 0.95],
    peakExposure: '$1.04M (W3)', trajectory: 'Worsening +12%/wk',
    bySegment: [{ k: 'Enterprise', v: 607_000 }, { k: 'Mid-Market', v: 214_000 }, { k: 'SMB', v: 71_000 }],
    breakdowns: ['Segment', 'Account Size', 'Region'],
  },
  signalSources: {
    sub: '847 signals · 4 active sources',
    rows: [
      { k: 'Gmail / Outlook', n: 372, pct: 44 },
      { k: 'WhatsApp', n: 251, pct: 30 },
      { k: 'Slack', n: 152, pct: 18 },
      { k: 'Zoom / Calls', n: 72, pct: 8 },
    ],
  },
  renewalOutlook: {
    sub: 'Next 90 days · $892K in window',
    rows: [
      { account: 'Meridian Labs', days: 32, value: 245_000, status: 'At risk' },
      { account: 'NovaCorp', days: 58, value: 310_000, status: 'Monitor' },
      { account: 'Brightwave', days: 74, value: 195_000, status: 'On track' },
      { account: 'Vertex Systems', days: 88, value: 142_000, status: 'On track' },
    ],
  },
  interventionDeep: {
    title: 'Intervention Effectiveness (Deep)', sub: 'Action → outcome correlation',
    rows: [
      { k: 'Follow-up', used: 28, successPct: 74, avgDelta: -18 },
      { k: 'Escalation', used: 14, successPct: 68, avgDelta: -22 },
      { k: 'Inv Chase', used: 9, successPct: 45, avgDelta: -8 },
      { k: 'Exec Call', used: 6, successPct: 83, avgDelta: -31 },
    ],
    insight: 'Executive calls show highest churn reduction per intervention (−31% avg). Follow-ups remain the most frequently used action at 74% effectiveness.',
  },
}

// ---------------------------------------------------------------- Account 360 headers (mobile)
export const MOBILE_ACCOUNT_HEADERS: Record<string, { status: string; segment: string; email: string; churnRiskPct: number; arr: number; exposure: number; trend: string; renewal: string }> = {
  'TechVault Inc': { status: 'Watch', segment: 'Growth', email: 'procurement@techvault.co', churnRiskPct: 41, arr: 140_000, exposure: 58_000, trend: '→ 0%', renewal: 'N/A' },
  'Cobalt Health': { status: 'Won', segment: 'Enterprise', email: 'ops@cobalthealth.com', churnRiskPct: 5, arr: 150_000, exposure: 0, trend: '↗ +100%', renewal: '348d' },
  // batch 2
  'Axion Partners': { status: 'At risk', segment: 'Enterprise', email: 'legal@axion.com', churnRiskPct: 62, arr: 95_000, exposure: 72_000, trend: '↘ -8%', renewal: 'N/A' },
  'Brightwave': { status: 'On track', segment: 'Growth', email: 'tom@brightwave.io', churnRiskPct: 18, arr: 180_000, exposure: 12_000, trend: '↗ +22%', renewal: 'N/A' },
}
// Two accounts use the older header layout (stage · owner, ARR / Expiry / Trend / Rep score) instead of churn risk
export const MOBILE_ACCOUNT_HEADERS_ALT: Record<string, { status: string; stage: string; owner: string; arr: number; expiry: string; trend: string; repScore: number }> = {
  'Meridian Labs': { status: 'Med risk', stage: 'Discovery', owner: 'Alex Park', arr: 850_000, expiry: 'Mar 30', trend: '▲ 22%', repScore: 68 },
  'Vertex Systems': { status: 'Low risk', stage: 'Proposal', owner: 'Dana Kim', arr: 175_000, expiry: 'Jan 28', trend: '▲ 5%', repScore: 84 },
}
export const MOBILE_BRIEF_COUNTS: Record<string, number> = { 'Cobalt Health': 89, 'Axion Partners': 186, 'Brightwave': 312, 'TechVault Inc': 224 }

// Cobalt Health · Overview · AI Executive Brief (89 signals)
export const MOBILE_COBALT_BRIEF = {
  signals: 89,
  lines: [
    { tone: 'good', pre: 'Contract signed Dec 20 - ', strong: 'onboarding kicked off', post: ' with implementation team.' },
    { tone: 'good', pre: 'Jamie Torres assigned as CSM - first QBR scheduled for ', strong: 'Feb 15, 2026', post: '.' },
    { tone: 'info', pre: 'Expansion opportunity: ', strong: '$75K upsell', post: ' for analytics module - champion interested.' },
    { tone: 'good', pre: 'NPS score: ', strong: '72', post: ' after initial deployment. Strong internal advocacy building.' },
  ],
  health: [{ k: 'Engagement', v: 88 }, { k: 'Product', v: 82 }, { k: 'Support', v: 95 }, { k: 'Finance', v: 90 }],
}

// ---------------------------------------------------------------- Portfolio + Pulse (mobile, final 3 screens)
// Pulse matched DEMO_PULSE exactly. Portfolio cards match DEMO_ACCOUNTS (stage, owner,
// value, risk, close date, flags); the only extra detail is the per-card risk mix
// and status chip below. The list header reads "9 active accounts".
export const MOBILE_PORTFOLIO_CARDS: Record<string, { statusChip?: string; mix?: Array<{ k: string; pct: number }> }> = {
  'Acme Corp': { mix: [{ k: 'Eng', pct: 30 }, { k: 'SLA', pct: 20 }, { k: 'Invoice', pct: 35 }] },
  'Nexus AI': { statusChip: 'On track' },
  'TechFlow Inc': { mix: [{ k: 'Eng', pct: 25 }, { k: 'Budget', pct: 40 }] },
  'Meridian Labs': { statusChip: 'Timeline Slip' },
  'Brightwave': { statusChip: 'Re-engaged' },
  'Axion Partners': { mix: [{ k: 'Legal', pct: 40 }, { k: 'Eng', pct: 40 }] },
  'TechVault Inc': { statusChip: 'Price Flinch' },
  'Cobalt Health': { statusChip: 'Onboarding' },
}
export const MOBILE_PORTFOLIO_ACTIVE_COUNT = 9
