// Attention score (mobile contract, item 23): ORDER ONLY, never displayed.
// open highs x10, corroborated x6, watch x2, days-dark/7 capped at 6,
// meeting within 48h, handled -1, clamped at 0.
// Assumption flagged: the contract lists "meeting <=48h" without a weight; +4 used.
export interface AttentionSig { severity?: string | null; status?: string | null; is_dismissed?: boolean | null; corroboration?: unknown }
export function attentionScore(sigs: AttentionSig[], daysDark: number | null, meetingWithin48h: boolean): number {
  const open = sigs.filter(s => !s.is_dismissed && (!s.status || s.status === 'open'))
  const highs = open.filter(s => s.severity === 'high').length
  const corroborated = open.filter(s => !!s.corroboration).length
  const watch = open.filter(s => s.severity === 'watch').length
  const handled = sigs.filter(s => s.status === 'handled').length
  const dark = daysDark != null ? Math.min(6, daysDark / 7) : 0
  return Math.max(0, highs * 10 + corroborated * 6 + watch * 2 + dark + (meetingWithin48h ? 4 : 0) - handled)
}
