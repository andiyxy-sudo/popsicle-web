// Shown instantly on every route change so navigation feels immediate
// while the server component fetches.
export default function Loading() {
  return (
    <div className="dsk-screen on">
      <div style={{ minHeight: 36, display: 'flex', alignItems: 'center' }}>
        <div style={{ height: 10, width: 190, background: 'var(--inset, #F0EDE7)' }} />
      </div>
      <div style={{ height: 40, width: '68%', background: 'var(--inset, #F0EDE7)', margin: '20px 0 12px' }} />
      <div style={{ height: 40, width: '42%', background: 'var(--inset, #F0EDE7)' }} />
      <div style={{ height: 1, background: 'var(--hairline, #EFEAE1)', margin: '34px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 24 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i}>
            <div style={{ height: 34, width: '70%', background: 'var(--inset, #F0EDE7)' }} />
            <div style={{ height: 10, width: '85%', background: 'var(--inset, #F0EDE7)', marginTop: 12 }} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 56 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '18px 0', borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
            <div style={{ height: 12, flex: 1, background: 'var(--inset, #F0EDE7)', opacity: 1 - i * 0.13 }} />
            <div style={{ height: 12, width: 90, background: 'var(--inset, #F0EDE7)', opacity: 1 - i * 0.13 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
