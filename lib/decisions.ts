// Decisions and the evidence snapshot stored with each one.
import * as M from './metrics'

export type EvidenceSnap = {
  capturedAt: string
  figures: { value?: number; stage?: string | null; health?: number | null; atRisk?: number; openSignals?: number }
  signals: Array<{ id: string; title: string; quote?: string; source?: string; at?: string; severity?: string }>
}
export type Decision = {
  id: string; account_name: string | null; decision: string; owner: string | null; due_at: string | null
  status: 'open' | 'done' | 'reversed'; source: string; review_id?: string | null; evidence: EvidenceSnap; created_at: string; by?: string
}

/** What was true about an account at the moment a decision was made. */
export function snapshotFor(account: string, accts: M.Acct[], sigs: M.Sig[], at = Date.now()): EvidenceSnap {
  const a = accts.find(x => x.name === account)
  const open = sigs.filter(s => s.account_name === account && !s.is_dismissed && (!s.status || s.status === 'open'))
    .sort((x, y) => (x.severity === 'high' ? 0 : x.severity === 'watch' ? 1 : 2) - (y.severity === 'high' ? 0 : y.severity === 'watch' ? 1 : 2) || String(y.created_at).localeCompare(String(x.created_at)))
  return {
    capturedAt: new Date(at).toISOString(),
    figures: { value: Number(a?.value || 0) || undefined, stage: a?.stage ?? null, health: a?.health_score ?? null, atRisk: M.exposureOf(open.filter(s => s.severity !== 'positive')), openSignals: open.length },
    signals: open.slice(0, 5).map(s => ({ id: s.id, title: s.title ?? 'Signal', quote: (s.ai_analysis?.quote as string | undefined) ?? undefined, source: s.source_integration ?? undefined, at: s.created_at ?? undefined, severity: s.severity ?? undefined })),
  }
}
