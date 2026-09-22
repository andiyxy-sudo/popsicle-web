'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Cmd+K / Ctrl+K: jump to a page or an account, or ask Popsicle a question.
// Accounts come from the demo dataset (loaded on demand) or the accounts table.
type Item = { kind: 'page' | 'account' | 'ask'; label: string; sub?: string; go: () => void }
const PAGES: Array<[string, string]> = [['Pulse', '/pulse'], ['Portfolio', '/portfolio'], ['Signals', '/signals'], ['Forecast', '/forecast'], ['Intelligence', '/intelligence'], ['Team', '/team'], ['Integrations', '/integrations'], ['Settings', '/settings'], ['Ask Popsicle', '/ask']]

export function CommandPalette({ demo }: { demo: boolean }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [accounts, setAccounts] = useState<Array<{ name: string; stage?: string | null; value?: number | null }>>([])
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (!open) return
    setQ(''); setIdx(0)
    setTimeout(() => inputRef.current?.focus(), 20)
    if (accounts.length) return
    if (demo) import('@/lib/demo-dataset').then(m => setAccounts(m.DEMO_ACCOUNTS.map(a => ({ name: a.name, stage: a.stage, value: a.value }))))
    else createClient().from('accounts').select('name, stage, value').limit(200).then(({ data }) => setAccounts((data ?? []) as typeof accounts))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, demo])

  const items = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase()
    const go = (href: string) => () => { setOpen(false); router.push(href) }
    const pages: Item[] = PAGES.filter(([n]) => !needle || n.toLowerCase().includes(needle)).map(([n, h]) => ({ kind: 'page', label: n, sub: 'Go to page', go: go(h) }))
    const accts: Item[] = accounts.filter(a => !needle || a.name.toLowerCase().includes(needle)).slice(0, 8)
      .map(a => ({ kind: 'account', label: a.name, sub: [a.stage, a.value ? `$${Math.round(Number(a.value) / 1000)}K` : null].filter(Boolean).join(' · '), go: go(`/accounts/${encodeURIComponent(a.name)}`) }))
    const ask: Item[] = needle.length > 2 ? [{ kind: 'ask', label: `Ask Popsicle: "${q.trim()}"`, sub: 'Opens Ask with this question', go: go(`/ask?q=${encodeURIComponent(q.trim())}`) }] : []
    return [...accts, ...pages, ...ask]
  }, [q, accounts, router])

  useEffect(() => { setIdx(0) }, [q])
  if (!open) return null
  const mono = { fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase' as const, color: 'var(--ink-faint)' }
  return (
    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'var(--d-tintbg, rgba(14,13,11,.42))', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px, calc(100vw - 32px))', background: 'var(--paper, #FBF8F3)', boxShadow: '0 40px 90px -30px rgba(14,13,11,.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Jump to an account, a page, or ask anything"
            onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(items.length - 1, i + 1)) } if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)) } if (e.key === 'Enter' && items[idx]) items[idx].go() }}
            style={{ flex: 1, font: 'inherit', fontSize: 16, border: 0, outline: 0, background: 'transparent', color: 'var(--ink)' }} />
          <span style={mono}>esc</span>
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: '6px 0' }}>
          {items.length === 0 && <div style={{ padding: '20px 20px', fontSize: 14, color: 'var(--ink-faint)' }}>Nothing matches.</div>}
          {items.map((it, i) => (
            <div key={`${it.kind}-${it.label}`} onMouseEnter={() => setIdx(i)} onClick={it.go}
              style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '11px 20px', cursor: 'pointer', background: i === idx ? 'var(--inset, #F4F0E8)' : 'transparent' }}>
              <span style={{ ...mono, width: 60, color: it.kind === 'ask' ? 'var(--accent)' : 'var(--ink-faint)' }}>{it.kind}</span>
              <span style={{ fontSize: 15, color: 'var(--ink)', fontWeight: it.kind === 'account' ? 600 : 500 }}>{it.label}</span>
              {it.sub && <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{it.sub}</span>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 18, padding: '10px 20px', borderTop: '1px solid var(--hairline, #EFEAE1)', ...mono }}>
          <span>↑↓ move</span><span>↵ open</span><span>⌘K toggle</span>
        </div>
      </div>
    </div>
  )
}
