import { PageHead } from '@/components/layout/PageHead'

export default function Page() {
  return (
    <div className="dsk-screen on">
      <PageHead
        eyebrow="Forecast"
        crumb="not yet live"
        title={<>Forecast is next in the build queue.</>}
      />
      <div style={{ fontSize: 15, color: 'var(--ink-muted)', lineHeight: 1.6, maxWidth: 620 }}>
        Popsicle is gathering the history it needs: close dates, stage movement, and signal outcomes. The screen appears here once the numbers mean something.
      </div>
    </div>
  )
}
