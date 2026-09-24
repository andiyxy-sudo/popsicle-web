// One definition of an account's health and risk, shared by every surface, so no two pages can disagree.
// Uses the stored score when there is one; otherwise derives it from that account's open signals.
export interface HealthAcct { health_score?: number | null; risk_level?: string | null }
export interface HealthSig { severity?: string | null }

export function healthOf(a: HealthAcct, sigs: HealthSig[]): number {
  if (a.health_score != null && a.health_score > 0) return a.health_score
  const nH = sigs.filter(x => x.severity === 'high').length
  const nW = sigs.filter(x => x.severity === 'watch').length
  const nP = sigs.filter(x => x.severity === 'positive').length
  return Math.max(25, Math.min(95, 90 - nH * 18 - nW * 6 + nP * 4))
}

export function riskOf(a: HealthAcct, sigs: HealthSig[]): 'high' | 'medium' | 'low' {
  if (a.risk_level === 'high' || a.risk_level === 'medium' || a.risk_level === 'low') return a.risk_level
  const nH = sigs.filter(x => x.severity === 'high').length
  const nW = sigs.filter(x => x.severity === 'watch').length
  return nH ? 'high' : nW ? 'medium' : 'low'
}
