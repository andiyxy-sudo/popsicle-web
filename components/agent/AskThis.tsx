'use client'

import { useRouter, usePathname } from 'next/navigation'
import { AGENT_ENABLED, ASK_DOCK } from '@/lib/agent/config'

// The "@grok" gesture inside the portal. Put this in any row with className "askable"
// on the row: hovering the row reveals "Ask ↗", and tapping it opens the Ask bar's sheet
// already asking about that exact thing, about that account.
export function AskThis({ q, account, label = 'Ask' }: { q: string; account?: string | null; label?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  if (!AGENT_ENABLED) return null
  const go = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    if (ASK_DOCK && !pathname?.startsWith('/ask')) {
      window.dispatchEvent(new CustomEvent('dock:ask', { detail: { q, account: account ?? undefined } }))
    } else {
      router.push(`/ask?q=${encodeURIComponent(q)}${account ? `&account=${encodeURIComponent(account)}` : ''}`)
    }
  }
  return (
    <button className="ask-this" onClick={go} onMouseDown={e => e.stopPropagation()} title={q} aria-label={`Ask Popsicle: ${q}`}>
      <span className="ask-this-mark" aria-hidden />{label}
    </button>
  )
}
