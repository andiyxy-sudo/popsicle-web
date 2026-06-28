'use client'

import { useState } from 'react'
import { Signal } from '@/types'
import { formatRelativeTime, integrationLabel } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface SignalCardProps {
  signal: Signal
  onUpdate?: () => void
}

const SEVERITY_CONFIG = {
  high: { label: 'At Risk', bg: 'var(--danger-bg)', border: 'var(--danger-bd)', color: 'var(--danger)', dot: '#DC2626' },
  watch: { label: 'Watch', bg: 'var(--amber-bg)', border: 'var(--amber-bd)', color: 'var(--amber)', dot: '#D97706' },
  positive: { label: 'Positive', bg: 'var(--ok-bg)', border: 'var(--ok-bd)', color: 'var(--ok)', dot: '#16A34A' },
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  gmail: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  gcal: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  slack: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/>
      <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
      <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/>
      <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/>
      <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/>
      <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
      <path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/>
      <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/>
    </svg>
  ),
  zoom: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
}

export function SignalCard({ signal, onUpdate }: SignalCardProps) {
  const [actioning, setActioning] = useState<'snooze' | 'dismiss' | null>(null)
  const supabase = createClient()
  const cfg = SEVERITY_CONFIG[signal.severity ?? 'watch'] ?? SEVERITY_CONFIG.watch

  async function handleSnooze() {
    setActioning('snooze')
    await supabase.from('signals').update({ is_snoozed: true }).eq('id', signal.id)
    onUpdate?.()
  }

  async function handleDismiss() {
    setActioning('dismiss')
    await supabase.from('signals').update({ is_dismissed: true }).eq('id', signal.id)
    onUpdate?.()
  }

  return (
    <div
      className="fade-in"
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--r)',
        padding: '18px 20px',
        boxShadow: 'var(--sh-sm)',
        border: `1px solid ${cfg.border}`,
        transition: 'all .22s',
        position: 'relative',
        opacity: actioning ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = 'var(--sh-md)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'var(--sh-sm)'
      }}
    >
      {/* Left severity bar */}
      <div style={{
        position: 'absolute', left: 0, top: 16, bottom: 16,
        width: 3, borderRadius: '0 3px 3px 0',
        background: cfg.dot,
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Source icon */}
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'var(--inset)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--t3)',
        }}>
          {SOURCE_ICONS[signal.source_integration ?? ''] ?? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
            </svg>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '3px 9px',
              borderRadius: 'var(--r-pill)', textTransform: 'uppercase',
              fontFamily: "'DM Mono', monospace", letterSpacing: '.6px',
              background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
            }}>
              {cfg.label}
            </span>
            {signal.account_name && (
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>
                {signal.account_name}
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--t4)', marginLeft: 'auto', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
              {formatRelativeTime(signal.created_at)}
            </span>
          </div>

          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 5, lineHeight: 1.35 }}>
            {signal.title}
          </h3>

          {signal.ai_analysis?.summary && (
            <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.55, marginBottom: 8 }}>
              {signal.ai_analysis.summary}
            </p>
          )}

          {signal.ai_analysis?.quote && (
            <div style={{
              background: 'var(--inset)', borderLeft: '3px solid var(--border)',
              borderRadius: '0 var(--r-sm) var(--r-sm) 0',
              padding: '8px 12px', marginBottom: 10,
              fontSize: 12, color: 'var(--t3)', fontStyle: 'italic', lineHeight: 1.5,
            }}>
              "{signal.ai_analysis.quote}"
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {signal.source_integration && (
              <span style={{
                fontSize: 10, color: 'var(--t4)',
                fontFamily: "'DM Mono', monospace",
              }}>
                via {integrationLabel(signal.source_integration)}
              </span>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                onClick={handleSnooze}
                disabled={!!actioning}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--inset)', border: '1px solid var(--border)',
                  color: 'var(--t3)', cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                  transition: 'all .13s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--amber-bg)'
                  e.currentTarget.style.borderColor = 'var(--amber-bd)'
                  e.currentTarget.style.color = 'var(--amber)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--inset)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--t3)'
                }}
              >
                Snooze
              </button>
              <button
                onClick={handleDismiss}
                disabled={!!actioning}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--inset)', border: '1px solid var(--border)',
                  color: 'var(--t3)', cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                  transition: 'all .13s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--danger-bg)'
                  e.currentTarget.style.borderColor = 'var(--danger-bd)'
                  e.currentTarget.style.color = 'var(--danger)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--inset)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--t3)'
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
