// Route-level skeleton, shown while a server component fetches.
//
// NOTE (v11.83): this file caused confusion during an earlier bug hunt. The blank
// content column was NOT this file — it was the shell layout (fixed in v11.70).
// The skeleton is safe, but it must mirror the real page's first rows so the swap
// is invisible, and its blocks must be visible enough to read as "loading" rather
// than as an empty page. Both are handled below.
export default function Loading() {
  const bar = (w: string, h = 12, mt = 0) => (
    <div className="sk" style={{ height: h, width: w, marginTop: mt }} />
  )
  return (
    <div className="dsk-screen on" aria-busy="true" aria-label="Loading">
      <div style={{ minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {bar('210px', 10)}{bar('90px', 10)}
      </div>
      <div style={{ marginTop: 18 }}>{bar('64%', 34)}{bar('38%', 34, 14)}</div>
      <div style={{ height: 0, borderTop: '1px solid var(--hairline, #EFEAE1)', margin: 'var(--gap-m, 40px) 0 26px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 28 }}>
        {[0, 1, 2, 3].map(i => <div key={i}>{bar('62%', 30)}{bar('86%', 9, 12)}</div>)}
      </div>
      <div style={{ marginTop: 'var(--gap-l, 64px)' }}>
        {bar('180px', 16)}
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '17px 0', borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
            <div className="sk" style={{ height: 22, width: 30 }} />
            <div className="sk" style={{ height: 11, flex: 1, maxWidth: 320 }} />
            <div className="sk" style={{ height: 11, width: 74 }} />
            <div className="sk" style={{ height: 11, width: 56 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
