export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '--'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
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
  return text.replace(/[—–]/g, ' - ')
}
