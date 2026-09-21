// Shared answer renderer (moved out of AskClient in v11.94 so the Ask dock can use it
// without pulling the whole Ask page into every screen's bundle).
const EMOJI_DOT: Record<string, string> = { '🔴': 'var(--critical, #c43d2b)', '🟠': 'var(--warn, #d38b1d)', '🟡': 'var(--warn, #d38b1d)', '🟢': 'var(--good, #2f8f5b)', '🔵': 'var(--blue, #2f6f9f)', '⚪': 'var(--ink-faint)' }
export function inline(text: string, key: number) {
  // **bold**, *italic* / _italic_, `code`, and status emoji
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|[🔴🟠🟡🟢🔵⚪])/g).filter(Boolean)
  return (
    <span key={key}>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.slice(2, -2)}</strong>
        if ((p.startsWith('*') && p.endsWith('*') && p.length > 2) || (p.startsWith('_') && p.endsWith('_') && p.length > 2)) return <em key={i} style={{ fontStyle: 'italic', color: 'var(--ink)' }}>{p.slice(1, -1)}</em>
        if (p.startsWith('`') && p.endsWith('`')) return <code key={i} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.92em', background: 'var(--inset, #F4F0E8)', padding: '1px 6px', borderRadius: 5 }}>{p.slice(1, -1)}</code>
        if (EMOJI_DOT[p]) return <span key={i} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: EMOJI_DOT[p], marginLeft: 6, verticalAlign: 'middle', position: 'relative', top: -1 }} />
        return <span key={i}>{p}</span>
      })}
    </span>
  )
}
// Numbered items ("1. Acme Corp - CFO silent 8 days ($480K)") become titled rows.
export function splitNumbered(t: string): { n: string; title: string; figure: string | null } | null {
  const m = t.match(/^(\d+)[.)]\s+(.*)$/)
  if (!m) return null
  let title = m[2].replace(/\*\*/g, '').trim()
  const fig = title.match(/\(([^)]*[$\d][^)]*)\)\s*([🔴🟠🟡🟢🔵⚪])?\s*$/)
  let figure: string | null = null
  if (fig) { figure = fig[1]; title = title.slice(0, fig.index).trim() + (fig[2] ? ` ${fig[2]}` : '') }
  return { n: m[1], title, figure }
}

// v11.99: the verdict line, rendered as the first thing you read
const VERDICT_TONE: Array<[RegExp, string]> = [
  [/^probably not\b/i, '#c43d2b'], [/^no\b/i, '#c43d2b'], [/^too early/i, '#d38b1d'], [/^probably\b/i, '#2f8f5b'], [/^yes\b/i, '#2f8f5b'],
]
export function splitVerdict(text: string): { verdict: string; reason: string; tone: string; rest: string } | null {
  const lines = text.replace(/^\s+/, '').split('\n')
  const m = /^\**\s*verdict\s*:?\s*\**\s*(.+)$/i.exec(lines[0] ?? '')
  if (!m) return null
  const body = m[1].replace(/\*\*/g, '').trim()
  const [v, ...r] = body.split(/\s+[-–—]\s+/)
  const tone = VERDICT_TONE.find(([re]) => re.test(v.trim()))?.[1] ?? '#0E0D0B'
  return { verdict: v.trim().replace(/\.$/, ''), reason: r.join(' - ').trim(), tone, rest: lines.slice(1).join('\n').replace(/^\s+/, '') }
}
export function VerdictBanner({ verdict, reason, tone }: { verdict: string; reason: string; tone: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', padding: '12px 0 14px', marginBottom: 12, borderBottom: '1px solid rgba(14,13,11,.12)' }}>
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ink-faint, #A09C97)' }}>Verdict</span>
      <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: '-.03em', color: tone }}>{verdict}</span>
      {reason && <span style={{ fontSize: 14.5, color: 'var(--ink-muted, #5C5855)' }}>{reason}</span>}
    </div>
  )
}

export function Answer({ text: raw }: { text: string }) {
  const vd = splitVerdict(raw)
  const text = vd ? vd.rest : raw
  if (vd && !text) return <VerdictBanner {...vd} />
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  let para: string[] = []
  const flush = (k: number) => {
    if (!para.length) return
    out.push(
      <p key={`p${k}`} style={{ margin: '0 0 16px', fontSize: 16, lineHeight: 1.65, color: 'var(--ink-muted)' }}>
        {inline(para.join(' '), k)}
      </p>
    )
    para = []
  }
  lines.forEach((raw, i) => {
    const l = raw.trim()
    if (!l) { flush(i); return }
    if (/^#{1,6}\s/.test(l)) {
      flush(i)
      out.push(
        <h3 key={`h${i}`} style={{ margin: '26px 0 12px', fontSize: 17, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ink)' }}>
          {l.replace(/^#{1,6}\s/, '')}
        </h3>
      )
      return
    }
    if (/^([-*•]|\d+[.)])\s/.test(l)) {
      flush(i)
      const body = l.replace(/^([-*•]|\d+[.)])\s/, '')
      out.push(
        <div key={`b${i}`} className="ans-in" style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 10, padding: '7px 0', fontSize: 15.5, lineHeight: 1.55, color: 'var(--ink-muted)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 9 }} />
          <div>{inline(body, i)}</div>
        </div>
      )
      return
    }
    para.push(l)
  })
  flush(9999)
  return <div>{vd && <VerdictBanner {...vd} />}{out}</div>
}



// Small source marks for the answer footer, matching the activity feed set.
