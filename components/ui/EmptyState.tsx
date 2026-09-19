// Quiet empty state: a small ring mark, one line in the headline voice, and
// optional guidance. Used wherever a list can legitimately be empty.
export function EmptyState({ line, hint, action, onAction, compact = false }: { line: string; hint?: string; action?: string; onAction?: () => void; compact?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: compact ? '18px 0' : '30px 0' }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--accent, #E85A25)', marginTop: 5, flex: 'none', opacity: .7 }} />
      <div>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: compact ? 14.5 : 16, letterSpacing: '-.015em', color: 'var(--ink)' }}>{line}</div>
        {hint && <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 4, lineHeight: 1.55, maxWidth: 480 }}>{hint}</div>}
        {action && onAction && <div onClick={onAction} style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)', marginTop: 8, cursor: 'pointer', display: 'inline-block' }}>{action} →</div>}
      </div>
    </div>
  )
}
