import { PageHead } from '@/components/layout/PageHead'

export default function Page() {
  return (
    <div className="dsk-screen on">
      <PageHead
        eyebrow="Team"
        crumb="not yet live"
        title={<>Team view is next in the build queue.</>}
      />
      <div style={{ fontSize: 15, color: 'var(--ink-muted)', lineHeight: 1.6, maxWidth: 620 }}>
        Seats, shared accounts, and per-rep signal load will live here. Nothing is shown until there is real team data behind it.
      </div>
    </div>
  )
}
