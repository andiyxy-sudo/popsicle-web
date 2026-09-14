'use client'

import { useState, useEffect, useRef } from 'react'
import { Sidebar } from './Sidebar'
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
  // Every route lands at the top: the scrollable column is .content, and
  // browser scroll anchoring + the entrance animation can otherwise leave it
  // a few pixels down on first paint.
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Defensive: a throwing scroll call here would take the whole shell down
    // and leave the content column blank until a client-side nav re-rendered it.
    try {
      if (contentRef.current) contentRef.current.scrollTop = 0
      window.scrollTo(0, 0)
    } catch { /* non-fatal */ }
  }, [pathname])

  const submitAsk = () => { const q = ask.trim(); if (!q) return; setAsk(''); router.push(`/ask?q=${encodeURIComponent(q)}`) }


  return (
    <>
      <Sidebar user={user} isDemo={isDemo} badges={badges} />
      <div className="main" style={{ position: 'relative' }}>
        {/* warm corner wash (design shell) */}
        <div aria-hidden style={{ position: 'absolute', top: 0, right: 0, width: 'min(900px,100%)', height: 900, pointerEvents: 'none', background: 'radial-gradient(120% 90% at 90% -10%, rgba(255,138,80,.22), rgba(255,138,80,0) 70%)', zIndex: 0 }} />
        <div className="content" ref={contentRef} style={{ position: 'relative', zIndex: 1 }}>
          {children}
          <footer className="ed-footer">
            <span><span className="ed-dot" />All systems synced{badges.integrations ? ` · ${badges.integrations} sources live` : ''}</span>
            <span>Popsicle Labs · Revenue intelligence infrastructure</span>
            <span>v1.6</span>
          </footer>
        </div>
      </div>

      {/* floating Ask bar (design shell) */}
      {pathname !== '/ask' && (
        <div className="ed-askbar-wrap">
          <div className="ed-askbar">
            <span className="ed-askdot"><span /><span /></span>
            <input value={ask} onChange={e => setAsk(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitAsk() }} placeholder="Ask Popsicle anything about your pipeline" />
            <button onClick={submitAsk}>Ask</button>
          </div>
        </div>
      )}
      {/* AI panel mounts here later */}
      {aiOpen && (
        <div onClick={() => setAiOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
      )}
    </>
  )
}
