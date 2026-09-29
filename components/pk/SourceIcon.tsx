'use client'
import { V, confColor } from '@/lib/pk/tokens';
import { MARKS } from '@/lib/pk/marks';

// Visuals 6, 7 and 15: a source's tile (official icon when you have it, otherwise its brand colour and a
// letter) with a tone dot on the corner, and a confidence ring. Put the official icons (from each company's
// brand kit) in your public folder and list them in ICONS.

export function SourceIcon({ name, size = 32, dot }: { name: string; size?: number; dot?: string }) {
  const mark = MARKS[name];
  const initials = name.split(/[\s-]+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  return (
    <span aria-label={name} title={name} style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}>
      {mark ? (
        // the company's own glyph, unmodified, in its own brand colour on a neutral tile
        <span style={{ display: 'flex', width: size, height: size, borderRadius: size * 0.3, background: 'var(--pk-block, rgba(14,13,11,.045))', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" role="img" aria-hidden>
            <path d={mark.path} fill={mark.hex} />
          </svg>
        </span>
      ) : (
        // no freely licensed mark for this one: initials on a neutral tile, never a recoloured logo
        <span style={{ display: 'flex', width: size, height: size, borderRadius: size * 0.3, background: 'var(--pk-block, rgba(14,13,11,.045))', alignItems: 'center', justifyContent: 'center', color: V.ink2, fontWeight: 700, fontSize: size * 0.36, fontFamily: V.font, letterSpacing: '-.02em' }}>
          {initials}
        </span>
      )}
      {dot ? <span style={{ position: 'absolute', right: -3, bottom: -3, width: 11, height: 11, borderRadius: 6, background: dot, boxShadow: `0 0 0 2px ${V.paper}` }} /> : null}
    </span>
  );
}

export function ConfArc({ conf, size = 26 }: { conf: string | number; size?: number }) {
  const n = typeof conf === 'number' ? conf : parseFloat(conf);
  if (!isFinite(n)) return null;
  const r = size / 2 - 2.5;
  const c = 2 * Math.PI * r;
  return (
    <span aria-label={`${Math.round(n)}% confidence`} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', width: size + 8, fontFamily: V.font }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={V.block} strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={confColor(n)} strokeWidth={3} strokeLinecap="round" strokeDasharray={`${(c * Math.min(100, n)) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: V.muted, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{Math.round(n)}%</span>
    </span>
  );
}
