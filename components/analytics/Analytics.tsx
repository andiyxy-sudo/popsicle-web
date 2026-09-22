'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Loads PostHog once (only when a key is configured), identifies the person without personal details, and
// records a page view on every page change.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
let loading = false

export function Analytics({ userId, role, demo }: { userId: string; role?: string; demo: boolean }) {
  const pathname = usePathname()
  useEffect(() => {
    if (!KEY || loading || window.posthog) return
    loading = true
    const s = document.createElement('script')
    s.async = true
    s.src = `${HOST.replace('.i.posthog.com', '-assets.i.posthog.com')}/static/array.js`
    s.onload = () => {
      const ph = window.posthog
      if (!ph) return
      ph.init(KEY, { api_host: HOST, capture_pageview: false, person_profiles: 'identified_only', autocapture: false, disable_session_recording: true })
      ph.identify(userId, { role: role || 'not set', demo })
      for (const [e, p] of window.__phq ?? []) ph.capture(e, p)
      window.__phq = []
      ph.capture('$pageview', { path: window.location.pathname })
    }
    document.head.appendChild(s)
  }, [userId, role, demo])
  useEffect(() => { if (KEY && window.posthog?.capture) window.posthog.capture('$pageview', { path: pathname }) }, [pathname])
  return null
}
