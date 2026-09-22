'use client'

import { useEffect } from 'react'
import { useSettings } from '@/lib/useSettings'

// Easy read: every piece of small text (under 14px) is shown 20% larger. Headings and big figures are
// untouched. Works on anything that appears later too (popups, answers); switching off restores it exactly.
const LIMIT = 14, FACTOR = 1.2
const SKIP = new Set(['SCRIPT', 'STYLE', 'SVG', 'svg', 'PATH', 'path', 'IMG', 'INPUT', 'SELECT', 'TEXTAREA', 'BR'])
export function EasyRead() {
  const { easyRead } = useSettings()
  useEffect(() => {
    const local = (() => { try { return localStorage.getItem('easyread') === '1' } catch { return false } })()
    const on = easyRead ?? local
    try { localStorage.setItem('easyread', on ? '1' : '0') } catch { /* ignore */ }
    document.documentElement.toggleAttribute('data-easyread', !!on)
    const restore = () => document.querySelectorAll<HTMLElement>('[data-er]').forEach(el => { el.style.removeProperty('font-size'); if (el.dataset.erInline) el.style.fontSize = el.dataset.erInline; delete el.dataset.er; delete el.dataset.erInline })
    if (!on) { restore(); return }
    const enlarge = (el: Element) => {
      if (!(el instanceof HTMLElement) || SKIP.has(el.tagName) || el.closest('svg')) return
      // only elements that hold text themselves
      if (![...el.childNodes].some(n => n.nodeType === 3 && (n.nodeValue ?? '').trim())) return
      const want = el.dataset.er ? Number(el.dataset.er) * FACTOR : 0
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (el.dataset.er) { if (Math.abs(size - want) > 0.5) el.style.setProperty('font-size', `${want}px`, 'important'); return }
      if (!size || size >= LIMIT) return
      el.dataset.er = String(size); if (el.style.fontSize) el.dataset.erInline = el.style.fontSize
      el.style.setProperty('font-size', `${size * FACTOR}px`, 'important')
    }
    const scan = (root: Element) => { enlarge(root); root.querySelectorAll('*').forEach(enlarge) }
    let queued: Element[] = [], raf = 0
    const flush = () => { raf = 0; const q = queued; queued = []; q.forEach(n => n.isConnected && scan(n)) }
    const obs = new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'childList') m.addedNodes.forEach(n => { if (n.nodeType === 1) queued.push(n as Element); else if (n.parentElement) queued.push(n.parentElement) })
        else if (m.type === 'attributes' && (m.target as HTMLElement).dataset?.er) queued.push(m.target as Element)   // a re-render reset its size
        else if (m.type === 'characterData' && m.target.parentElement) queued.push(m.target.parentElement)
      }
      if (queued.length && !raf) raf = requestAnimationFrame(flush)
    })
    scan(document.body)
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] })
    return () => { obs.disconnect(); if (raf) cancelAnimationFrame(raf) }
  }, [easyRead])
  return null
}
