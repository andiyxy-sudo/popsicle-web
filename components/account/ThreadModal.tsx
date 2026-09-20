'use client'

import { useEscape } from '@/components/ui/useEscape'

// The source behind a signal: the full email thread or chat conversation, not just the
// quoted line. Same shape as the call transcript so the two read as one pattern.
export type ThreadSource = {
  account: string; channel: string; subject: string; when: string; participants: string[]
  messages: Array<{ who: string; role?: string; when: string; text: string; mine?: boolean; flag?: string }>
}
const MONO = { fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.4px', textTransform: 'uppercase' as const }
const FLAG: Record<string, string> = { OBJECTION: 'var(--warn, #d38b1d)', RISK: 'var(--critical, #c43d2b)', COMMITMENT: 'var(--good, #2f8f5b)', SIGNAL: 'var(--accent, #E85A25)' }

export function ThreadModal({ t, onClose, onAsk }: { t: ThreadSource; onClose: () => void; onAsk: (q: string) => void }) {
  useEscape(true, onClose)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(14,13,11,.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 24px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(760px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--paper, #FBF8F3)', boxShadow: '0 44px 100px -34px rgba(14,13,11,.55)' }}>
        <div style={{ padding: '26px 30px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flex: 'none' }}>
          <div>
            <div style={{ ...MONO, color: 'var(--ink-faint)' }}>{t.account} · {t.channel}</div>
            <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-.03em', margin: '10px 0 0', color: 'var(--ink)' }}>{t.subject}</h2>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, ...MONO, color: 'var(--ink-faint)' }}>
              <span>{t.messages.length} messages</span><span>{t.when}</span><span>{t.participants.length} people</span>
            </div>
          </div>
          <button onClick={onClose} style={{ ...MONO, background: 'none', border: 0, cursor: 'pointer', color: 'var(--ink-faint)' }}>Close</button>
        </div>
        <div style={{ height: 0, borderTop: '1px solid var(--rule-strong, #0E0D0B)', margin: '20px 30px 0', flex: 'none' }} />

        <div style={{ padding: '4px 30px 10px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {t.messages.map((m, i) => (
            <div key={i} style={{ padding: '18px 0', borderTop: i === 0 ? 0 : '1px solid var(--hairline, #EFEAE1)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: m.mine ? 'var(--accent)' : 'var(--ink)' }}>{m.mine ? 'You' : m.who}</span>
                {m.role && <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{m.role}</span>}
                <span style={{ marginLeft: 'auto', ...MONO, fontSize: 10, color: 'var(--ink-faint)' }}>{m.when}</span>
              </div>
              <div style={{ marginTop: 8, paddingLeft: m.flag ? 14 : 0, borderLeft: m.flag ? `2px solid ${FLAG[m.flag] ?? 'var(--hairline, #EFEAE1)'}` : 0 }}>
                {m.flag && <div style={{ ...MONO, fontSize: 9.5, color: FLAG[m.flag] ?? 'var(--ink-faint)', marginBottom: 5 }}>{m.flag.toLowerCase()}</div>}
                <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink-muted)', whiteSpace: 'pre-line' }}>{m.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '18px 30px 22px', flex: 'none', borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
          <span style={{ ...MONO, fontSize: 10, color: 'var(--ink-faint)' }}>{t.participants.join(' · ')}</span>
          <button onClick={() => { onClose(); onAsk(`From the ${t.channel} thread "${t.subject}" with ${t.account}: what is really being said, and what should I send next?`) }}
            style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '11px 22px', border: 0, cursor: 'pointer', background: 'linear-gradient(135deg,#FF8A50,#FF6B35)', color: '#fff' }}>Ask AI about this thread</button>
        </div>
      </div>
    </div>
  )
}
