'use client'
import { useEffect } from 'react'

// Calls the handler on Escape while `active` is true, and marks the document so the
// floating Ask bar hides (body[data-modal="1"] in globals.css). Nested overlays are
// counted, so closing an inner one does not un-hide the bar while an outer one is open.
let openCount = 0
export function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return
    openCount += 1
    document.body.dataset.modal = '1'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      openCount = Math.max(0, openCount - 1)
      if (openCount === 0) document.body.dataset.modal = '0'
    }
  }, [active, onClose])
}

/** Marks a popup as open for as long as `active` is true, through the same counter as useEscape,
 *  so the floating Ask bar hides and no other component can un-hide it while this one is open. */
export function useModalFlag(active: boolean) {
  useEffect(() => {
    if (!active) return
    openCount += 1
    document.body.dataset.modal = '1'
    return () => { openCount = Math.max(0, openCount - 1); if (openCount === 0) document.body.dataset.modal = '0' }
  }, [active])
}

