// Type scale and the text colors that pass contrast in light mode. Both apps read these.

export const TYPE = {
  label: 10, micro: 11,
  body: { xs: 12.5, sm: 13.5, md: 14.5, lg: 15.5, xl: 16 },
} as const

/** TEXT colors. Deeper than the brand fills, so they pass contrast on paper. */
export const TEXT = { ink: '#0E0D0B', grey: '#746F6A', orange: '#C54515', green: '#2A8051', amber: '#9B6615' } as const

/** FILL colors. Buttons, bars and rails keep the brand. */
export const FILL = { orange: '#E85A25', orangeLight: '#FF8A50', green: '#2f8f5b', amber: '#d38b1d', red: '#c43d2b' } as const

export function healthBand(score: number | null | undefined): 'low' | 'medium' | 'high' | 'unknown' {
  const n = Number(score)
  if (!Number.isFinite(n)) return 'unknown'
  return n >= 65 ? 'high' : n >= 40 ? 'medium' : 'low'
}

export function confidenceBand(conf: number | null | undefined): 'high' | 'medium' | 'low' | 'unknown' {
  const n = Number(conf)
  if (!Number.isFinite(n)) return 'unknown'
  return n >= 80 ? 'high' : n >= 50 ? 'medium' : 'low'
}
