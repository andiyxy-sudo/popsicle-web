// Colour rules shared with the mobile app. Values are CSS variables from tokens.css, so light and dark just work.
export const V = {
  paper: 'var(--pk-paper)', sheet: 'var(--pk-sheet)', card: 'var(--pk-card)',
  ink: 'var(--pk-ink)', ink2: 'var(--pk-ink2)', muted: 'var(--pk-muted)', faint: 'var(--pk-faint)',
  rule: 'var(--pk-rule)', border: 'var(--pk-border)', block: 'var(--pk-block)',
  orange: 'var(--pk-orange)', orangeTint: 'var(--pk-orange-tint)', red: 'var(--pk-red)', redTint: 'var(--pk-red-tint)',
  amber: 'var(--pk-amber)', green: 'var(--pk-green)', support: 'var(--pk-support)',
  font: 'var(--pk-font)', mono: 'var(--pk-mono)',
} as const;

/** Health: under 40 red, 40 to 64 amber, 65 and up green; no score, muted. */
export const healthColor = (h: number | null) => (h == null ? V.muted : h < 40 ? V.red : h < 65 ? V.amber : V.green);
export const healthText = (h: number | null) => (h == null ? '—' : String(h)); // the lone dash marks a missing score, as on mobile
/** AI confidence: 80% and up green, 50 to 79 orange, under 50 red. */
export const confColor = (conf: string | number) => {
  const n = typeof conf === 'number' ? conf : parseFloat(conf);
  return n >= 80 ? V.green : n >= 50 ? V.orange : V.red;
};
/** Honour the person's Reduce motion setting everywhere. */
export const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
