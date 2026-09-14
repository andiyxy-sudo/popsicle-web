'use client'

// RiskFlagSheet — the diagnosis sheet behind every risk pill, ported from the
// design handoff (react/RiskFlagModal.jsx). Severity is carried by a mono
// eyebrow, the confidence numeral and the pattern rule, all in the flag colour.
// Everything shown is derived from that account's real open signals.

import { useRouter } from 'next/navigation'

export interface RiskFlag {
  account: string
  severity: string
  color: string
  confidence: number
  title: string
  signals: string[]
  pattern: string
  actions: Array<{ label: string; go: () => void }>
}

export function RiskFlagSheet({ flag, onClose }: { flag: RiskFlag | null; onClose: () => void }) {
  const router = useRouter()
  if (!flag) return null
  const c = flag.color
  const label = { fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.5px', textTransform: 'uppercase' as const }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 810, background: 'rgba(14,13,11,.42)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(460px,100%)', maxHeight: '84vh', overflowY: 'auto', background: 'var(--paper, #FBF8F3)', padding: '28px 30px 30px', boxShadow: '0 40px 90px -30px rgba(14,13,11,.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...label, fontSize: 11, color: c, display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />{flag.severity}
            </div>
            <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 23, letterSpacing: '-.03em', margin: '11px 0 0', color: 'var(--ink)' }}>{flag.title}</h2>
            <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 4 }}>{flag.account}</div>
          </div>
          <button onClick={onClose} style={{ ...label, fontSize: 11, color: 'var(--ink-faint)', background: 'none', border: 0, cursor: 'pointer', flex: 'none', paddingTop: 4 }}>close</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginTop: 22, paddingTop: 14, borderTop: '1px solid var(--rule-strong, #0E0D0B)' }}>
          <div>
            <div style={{ ...label, color: 'var(--ink-faint)' }}>AI confidence</div>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 34, letterSpacing: '-.04em', marginTop: 8, color: c }}>{flag.confidence}%</div>
          </div>
          <div style={{ flex: 1, maxWidth: 150, paddingBottom: 7 }}>
            <div style={{ height: 2, background: 'var(--hairline, #EFEAE1)' }}>
              <div style={{ width: `${flag.confidence}%`, height: '100%', background: c }} />
            </div>
          </div>
        </div>

        <div style={{ ...label, color: 'var(--ink-faint)', marginTop: 26 }}>Signals detected</div>
        {flag.signals.map((t, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '6px minmax(0,1fr)', gap: 12, padding: '11px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', fontSize: 13.5, lineHeight: 1.45, color: 'var(--ink)' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, marginTop: 7 }} />
            <span>{t}</span>
          </div>
        ))}

        <div style={{ marginTop: 24, paddingLeft: 16, borderLeft: `2px solid ${c}` }}>
          <div style={{ ...label, color: c }}>Pattern match</div>
          <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-.015em', lineHeight: 1.42, marginTop: 8, color: 'var(--ink)' }}>{flag.pattern}</div>
        </div>

        <div style={{ ...label, color: 'var(--ink-faint)', marginTop: 28 }}>Suggested actions</div>
        {flag.actions.map((a, i) => (
          <div key={i} onClick={() => { onClose(); a.go() }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer', color: 'var(--ink)', fontSize: 14, fontWeight: 600, letterSpacing: '-.01em' }}>
            <span style={{ minWidth: 0 }}>{a.label}</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12.5, color: c, flex: 'none' }}>→</span>
          </div>
        ))}
        <div onClick={() => { onClose(); router.push(`/accounts/${encodeURIComponent(flag.account)}`) }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer', color: 'var(--ink)', fontSize: 14, fontWeight: 600 }}>
          <span>Open Account 360</span><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12.5, color: c }}>→</span>
        </div>
      </div>
    </div>
  )
}

// Build a flag from an account's live signals - no invented diagnosis.
export function buildFlag(
  account: string,
  sigs: Array<{ id: string; severity?: string | null; title?: string | null; description?: string | null; signal_type?: string | null; source_integration?: string | null; risk_amount?: number | null; ai_analysis?: unknown }>,
  risk: string,
  push: (href: string) => void,
): RiskFlag {
  const c = risk === 'high' ? 'var(--critical, #c43d2b)' : risk === 'medium' ? 'var(--warn, #d38b1d)' : 'var(--good, #2f8f5b)'
  const confs = sigs.map(s => (s.ai_analysis as { confidence?: number } | null)?.confidence).filter((x): x is number => typeof x === 'number')
  const confidence = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : 70
  const top = sigs.find(s => s.severity === 'high') ?? sigs[0]
  const exposure = sigs.reduce((a, s) => a + (Number(s.risk_amount) || 0), 0)
  const patterns: Record<string, string> = {
    silent_stall: 'Accounts that go dark past their own reply cadence stall far more often than they close.',
    competitor_mention: 'A named competitor in the thread usually means an evaluation is already running.',
    price_flinch: 'Pricing pushback this late typically adds a finance loop and weeks to the close.',
    legal_loopin: 'Once outside counsel joins, review cycles historically add two to three weeks.',
    timeline_slip: 'A second date change is the strongest single predictor of a slipped quarter.',
    deal_stage_backward: 'Stage regressions rarely recover without an executive conversation.',
    meeting_cancelled: 'Cancelled reviews without a rebook are where momentum quietly dies.',
  }
  return {
    account,
    severity: `${risk} risk`,
    color: c,
    confidence,
    title: top?.title || `${account} needs attention`,
    signals: sigs.slice(0, 5).map(s => s.description || s.title || 'Signal'),
    pattern: patterns[top?.signal_type || ''] || (exposure > 0
      ? `${sigs.length} open signal${sigs.length === 1 ? '' : 's'} sit against this account's exposure.`
      : 'Open signals on an account are worth clearing before they compound.'),
    actions: [
      ...(top ? [{ label: 'Draft a follow-up email', go: () => push(`/signals?signal=${top.id}&action=reply`) }] : []),
      { label: 'Ask Popsicle what to do', go: () => push(`/ask?q=${encodeURIComponent(`What should I do about ${account}?`)}`) },
      ...(top ? [{ label: 'Open the signal', go: () => push(`/signals?signal=${top.id}`) }] : []),
    ],
  }
}
