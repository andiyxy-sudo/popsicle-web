'use client'

import { useState, useEffect, useRef } from 'react'
import { Sidebar } from './Sidebar'
import { LiveSignals } from './LiveSignals'
import { CommandPalette } from './CommandPalette'
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
  // Blank-column diagnostic (v11.65): 2.5s after mount, if the content column has
  // no visible screen, report what the DOM looks like, on screen and to /api/client-error.
  const [diag, setDiag] = useState<string | null>(null)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const el = contentRef.current; if (!el) return
        const screens = Array.from(el.querySelectorAll('.dsk-screen')) as HTMLElement[]
        // the route skeleton is itself a .dsk-screen, so "visible" must mean real text, not grey blocks
        const visible = screens.some(x => x.offsetHeight > 0 && getComputedStyle(x).opacity !== '0' && getComputedStyle(x).display !== 'none' && (x.innerText || '').trim().length > 40)
        const pending = document.querySelector('div[hidden][id^="S:"]') != null || /<!--\$\?-->/.test(document.body.innerHTML)
        // v11.67: always report for 8s, so the absence of the box proves the page's JS never ran
        // what is actually on top at the centre of the column, and where the screen sits
        const r = el.getBoundingClientRect()
        const probe = (x: number, y: number) => { const e = document.elementFromPoint(x, y) as HTMLElement | null; return e ? `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').filter(Boolean).slice(0, 3).join('.') : ''} bg=${getComputedStyle(e).backgroundColor} z=${getComputedStyle(e).zIndex} pos=${getComputedStyle(e).position}` : 'nothing' }
        const top1 = probe(r.left + r.width / 2, r.top + r.height / 3)
        const top2 = probe(r.left + r.width / 2, r.top + r.height * 0.7)
        const fr = screens[0]?.getBoundingClientRect()
        const where = `column rect top=${Math.round(r.top)} h=${Math.round(r.height)} scrollTop=${el.scrollTop} · screen rect top=${fr ? Math.round(fr.top) : '?'} h=${fr ? Math.round(fr.height) : '?'} · on top @1/3: ${top1} · on top @2/3: ${top2}`
        if (visible && !pending) { setDiag(`js ran · ${screens.length} screen(s) with text · nothing pending\n${where}\n(closes itself in 20s, click to close)`); setTimeout(() => setDiag(null), 20000); return }
        const hidden = Array.from(document.querySelectorAll('div[hidden]')).map(d => (d as HTMLElement).id).filter(Boolean)
        const first = screens[0]
        const cs = first ? getComputedStyle(first) : null
        const info = [
          `path ${location.pathname}`,
          `screens in column: ${screens.length}`,
          first ? `first screen: class="${first.className}" display=${cs?.display} opacity=${cs?.opacity} h=${first.offsetHeight} children=${first.children.length}` : 'no .dsk-screen inside .content',
          `column children: ${Array.from(el.children).map(c => (c as HTMLElement).className || c.tagName).join(' | ')}`,
          `column scrollTop=${el.scrollTop} scrollHeight=${el.scrollHeight} clientHeight=${el.clientHeight} display=${getComputedStyle(el).display}`,
          `hidden stream divs: ${hidden.length}${hidden.length ? ' (' + hidden.slice(0, 5).join(', ') + ')' : ''} · pending boundary markers: ${(document.body.innerHTML.match(/<!--\$\?-->/g) || []).length}`,
          `first screen text: "${(first?.innerText || '').trim().slice(0, 60)}"`,
          `body text has content: ${document.body.innerText.includes('POPSICLE LABS') ? 'footer yes' : 'footer no'}`,
          where,
        ].join('\n')
        setDiag(info)
        fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'blank-column diagnostic', stack: info, path: location.pathname, ua: navigator.userAgent }) }).catch(() => {})
      } catch { /* ignore */ }
    }, 2500)
    return () => clearTimeout(t)
  }, [pathname])
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
    <>
      <Sidebar user={user} isDemo={isDemo} badges={badges} />
      <LiveSignals userId={user.id} demo={isDemo} />
      {diag && (
        <pre onClick={() => setDiag(null)} style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 100000, maxWidth: 'min(720px, calc(100vw - 32px))', margin: 0, padding: '12px 14px', background: '#0E0D0B', color: '#FBF8F3', fontFamily: "'DM Mono',monospace", fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', border: '1px solid #E85A25', cursor: 'pointer' }}>
{'DIAGNOSTIC · content column looks blank · click to close · please send this text\n'}{diag}
        </pre>
      )}
      <CommandPalette demo={isDemo} />
      <div className="main" style={{ position: 'relative' }}>
        <div className={`content${entering ? ' entering' : ''}`} ref={contentRef} style={{ position: 'relative', zIndex: 1 }}>
          {/* warm corner wash (design shell). Lives inside the scroll column so
              it is pinned to the top of the page and scrolls away with it. */}
          <div aria-hidden className="ed-wash" style={{ background: 'radial-gradient(circle 760px at 90% -8%, rgba(255,138,80,.22), rgba(255,138,80,.09) 40%, rgba(255,138,80,0) 70%)' }} />
          {children}
          <footer className="ed-footer">
            <span><span className="ed-dot" />All systems synced{badges.integrations ? ` · ${badges.integrations} sources live` : ''}</span>
            <span>Popsicle Labs · Revenue intelligence infrastructure</span>
            <span>v11.69</span>
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
    </>
  )
}
