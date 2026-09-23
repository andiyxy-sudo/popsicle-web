'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AGENT_ENABLED } from '@/lib/agent/config'

type Toast = { id: string; title: string; account?: string; severity?: string; source?: string; quote?: string; quoteBy?: string; judgment?: string; amount?: number }

// Live signal toasts. Live mode subscribes to inserts on `signals` for this user,
// so a signal surfaces the moment it is detected. Demo mode plays a short script
// (first one ~40s after load, then every ~90s) so the real-time claim is visible
// during a pitch. Each toast opens Account 360 on click.
const DEMO_SCRIPT: Toast[] = [
  { id: 'demo-live-1', title: 'Sarah Chen opened the renewal email again, still no reply', account: 'Acme Corp', severity: 'high', source: 'gmail', amount: 480_000,
    judgment: 'That is the fourth open in eight days. Repeated opens without a reply usually mean it is being discussed without you. Send the year-on-year breakdown today so the conversation has your numbers in it.' },
  { id: 'demo-live-4', title: 'Legal hold confirmed in #axion-deal', account: 'Axion Partners', severity: 'high', source: 'slack', amount: 95_000,
    quote: '3-5 week minimum delay. No workaround without security docs.', quoteBy: 'Rachel Voss',
    judgment: 'Redlines that stall past day five add 18 days to close on average. The pre-approved redline is already five days late. Send it with SOC2 and the pen test summary in one message.' },
  { id: 'demo-live-3', title: 'Dana Kim confirmed the January 28 close', account: 'Vertex Systems', severity: 'positive', source: 'gmail', amount: 175_000,
    quote: 'Contract review is in the final stage. We are still aiming for the 28th.', quoteBy: 'Dana Kim',
    judgment: 'On track. Put the two-week onboarding commitment in the contract as she asked, and this closes clean.' },
]
const SRC: Record<string, string> = { gmail: 'Gmail', whatsapp: 'WhatsApp', slack: 'Slack', zoom: 'Zoom', hubspot: 'HubSpot', gcal: 'Calendar', fireflies: 'Fireflies' }

export function LiveSignals({ userId, demo = false }: { userId: string; demo?: boolean }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const queued = useRef<Toast[]>([])   // notes that arrived while the Ask sheet was open
  const router = useRouter()

  const dismiss = useCallback((id: string) => setToasts(t => t.filter(x => x.id !== id)), [])
  const push = useCallback((t: Toast) => {
    // v11.88: with the agent on, the agent tells you about the signal instead of a toast
    if (AGENT_ENABLED) { window.dispatchEvent(new CustomEvent('agent:signal', { detail: t })); return }
    // don't talk over the Ask sheet: hold the note until it is closed
    if (typeof document !== 'undefined' && document.documentElement.dataset.askOpen === '1') { queued.current.push(t); return }
    setToasts(prev => [t, ...prev.filter(x => x.id !== t.id)].slice(0, 3))
    setTimeout(() => dismiss(t.id), 9000)
  }, [dismiss])

  useEffect(() => {   // when the sheet closes, show at most one of the notes that waited
    const t = setInterval(() => {
      if (typeof document === 'undefined' || document.documentElement.dataset.askOpen === '1') return
      const next = queued.current.shift()
      if (next) { setToasts(prev => [next, ...prev.filter(x => x.id !== next.id)].slice(0, 3)); setTimeout(() => dismiss(next.id), 9000) }
    }, 1500)
    return () => clearInterval(t)
  }, [dismiss])

  useEffect(() => {
    if (demo) {
      // a colleague with judgment: three notes across a session, not a stream
      const at = [45_000, 210_000, 420_000]
      const timers = at.map((ms, i) => setTimeout(() => push(DEMO_SCRIPT[i]), ms))
      return () => timers.forEach(clearTimeout)
    }
    const supabase = createClient()
    const channel = supabase
      .channel('signals-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals', filter: `user_id=eq.${userId}` }, (payload) => {
        const s = payload.new as { id: string; title?: string; account_name?: string; severity?: string; is_dismissed?: boolean; source_integration?: string; ai_analysis?: { quote?: string } }
        if (s.is_dismissed) return
        push({ id: s.id, title: s.title || 'New signal detected', account: s.account_name, severity: s.severity, source: s.source_integration, quote: s.ai_analysis?.quote })
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, demo, router, push])

  if (toasts.length === 0) return null
  const color = (sev?: string) => sev === 'high' ? 'var(--critical, #c43d2b)' : sev === 'positive' ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)'
  const word = (sev?: string) => sev === 'high' ? 'at risk' : sev === 'positive' ? 'positive' : 'watch'

  return (
    <div style={{ position: 'fixed', right: 24, bottom: 96, zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: 10, width: 'min(360px, calc(100vw - 48px))', pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} className="live-toast"
          onClick={() => { if (t.account) window.dispatchEvent(new CustomEvent('open-a360', { detail: { name: t.account, contact: '', stage: 'Active', risk: (t.severity || 'watch').toUpperCase(), arr: '--', health: '--' } })); dismiss(t.id) }}
          style={{ pointerEvents: 'auto', position: 'relative', overflow: 'hidden', cursor: t.account ? 'pointer' : 'default',
            background: 'rgba(251,248,243,.86)', backdropFilter: 'blur(14px) saturate(1.2)', WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
            border: '1px solid var(--d-hair, rgba(14,13,11,.08))', boxShadow: '0 30px 60px -28px rgba(14,13,11,.32), 0 1px 0 rgba(255,255,255,.6) inset', padding: '18px 20px 16px' }}>
          {/* a soft tint of the severity colour in the top-right corner */}
          <span aria-hidden style={{ position: 'absolute', right: -60, top: -60, width: 180, height: 180, borderRadius: '50%', background: color(t.severity), opacity: .10, filter: 'blur(28px)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, position: 'relative' }}>
            <span className="live-dot" style={{ background: color(t.severity) }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: color(t.severity) }}>{word(t.severity)}</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>· new signal{t.source ? ` · ${SRC[t.source] ?? t.source}` : ''}</span>
            <button onClick={e => { e.stopPropagation(); dismiss(t.id) }} aria-label="Dismiss" style={{ marginLeft: 'auto', font: 'inherit', background: 'none', border: 0, color: 'var(--ink-faint)', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 17 }}>×</button>
          </div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: '-.02em', lineHeight: 1.3, color: 'var(--ink)', marginTop: 10, position: 'relative' }}>{t.title}</div>
          {t.quote && <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.5, position: 'relative' }}>{t.quote}</div>}
          {t.account && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--d-hair, rgba(14,13,11,.08))', position: 'relative' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t.account}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>Open account →</span>
            </div>
          )}
          <span className="live-toast-bar" style={{ background: color(t.severity) }} />
        </div>
      ))}
    </div>
  )
}
