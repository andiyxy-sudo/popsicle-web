// Product analytics (PostHog). Off unless NEXT_PUBLIC_POSTHOG_KEY is set. Events carry no email addresses and
// no message content: people are identified by their account id, role and whether they're on the demo.
type PH = { capture: (e: string, p?: Record<string, unknown>) => void; identify: (id: string, p?: Record<string, unknown>) => void; init: (k: string, o: Record<string, unknown>) => void }
declare global { interface Window { posthog?: PH; __phq?: Array<[string, Record<string, unknown> | undefined]> } }

export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  if (window.posthog?.capture) window.posthog.capture(event, props)
  else (window.__phq ??= []).push([event, props])   // sent as soon as PostHog has loaded
}
