'use client'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="dsk-screen on">
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Error</div>
      <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(26px,3vw,38px)', letterSpacing: '-.035em', margin: '18px 0 0', color: 'var(--ink)' }}>
        This screen did not render.{' '}<span style={{ color: 'var(--ink-muted)' }}>The data is safe.</span>
      </h1>
      <div style={{ fontSize: 14, color: 'var(--ink-muted)', marginTop: 16, lineHeight: 1.6, maxWidth: 620 }}>{error.message}</div>
      <button onClick={reset} style={{ marginTop: 24, font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '10px 24px', borderRadius: 999, border: 0, background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff', cursor: 'pointer' }}>Try again</button>
    </div>
  )
}
