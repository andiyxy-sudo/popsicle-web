'use client'

import { useState, useEffect, useRef } from 'react'
import { Sidebar } from './Sidebar'
import { LiveSignals } from './LiveSignals'
import { CommandPalette } from './CommandPalette'
import { Presence } from './Presence'
import { AgentPopup } from '@/components/agent/AgentPopup'
import { AGENT_ENABLED } from '@/lib/agent/config'
import { Account360 } from '@/components/account/Account360'
import { useRouter, usePathname } from 'next/navigation'

interface AppShellProps {
  user: { email: string; id: string; name?: string }
  isDemo: boolean
  badges?: { portfolio?: number; signals?: number; integrations?: number }
  children: React.ReactNode
}

export function AppShell({ user, isDemo, badges = {}, children }: AppShellProps) {
  const [aiOpen, setAiOpen] = useState(false)
  const [ask, setAsk] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  // the section-entrance animation plays only while this is set (navigation), never on re-renders
  // Starts false so server-rendered HTML never carries the animation class: a full
  // page load (first sign-in, refresh) paints the content immediately with no
  // opacity/transform state to get stuck in. Client navigations animate.
  const [entering, setEntering] = useState(false)
  const firstPath = useRef(true)
  useEffect(() => {
    if (firstPath.current) { firstPath.current = false; return }
    setEntering(true); const t = setTimeout(() => setEntering(false), 800); return () => clearTimeout(t)
  }, [pathname])
  // Every route lands at the top: the scrollable column is .content, and
  // browser scroll anchoring + the entrance animation can otherwise leave it
  // a few pixels down on first paint.
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Lets client components skip database round-trips in demo mode.
    if (typeof document !== 'undefined') document.body.dataset.demo = isDemo ? '1' : '0'
  }, [isDemo])
  useEffect(() => {
    // The loading skeleton renders first and the real page swaps in at a
    // different height, so resetting once (before the swap) is not enough:
    // reset on mount, on the next frame, and after the content settles.
    const top = () => {
      try {
        if (contentRef.current) contentRef.current.scrollTop = 0
        window.scrollTo(0, 0)
      } catch { /* non-fatal */ }
    }
    top()
    const raf = requestAnimationFrame(top)
    const t1 = setTimeout(top, 120)
    const t2 = setTimeout(top, 400)
    // Any late-arriving content (client fetches) must not drag the view down.
    const el = contentRef.current
    const obs = el && typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => { el.scrollTop = 0 })
      : null
    if (obs && el) obs.observe(el, { childList: true, subtree: true })
    // Content growing (data arriving) must not push the view down either.
    const ro = el && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { if (el.scrollTop > 0) el.scrollTop = 0 })
      : null
    if (ro && el) ro.observe(el)
    const t3 = setTimeout(() => { obs?.disconnect(); ro?.disconnect() }, 2000)
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); obs?.disconnect(); ro?.disconnect() }
  }, [pathname])

  const submitAsk = () => { const q = ask.trim(); if (!q) return; setAsk(''); router.push(`/ask?q=${encodeURIComponent(q)}`) }


  return (
    <div className="ed-app">
      {/* The sidebar is position: sticky (design shell), so it must sit beside .main in a
          flex row. Without this wrapper it stacked above .main in block flow and pushed the
          whole content column one viewport down: sidebar visible, page blank, until a client
          navigation scrolled the window to the new page (the "click twice" behaviour). */}
      <Sidebar user={user} isDemo={isDemo} badges={badges} />
      <LiveSignals userId={user.id} demo={isDemo} />
      <CommandPalette demo={isDemo} />
      {AGENT_ENABLED && <AgentPopup />}
      <Presence userId={user.id} name={user.name || user.email?.split('@')[0] || 'Teammate'} demo={isDemo} />
      <div className="main" style={{ position: 'relative' }}>
        <div className={`content${entering ? ' entering' : ''}`} ref={contentRef} style={{ position: 'relative', zIndex: 1 }}>
          {/* warm corner wash (design shell). Lives inside the scroll column so
              it is pinned to the top of the page and scrolls away with it. */}
          <div aria-hidden className="ed-wash" style={{ background: 'radial-gradient(circle 760px at 90% -8%, rgba(255,138,80,.22), rgba(255,138,80,.09) 40%, rgba(255,138,80,0) 70%)' }} />
          {children}
          <footer className="ed-footer">
            <span><span className="ed-dot" />All systems synced{badges.integrations ? ` · ${badges.integrations} sources live` : ''}</span>
            <span>Popsicle Labs · Revenue intelligence infrastructure</span>
            <span>v11.90</span>
          </footer>
        </div>
      </div>

      {/* Account 360 listens globally for 'open-a360' from any screen */}
      <Account360 />

      {/* floating Ask bar (design shell) */}
      {pathname !== '/ask' && (
        <div className="ed-askbar-wrap">
          <div className="ed-askbar-measure">
          <div className="ed-askbar">
            <span className="ed-askdot"><span /><span /></span>
            <input value={ask} onChange={e => setAsk(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitAsk() }} placeholder="Ask Popsicle anything about your pipeline" />
            <button onClick={submitAsk}>Ask</button>
          </div>
          </div>
        </div>
      )}
      {/* AI panel mounts here later */}
      {aiOpen && (
        <div onClick={() => setAiOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
      )}
    </div>
  )
}
