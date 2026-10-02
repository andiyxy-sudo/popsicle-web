// Motion, as numbers for React Native and strings for CSS, so the two apps move the same way.

export const DUR = { instant: 120, quick: 200, base: 320, slow: 460, sheet: 400 } as const
export const EASE = {
  out: [0.16, 1, 0.3, 1], standard: [0.4, 0, 0.2, 1], inOut: [0.65, 0, 0.35, 1], soft: [0.2, 0.8, 0.2, 1],
} as const

export const css = {
  out: 'cubic-bezier(.16,1,.3,1)', standard: 'cubic-bezier(.4,0,.2,1)',
  inOut: 'cubic-bezier(.65,0,.35,1)', soft: 'cubic-bezier(.2,.8,.2,1)',
} as const

/** Rows in a list arrive this far apart. */
export const STAGGER = 45
