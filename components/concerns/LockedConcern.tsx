'use client'

import { useState } from 'react'
import { unlockConcern } from '@/lib/plan'
import { CONCERN_LABELS } from '@/lib/concern-labels'

// A Concern a free workspace has not opened yet. It shows enough to choose between two of them:
// the account, what kind it is, how serious, and when it fired. Nothing else, because the detail is
// not in the response at all — the view returns null for it. The grey bars are DRAWN SHAPES, not
// blurred text, so there is nothing to read in the DOM and nothing to defeat with a devtools tweak.
export function LockedConcern({
  id, account, type, severity, when, unlocksLeft, resetsOn, onUnlocked, onOutOfUnlocks,
}: {
  id: string; account: string | null; type: string | null; severity: string | null; when: string
  unlocksLeft: number | null; resetsOn: string
  onUnlocked: (id: string) => void; onOutOfUnlocks?: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const none = (unlocksLeft ?? 0) <= 0
  const label = CONCERN_LABELS[String(type)] ?? 'Concern'
  const tone = severity === 'high' ? 'var(--critical, #c43d2b)' : severity === 'positive' ? 'var(--good, #2A8051)' : 'var(--warn, #9B6615)'
  const chip = severity === 'high' ? 'High' : severity === 'positive' ? 'Positive' : 'Watch'

  async function doUnlock() {
    setBusy(true); setErr(null)
    const r = await unlockConcern(id)
    setBusy(false)
    if (r.ok) { setConfirming(false); onUnlocked(id); return }
    if (r.reason === 'no_unlocks') { setConfirming(false); onOutOfUnlocks?.(); return }
    setErr('That did not go through. Try again in a moment.')
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3px minmax(0,1fr) 128px', gap: 16, alignItems: 'center',
      padding: '18px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
      <span aria-hidden style={{ alignSelf: 'stretch', background: tone, opacity: .55 }} />

      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--ink)' }}>{account ?? 'Account'}</span>
          <span style={{ fontSize: 13.5, color: tone }}>{label}</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: tone }}>{chip}</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{when}</span>
        </span>

        {/* two drawn bars where the evidence would be: a shape, not hidden text */}
        <span aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 11, maxWidth: 440 }}>
          <span style={{ height: 8, width: '100%', background: 'var(--d-inset, rgba(14,13,11,.07))' }} />
          <span style={{ height: 8, width: '62%', background: 'var(--d-inset, rgba(14,13,11,.07))' }} />
        </span>
        {err && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--critical, #c43d2b)', marginTop: 8 }}>{err}</span>}
      </span>

      <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {none ? (
          <a href="/settings?sheet=plan" style={{ font: 'inherit', fontSize: 13, fontWeight: 600, padding: '9px 18px', textDecoration: 'none',
            border: '1px solid rgba(232,90,37,.28)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>Upgrade</a>
        ) : confirming ? (
          // the confirm happens on the card, never in a modal
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>Use 1 of {unlocksLeft}?</span>
            <button onClick={() => setConfirming(false)} disabled={busy}
              style={{ font: 'inherit', fontSize: 12.5, background: 'none', border: 0, color: 'var(--ink-faint)', cursor: 'pointer' }}>Cancel</button>
            <button onClick={doUnlock} disabled={busy}
              style={{ font: 'inherit', fontSize: 13, fontWeight: 600, padding: '8px 16px', border: 0, cursor: 'pointer',
                background: 'linear-gradient(135deg,#FF8A50,#E85A25)', color: '#fff', opacity: busy ? .6 : 1 }}>
              {busy ? 'Opening…' : 'Unlock'}
            </button>
          </span>
        ) : (
          <button onClick={() => setConfirming(true)}
            style={{ font: 'inherit', fontSize: 13, fontWeight: 600, padding: '9px 20px', minWidth: 104, border: '1px solid rgba(232,90,37,.28)',
              background: 'transparent', color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Unlock
          </button>
        )}
      </span>
    </div>
  )
}
