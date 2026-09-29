'use client'
import { V, confColor } from '@/lib/pk/tokens';

// Visuals 6, 7 and 15: a source's tile (official icon when you have it, otherwise its brand colour and a
// letter) with a tone dot on the corner, and a confidence ring. Put the official icons (from each company's
// brand kit) in your public folder and list them in ICONS.
export const BRAND: Record<string, { bg: string; letter: string }> = {
  Gmail: { bg: '#EA4335', letter: 'M' },
  Outlook: { bg: '#0A64D6', letter: 'O' },
  Slack: { bg: '#611F69', letter: '#' },
  WhatsApp: { bg: '#25D366', letter: 'W' },
  Zoom: { bg: '#2D8CFF', letter: 'Z' },
  HubSpot: { bg: '#FF7A59', letter: 'H' },
  'Google Calendar': { bg: '#1A73E8', letter: 'C' },
  Calendar: { bg: '#1A73E8', letter: 'C' },
  Salesforce: { bg: '#00A1E0', letter: 'S' },
  'Microsoft Teams': { bg: '#5059C9', letter: 'T' },
  Teams: { bg: '#5059C9', letter: 'T' },
};
/** Official icon files, e.g. { Gmail: '/brand/gmail.png' }. Empty until you add them. */
export const ICONS: Record<string, string> = {};

export function SourceIcon({ name, size = 32, dot }: { name: string; size?: number; dot?: string }) {
  const b = BRAND[name] ?? { bg: V.ink2, letter: name.slice(0, 1).toUpperCase() };
  const icon = ICONS[name];
  return (
    <span aria-hidden style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}>
      {icon ? (
        <img src={icon} alt="" width={size} height={size} style={{ borderRadius: size * 0.22 }} />
      ) : (
        <span style={{ display: 'flex', width: size, height: size, borderRadius: size * 0.3, background: b.bg, alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.45, fontFamily: V.font }}>
          {b.letter}
        </span>
      )}
      {dot ? <span style={{ position: 'absolute', right: -3, bottom: -3, width: 12, height: 12, borderRadius: 6, background: dot, boxShadow: `0 0 0 2px ${V.paper}` }} /> : null}
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
