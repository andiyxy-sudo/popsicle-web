'use client'

import { useEffect } from 'react'
import { useSettings } from '@/lib/useSettings'
import { convertText, type CurrencyCode } from '@/lib/currency'

// Shows every amount in the currency chosen in Settings. Figures are kept in US dollars everywhere
// (data, calculations, AI answers); this layer converts each dollar amount as it appears on screen,
// so pages, popups, charts and Ask Popsicle's answers all follow the setting. Inputs are left alone.
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE'])
export function CurrencyLayer() {
  const settings = useSettings()
  const code = (settings.currency ?? 'USD') as CurrencyCode
  useEffect(() => {
    if (code === 'USD') return
    let rate = 0, dead = false
    const convertNode = (n: Node) => {
      if (n.nodeType === 3) {
        const p = n.parentElement
        if (!p || SKIP.has(p.tagName) || p.isContentEditable || p.closest('[data-no-fx]')) return
        const t = n.nodeValue ?? ''
        if (t.indexOf('$') < 0) return
        const out = convertText(t, code, rate)
        if (out !== t) n.nodeValue = out
      } else if (n.nodeType === 1 && !SKIP.has((n as Element).tagName)) {
        const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let x: Node | null
        while ((x = w.nextNode())) convertNode(x)
      }
    }
    const obs = new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') convertNode(m.target); else m.addedNodes.forEach(convertNode) } })
    ;(async () => {
      let rates: Record<string, number> | null = null
      try { const c = JSON.parse(localStorage.getItem('fx:rates') || 'null'); if (c && Date.now() - c.at < 12 * 3600e3) rates = c.rates } catch { /* ignore */ }
      if (!rates) { try { const j = await (await fetch('/api/fx')).json(); rates = j.rates; localStorage.setItem('fx:rates', JSON.stringify({ at: Date.now(), rates })) } catch { /* ignore */ } }
      if (dead || !rates?.[code]) return
      rate = rates[code]
      convertNode(document.body)
      obs.observe(document.body, { subtree: true, childList: true, characterData: true })
    })()
    return () => { dead = true; obs.disconnect() }
  }, [code])
  return null
}
