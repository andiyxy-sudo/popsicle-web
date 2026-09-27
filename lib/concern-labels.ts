// One name per Concern type, used by every screen. Sentence case throughout.
// Positive types are named for what they are: a buying signal is not a Concern.
export const CONCERN_LABELS: Record<string, string> = {
  silent_stall: 'Silent stall', call_objection: 'Objection', price_flinch: 'Price flinch',
  competitor_mention: 'Competitor mention', legal_loopin: 'Legal loop-in', champion_change: 'Champion change',
  timeline_slip: 'Timeline slip', meeting_cancelled: 'Meeting cancelled', meeting_declined: 'Meeting declined',
  deal_stage_backward: 'Stage backward', call_buying_signal: 'Buying intent', call_commitment: 'Commitment',
  call_summary: 'Call summary', call_sentiment_drop: 'Sentiment drop', commitment_overdue: 'Commitment overdue',
  reengaged: 'Re-engaged', team_mention: 'Team mention', invoice_delay: 'Invoice delay',
}

// One next step per Concern type, so Pulse, Portfolio and the account pages never disagree.
export const CONCERN_ACTIONS: Record<string, string> = {
  silent_stall: 'Draft email', call_objection: 'Send redline', price_flinch: 'Share ROI',
  competitor_mention: 'Send compare', legal_loopin: 'Send redline', champion_change: 'Map contact',
  timeline_slip: 'Confirm date', meeting_cancelled: 'Schedule call', meeting_declined: 'Schedule call',
  deal_stage_backward: 'Schedule call', call_buying_signal: 'Fast-track', call_commitment: 'Confirm',
  reengaged: 'Fast-track', commitment_overdue: 'Close out', call_sentiment_drop: 'Schedule call',
  invoice_delay: 'Chase invoice',
}
