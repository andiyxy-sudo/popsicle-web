'use client'

import { useEffect } from 'react'
import { useSettings } from '@/lib/useSettings'
import { spell, spellingFor } from '@/packages/popsicle-shared/copy'

// The product is written in American English. Choosing English (UK) in Settings rewrites what is on
// screen, the same way the currency layer converts amounts: one pass over the text, then a watcher for
// anything that renders later. Inputs, code and the user's own text are left alone.
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE'])

export function SpellingLayer() {
  const settings = useSettings()
  const mode = spellingFor(settings.language)

  useEffect(() => {
    if (mode === 'US') return                       // the source is already American
    const convert = (n: Node) => {
      if (n.nodeType === 3) {
        const p = n.parentElement
        if (!p || SKIP.has(p.tagName) || p.isContentEditable || p.closest('[data-no-spell]')) return
        const t = n.nodeValue ?? ''
        if (!t.trim()) return
        const out = spell(t, 'UK')
        if (out !== t) n.nodeValue = out
      } else if (n.nodeType === 1 && !SKIP.has((n as Element).tagName)) {
        const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT)
        let x: Node | null
        while ((x = w.nextNode())) convert(x)
      }
    }
    convert(document.body)
    const obs = new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') convert(m.target)
        else m.addedNodes.forEach(convert)
      }
    })
    obs.observe(document.body, { subtree: true, childList: true, characterData: true })
    return () => obs.disconnect()
  }, [mode])

  return null
}
