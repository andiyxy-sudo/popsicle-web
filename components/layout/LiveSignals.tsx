'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Toast = { id: string; title: string; account?: string; severity?: string; source?: string; quote?: string }

// Live signal toasts. Live mode subscribes to inserts on `signals` for this user,
// so a signal surfaces the moment it is detected. Demo mode plays a short script
// (first one ~40s after load, then every ~90s) so the real-time claim is visible
// during a pitch. Each toast opens Account 360 on click.
const DEMO_SCRIPT: Toast[] = [
  { id: 'demo-live-1', title: 'Renewal pricing email opened again, still no reply', account: 'Acme Corp', severity: 'high', source: 'gmail', quote: '4th open by Sarah Chen · 0 replies in 8 days' },
  { id: 'demo-live-2', title: 'Kevin Cho: CFO wants ROI numbers before approving', account: 'TechVault Inc', severity: 'watch', source: 'whatsapp', quote: '"Need to run this by our CFO first"' },
  { id: 'demo-live-3', title: 'Dana Kim confirmed the Jan 28 close target', account: 'Vertex Systems', severity: 'positive', source: 'gmail', quote: 'Contract review in final stage' },
  { id: 'demo-live-4', title: 'Legal hold confirmed in #axion-deal', account: 'Axion Partners', severity: 'high', source: 'slack', quote: '"3-5 week minimum delay. No workaround without security docs."' },
]
const SRC: Record<string, string> = { gmail: 'Gmail', whatsapp: 'WhatsApp', slack: 'Slack', zoom: 'Zoom', hubspot: 'HubSpot', gcal: 'Calendar', fireflies: 'Fireflies' }

export function LiveSignals({ userId, demo = false }: { userId: string; demo?: boolean }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const router = useRouter()

  const dismiss = useCallback((id: string) => setToasts(t => t.filter(x => x.id !== id)), [])
  const push = useCallback((t: Toast) => {
    setToasts(prev => [t, ...prev.filter(x => x.id !== t.id)].slice(0, 3))
    setTimeout(() => dismiss(t.id), 9000)
  }, [dismiss])

  useEffect(() => {
    if (demo) {
      let i = 0
      const first = setTimeout(() => { push(DEMO_SCRIPT[i++ % DEMO_SCRIPT.length]) }, 40000)
      const loop = setInterval(() => { push(DEMO_SCRIPT[i++ % DEMO_SCRIPT.length]) }, 90000)
      return () => { clearTimeout(first); clearInterval(loop) }
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
          style={{ pointerEvents: 'auto', background: 'var(--paper, #FBF8F3)', border: '1px solid var(--hairline, #EFEAE1)', borderRadius: 14, padding: '14px 16px 14px 18px', position: 'relative', overflow: 'hidden',
            boxShadow: '0 18px 50px -20px rgba(14,13,11,.35), 0 2px 8px rgba(14,13,11,.06)', cursor: t.account ? 'pointer' : 'default' }}>
          <span style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 2, background: color(t.severity) }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span className="live-dot" style={{ background: color(t.severity) }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: color(t.severity) }}>New signal · {word(t.severity)}</span>
            <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--ink-faint)' }}>{t.source ? `via ${SRC[t.source] ?? t.source}` : 'just now'}</span>
            <button onClick={e => { e.stopPropagation(); dismiss(t.id) }} aria-label="Dismiss" style={{ font: 'inherit', background: 'none', border: 0, color: 'var(--ink-faint)', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 16, marginLeft: 4 }}>×</button>
          </div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: 15, letterSpacing: '-.015em', color: 'var(--ink)', lineHeight: 1.35, marginTop: 8 }}>{t.title}</div>
          {(t.account || t.quote) && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 5, lineHeight: 1.5 }}>
              {t.account && <span style={{ color: 'var(--ink)' }}>{t.account}</span>}{t.account && t.quote ? <span style={{ color: 'var(--ink-faint)' }}> · </span> : null}{t.quote}
            </div>
          )}
          <span className="live-toast-bar" style={{ background: color(t.severity) }} />
        </div>
      ))}
    </div>
  )
}
