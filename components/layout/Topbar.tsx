'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface TopbarProps {
  eyebrow?: string
  title: string
  actions?: React.ReactNode
}

export function Topbar({ eyebrow, title, actions }: TopbarProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/accounts?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <header style={{
      height: 64,
      background: 'var(--surface)',
      boxShadow: '0 1px 4px rgba(13,10,7,.06)',
      display: 'flex', alignItems: 'center',
      padding: '0 28px', gap: 16,
      flexShrink: 0, zIndex: 50, position: 'relative',
    }}>
      <div style={{ marginRight: 8 }}>
        {eyebrow && (
          <div style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '1.6px',
            textTransform: 'uppercase', color: 'var(--t4)',
            fontFamily: "'DM Mono', monospace", lineHeight: 1, marginBottom: 3,
          }}>
            {eyebrow}
          </div>
        )}
        <div style={{
          fontSize: 19, fontWeight: 800, letterSpacing: '-0.5px',
          color: 'var(--t1)', lineHeight: 1,
        }}>
          {title}
        </div>
      </div>

      <form onSubmit={handleSearch} style={{ marginLeft: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          background: 'var(--inset)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)', padding: '9px 14px', width: 280,
          boxShadow: 'inset 0 1px 3px rgba(15,12,9,.06)',
          transition: 'all .2s',
        }}
          onFocus={e => {
            const el = e.currentTarget
            el.style.borderColor = 'var(--o)'
            el.style.boxShadow = 'inset 0 1px 3px rgba(15,12,9,.06), 0 0 0 3px var(--o-bg)'
            el.style.background = 'var(--surface)'
          }}
          onBlur={e => {
            const el = e.currentTarget
            el.style.borderColor = 'var(--border)'
            el.style.boxShadow = 'inset 0 1px 3px rgba(15,12,9,.06)'
            el.style.background = 'var(--inset)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search accounts..."
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontFamily: "'Outfit', sans-serif", fontSize: 13,
              color: 'var(--t1)', flex: 1,
            }}
          />
          <span style={{
            fontSize: 10, color: 'var(--t4)',
            background: 'var(--inset)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '1px 6px',
            fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            /
          </span>
        </div>
      </form>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {actions}
      </div>
    </header>
  )
}
