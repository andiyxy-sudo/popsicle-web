'use client'

// Editorial page header (redesign): mono breadcrumb row on the shared 36px
// baseline, then the narrative title. Every screen uses this so the sidebar
// logo aligns with the first line of content on all pages.
export function PageHead({ eyebrow, crumb, title, sub, right }: {
  eyebrow: string
  crumb?: string
  title: React.ReactNode
  sub?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', minHeight: 36 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint, #A09C97)' }}>
          {eyebrow}{crumb ? <><span style={{ margin: '0 8px' }}>/</span>{crumb}</> : null}
        </div>
        {right}
      </div>
      <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.4vw,44px)', letterSpacing: '-.035em', margin: '18px 0 0', lineHeight: 1.14, maxWidth: 920, color: 'var(--ink, #0E0D0B)' }}>
        {title}
      </h1>
      {sub && <div style={{ fontSize: 15, color: 'var(--ink-muted, #5C5855)', marginTop: 10, maxWidth: 720 }}>{sub}</div>}
      <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '32px 0 36px' }} />
    </>
  )
}
