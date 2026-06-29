'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const LABEL: Record<string, string> = { gmail: 'Gmail', gcal: 'Google Calendar', slack: 'Slack', zoom: 'Zoom' }

function CallbackInner() {
  const router = useRouter()
  const params = useSearchParams()
  const provider = params.get('provider') ?? ''
  const status = params.get('status') ?? ''
  const detail = params.get('detail') ?? ''
  const name = LABEL[provider] ?? 'Integration'
  const ok = status === 'ok'
  const [phase, setPhase] = useState<'result' | 'syncing'>('result')

  // On success, immediately kick a first sync so the user has data when they
  // land back on the dashboard. Then redirect to integrations.
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!ok) {
        const t = setTimeout(() => router.replace('/integrations'), 3500)
        return () => clearTimeout(t)
      }
      setPhase('syncing')
      try {
        const fn = `oauth-${provider}`
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${fn}?action=sync`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: 'sync', force: true }),
          })
        }
      } catch { /* best effort */ }
      if (!cancelled) router.replace('/integrations')
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, provider])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#F8F5F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit',sans-serif" }}>
      <div style={{ width: 380, background: '#fff', border: '1px solid #F0EDE8', borderRadius: 18, padding: 36, textAlign: 'center', boxShadow: '0 16px 48px rgba(15,12,9,.12)' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: ok ? 'rgba(42,157,92,.1)' : 'rgba(224,62,62,.1)' }}>
          {ok ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2A9D5C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E03E3E" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          )}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#4A3C32', marginBottom: 6 }}>
          {ok ? `${name} connected` : `${name} connection failed`}
        </div>
        <div style={{ fontSize: 13, color: '#8A7C70', lineHeight: 1.5 }}>
          {ok
            ? (phase === 'syncing' ? 'Pulling your first batch of data...' : 'Success. Redirecting...')
            : (detail ? `Reason: ${detail}` : 'Something went wrong. Please try again.')}
        </div>
        {ok && phase === 'syncing' && (
          <div style={{ marginTop: 18, width: 28, height: 28, margin: '18px auto 0', border: '3px solid #F0EDE8', borderTopColor: '#FF6B35', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

export default function IntegrationCallbackPage() {
  return (
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#F8F5F0' }} />}>
      <CallbackInner />
    </Suspense>
  )
}
