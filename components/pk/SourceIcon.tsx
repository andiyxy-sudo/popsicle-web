'use client'

import { V, confColor } from '@/lib/pk/tokens'
import { SOURCE_SVG, sourceKey, sourceLabel } from '@/lib/pk/sources'
import { MARKS } from '@/lib/pk/marks'

// The channel a Concern came from, as that brand's own full-color mark, used unmodified.
// The marks are inlined, so a row costs no extra request. On dark backgrounds the tile stays light,
// because these are color logos and must not be recoloured or knocked out.
// `dot` adds the severity dot; `size` is the tile, 30px in a Concern row and 40 to 48 in Settings.
export function SourceIcon({ name, size = 32, dot }: { name: string; size?: number; dot?: string }) {
  const key = sourceKey(name)
  const label = sourceLabel(name)
  const svg = key ? SOURCE_SVG[key] : ''
  // the integration pack first; for the few it does not carry (Zoho, Stripe, Snowflake, Drive) the
  // single-glyph mark; initials only when neither has one
  const GLYPH_NAME: Record<string, string> = {
    snowflake: 'Snowflake',   // Drive, Zoho and Stripe now come from the packs, in full color
  }
  const raw = String(name ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  const glyph = !svg ? (MARKS[GLYPH_NAME[raw] ?? label] ?? MARKS[label]) : undefined
  const initials = label.split(/[\s-]+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  const tile: React.CSSProperties = {
    display: 'flex', width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center',
    background: 'var(--pk-source-tile, rgba(14,13,11,.045))', flexShrink: 0,
  }
  return (
    <span aria-label={`Raised in ${label}`} title={label} role="img"
      style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}>
      {svg ? (
        <span style={tile}>
          <span aria-hidden style={{ display: 'block', width: size * 0.6, height: size * 0.6, lineHeight: 0 }}
            dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', `<svg width="100%" height="100%" `) }} />
        </span>
      ) : glyph ? (
        <span style={tile}>
          <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" role="img" aria-hidden>
            <path d={glyph.path} fill={glyph.hex} />
          </svg>
        </span>
      ) : (
        <span style={{ ...tile, color: V.ink2, fontWeight: 700, fontSize: size * 0.34, fontFamily: V.font, letterSpacing: '-.02em' }}>{initials}</span>
      )}
      {dot ? <span style={{ position: 'absolute', right: -3, bottom: -3, width: 11, height: 11, borderRadius: 6, background: dot, boxShadow: `0 0 0 2px ${V.paper}` }} /> : null}
    </span>
  )
}

export function ConfArc({ conf, size = 26 }: { conf: number; size?: number }) {
  const r = (size - 3) / 2, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, conf))
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}% confidence`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pk-rule, #EFEAE1)" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={confColor(pct)} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${(c * pct) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span style={{ fontFamily: V.mono, fontSize: 9, color: V.faint }}>{pct}%</span>
    </span>
  )
}
