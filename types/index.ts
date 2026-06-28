export interface Account {
  id: string
  name: string
  domain: string
  health_score: number | null
  value: number | null
  stage: string | null
  owner: string | null
  risk_level: 'high' | 'medium' | 'low' | null
  close_date: string | null
  last_contact_date: string | null
  tags: string[] | null
  user_id: string
  created_at: string
}

export interface Signal {
  id: string
  account_id: string | null
  account_name: string | null
  signal_type: string | null
  severity: 'high' | 'watch' | 'positive' | null
  title: string
  description: string | null
  source_integration: string | null
  ai_analysis: {
    summary?: string
    reason?: string
    contact_name?: string
    quote?: string
    evidence?: string
    confidence?: number
    sentiment?: string
    objections?: string[]
    buying_signals?: string[]
    commitments?: string[]
    risk_flags?: string[]
  } | null
  is_snoozed: boolean
  is_dismissed: boolean
  created_at: string
  user_id: string
}

export interface Integration {
  id: string
  user_id: string
  provider: 'gmail' | 'gcal' | 'slack' | 'zoom' | 'hubspot' | 'salesforce'
  is_active: boolean
  needs_reconnect: boolean
  reconnect_reason: string | null
  team_name: string | null
  slack_signals_channel_id: string | null
  slack_autopost: boolean
  deep_backfilled_at: string | null
  created_at: string
}

export interface AccountBaseline {
  id: string
  account_id: string
  user_id: string
  account_name: string
  their_avg_reply_hours: number | null
  our_avg_reply_hours: number | null
  emails_per_week: number | null
  avg_interval_hours: number | null
  total_messages: number | null
  confidence: 'none' | 'low' | 'medium' | 'high' | null
  computed_at: string
}

export interface ZoomTranscript {
  id: string
  user_id: string
  account_id: string | null
  meeting_id: string
  topic: string | null
  transcript_text: string | null
  participants: { name: string; email: string }[] | null
  summary_text: string | null
  sentiment: string | null
  objections: string[] | null
  buying_signals: string[] | null
  commitments: string[] | null
  risk_flags: string[] | null
  analyzed_at: string | null
  created_at: string
}

export interface Message {
  id: string
  user_id: string
  account_id: string | null
  integration: string
  direction: 'inbound' | 'outbound'
  thread_id: string | null
  channel_id: string | null
  content: string | null
  sender: string | null
  created_at: string
}
