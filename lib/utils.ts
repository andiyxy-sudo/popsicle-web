export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '--'
  // two decimals above $1M ($1.24M; a trailing zero is dropped, $1.2M), none below ($480K)
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return formatDate(dateStr)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function severityLabel(severity: string | null): string {
  if (severity === 'high') return 'At Risk'
  if (severity === 'watch') return 'Watch'
  if (severity === 'positive') return 'Positive'
  return 'Info'
}

export function integrationLabel(provider: string): string {
  const labels: Record<string, string> = {
    gmail: 'Gmail',
    gcal: 'Google Calendar',
    slack: 'Slack',
    zoom: 'Zoom',
    hubspot: 'HubSpot',
    salesforce: 'Salesforce',
    outlook: 'Outlook',
  }
  return labels[provider] ?? provider
}

export function stripEmDash(text: string): string {
  return text.replace(/[--]/g, ' - ')
}


// ---------------------------------------------------------------------------
// Health scale, used everywhere a health score, churn risk or risk level is coloured.
//   health  >= 70  green    40..69 amber    < 40 red
//   churn risk % is the inverse: < 30 green, 30..60 amber, > 60 red
//   risk level maps onto the same bands: low = green, medium = amber, high = red
// ---------------------------------------------------------------------------
export const TONE = { good: 'var(--good, #2f8f5b)', warn: 'var(--warn, #d38b1d)', critical: 'var(--critical, #c43d2b)' } as const
export function healthTone(score: number | null | undefined): string {
  if (score == null || Number.isNaN(Number(score))) return 'var(--ink-faint, #A09C97)'
  const s = Number(score)
  return s >= 70 ? TONE.good : s >= 40 ? TONE.warn : TONE.critical
}
export function churnTone(pct: number | null | undefined): string { return pct == null ? 'var(--ink-faint, #A09C97)' : healthTone(100 - Number(pct)) }
export function riskTone(level: string | null | undefined): string { return level === 'high' ? TONE.critical : level === 'medium' ? TONE.warn : level === 'low' ? TONE.good : 'var(--ink-faint, #A09C97)' }
export function riskFromHealth(score: number | null | undefined): 'high' | 'medium' | 'low' { const s = Number(score ?? 0); return s >= 70 ? 'low' : s >= 40 ? 'medium' : 'high' }


// ---------------------------------------------------------------------------
// One date rule for the app (v11.77):
//   under 1 hour → "just now" / "Nm ago";  same day → "Nh ago";  under 14 days → "today",
//   "yesterday", "Nd ago";  beyond → "Mon D" (with the year when it is not this year).
// Every "when" column, age and timestamp goes through this.
// ---------------------------------------------------------------------------
export function formatWhen(input: string | number | Date | null | undefined, now: number = Date.now()): string {
  if (input == null || input === '') return '--'
  const t = input instanceof Date ? input.getTime() : typeof input === 'number' ? input : new Date(input).getTime()
  if (Number.isNaN(t)) return '--'
  const diff = now - t
  if (diff < 0) {
    const d = new Date(t)
    return d.toLocaleDateString('en-US', d.getFullYear() === new Date(now).getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 14) return `${days}d ago`
  const d = new Date(t)
  return d.toLocaleDateString('en-US', d.getFullYear() === new Date(now).getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
}
