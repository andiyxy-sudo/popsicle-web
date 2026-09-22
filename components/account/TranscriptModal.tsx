'use client'

import { useMemo, useState } from 'react'
import { useEscape } from '@/components/ui/useEscape'

// Call transcript, opened from a call entry on the deal timeline. Shows the AI
// summary, the tagged key moments (objections, commitments, next steps) and a
// filter, so a rep can see the parts of a 42-minute call that decide the deal.
export type Transcript = {
  account: string; title: string; duration: number; when: string; analyser?: string; summary: string
  moments: Array<{ t: string; who: string; tag: string | null; text: string }>
}
const TAG: Record<string, { c: string; label: string }> = {
  OBJECTION: { c: 'var(--warn, #d38b1d)', label: 'Objection' },
  COMMITMENT: { c: 'var(--good, #2f8f5b)', label: 'Commitment' },
  'NEXT STEP': { c: 'var(--good, #2f8f5b)', label: 'Next step' },
  RISK: { c: 'var(--critical, #c43d2b)', label: 'Risk' },
}
const MONO = { fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.4px', textTransform: 'uppercase' as const }

export function TranscriptModal({ t, onClose, onAsk }: { t: Transcript; onClose: () => void; onAsk: (q: string) => void }) {
  const [only, setOnly] = useState<'all' | 'key'>('all')
  useEscape(true, onClose)   // also hides the floating Ask bar while open
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const m of t.moments) if (m.tag) c[m.tag] = (c[m.tag] ?? 0) + 1
    return c
  }, [t])
  const shown = only === 'all' ? t.moments : t.moments.filter(m => m.tag)
  const isUs = (who: string) => /^(Andy|Mike|Jamie|You)/.test(who)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(14,13,11,.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 24px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(760px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--paper, #FBF8F3)', boxShadow: '0 44px 100px -34px rgba(14,13,11,.55)' }}>
        {/* header */}
        <div style={{ padding: '26px 30px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18 }}>
          <div>
            <div style={{ ...MONO, color: 'var(--ink-faint)' }}>{t.account} · {t.title}</div>
            <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: '-.03em', margin: '10px 0 0', color: 'var(--ink)' }}>Call transcript</h2>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, ...MONO, color: 'var(--ink-faint)' }}>
              <span>{t.duration} min</span><span>{t.when}</span>{t.analyser && <span style={{ color: 'var(--good, #2f8f5b)' }}>{t.analyser}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ ...MONO, background: 'none', border: 0, cursor: 'pointer', color: 'var(--ink-faint)' }}>Close</button>
        </div>

        <div style={{ height: 0, borderTop: '1px solid var(--rule-strong, #0E0D0B)', margin: '20px 30px 0' }} />

        {/* summary */}
        <div style={{ padding: '20px 30px 0' }}>
          <div style={{ ...MONO, color: 'var(--accent)' }}>AI summary</div>
          <div style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--ink)', marginTop: 10 }}>{t.summary}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            {Object.entries(counts).map(([k, n]) => (
              <span key={k} style={{ ...MONO, fontSize: 10, color: TAG[k]?.c ?? 'var(--ink-muted)', border: `1px solid ${TAG[k]?.c ?? 'var(--hairline, #EFEAE1)'}33`, padding: '4px 10px' }}>{n} {TAG[k]?.label ?? k.toLowerCase()}{n > 1 ? 's' : ''}</span>
            ))}
          </div>
        </div>

        {/* moments */}
        <div style={{ padding: '24px 30px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ ...MONO, color: 'var(--ink-faint)' }}>Key moments</div>
          <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: 'var(--inset, #F4F0E8)' }}>
            {([['all', `All ${t.moments.length}`], ['key', `Tagged ${t.moments.filter(m => m.tag).length}`]] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setOnly(k)} style={{ font: 'inherit', fontSize: 12.5, fontWeight: only === k ? 600 : 500, padding: '5px 12px', border: 0, cursor: 'pointer', background: only === k ? 'var(--ink, #0E0D0B)' : 'transparent', color: only === k ? '#fff' : 'var(--ink-muted)' }}>{lbl}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: '6px 30px 8px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {shown.map((m, i) => {
            const tag = m.tag ? TAG[m.tag] : null
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '54px minmax(0,1fr)', gap: 18, alignItems: 'start', padding: '14px 0', borderTop: i === 0 ? 0 : '1px solid var(--hairline, #EFEAE1)' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)', paddingTop: 3 }}>{m.t}</span>
                <div style={{ paddingLeft: tag ? 14 : 0, borderLeft: tag ? `2px solid ${tag.c}` : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    {tag && <span style={{ ...MONO, fontSize: 9.5, color: tag.c }}>{tag.label}</span>}
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: isUs(m.who) ? 'var(--accent)' : 'var(--ink)' }}>{m.who}</span>
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--ink-muted)', marginTop: 4 }}>{m.text}</div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '18px 30px 22px', flex: 'none', borderTop: '1px solid var(--hairline, #EFEAE1)', background: 'var(--paper, #FBF8F3)' }}>
          <span style={{ ...MONO, fontSize: 10, color: 'var(--ink-faint)' }}>{t.moments.length} moments · {t.duration} minutes</span>
          <button onClick={() => { onClose(); onAsk(`From the ${t.title} with ${t.account}: what were the objections, what did they commit to, and what should I send next?`) }}
            style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '11px 22px', border: 0, cursor: 'pointer', background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff' }}>Ask Popsicle about this call</button>
        </div>
      </div>
    </div>
  )
}
