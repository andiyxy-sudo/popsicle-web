'use client'

import { useState, useCallback } from 'react'
import { Signal } from '@/types'
import { SignalCard } from '@/components/signals/SignalCard'
import { createClient } from '@/lib/supabase/client'

interface DashboardClientProps {
  initialSignals: Signal[]
  userId: string
}

const FILTERS = ['All', 'At Risk', 'Watch', 'Positive'] as const

export function DashboardClient({ initialSignals, userId }: DashboardClientProps) {
  const [signals, setSignals] = useState<Signal[]>(initialSignals)
  const [activeFilter, setActiveFilter] = useState<typeof FILTERS[number]>('All')
  const [refreshing, setRefreshing] = useState(false)
  const supabase = createClient()

  const refreshSignals = useCallback(async () => {
    setRefreshing(true)
    const { data } = await supabase
      .from('signals')
      .select('*')
      .eq('user_id', userId)
      .eq('is_dismissed', false)
      .eq('is_snoozed', false)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setSignals(data as Signal[])
    setRefreshing(false)
  }, [supabase, userId])

  const filtered = signals.filter(s => {
    if (activeFilter === 'All') return true
    if (activeFilter === 'At Risk') return s.severity === 'high'
    if (activeFilter === 'Watch') return s.severity === 'watch'
    if (activeFilter === 'Positive') return s.severity === 'positive'
    return true
  })

  return (
    <div>
      {/* Filter tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div style={{
          display: 'flex', gap: 4,
          background: 'var(--inset)', borderRadius: 'var(--r-sm)',
          padding: 4, border: '1px solid var(--border)',
        }}>
          {FILTERS.map(f => {
            const count = f === 'All' ? signals.length
              : f === 'At Risk' ? signals.filter(s => s.severity === 'high').length
              : f === 'Watch' ? signals.filter(s => s.severity === 'watch').length
              : signals.filter(s => s.severity === 'positive').length
            const active = activeFilter === f
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                style={{
                  padding: '6px 14px', borderRadius: 7, border: 'none',
                  fontSize: 12, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
                  background: active ? 'var(--surface)' : 'transparent',
                  color: active ? 'var(--t1)' : 'var(--t3)',
                  boxShadow: active ? 'var(--sh-sm)' : 'none',
                  transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {f}
                {count > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 800,
                    background: active
                      ? f === 'At Risk' ? 'var(--danger)' : f === 'Watch' ? 'var(--amber)' : f === 'Positive' ? 'var(--ok)' : 'var(--o)'
                      : 'var(--border)',
                    color: active ? '#fff' : 'var(--t3)',
                    borderRadius: 9, padding: '1px 6px',
                    fontFamily: "'DM Mono', monospace",
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button
          onClick={refreshSignals}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 'var(--r-sm)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            fontSize: 12, fontWeight: 600, color: 'var(--t2)',
            cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
            boxShadow: 'var(--sh-sm)', transition: 'all .15s',
          }}
        >
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
          >
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '64px 24px', textAlign: 'center',
        }}>
          <div style={{ opacity: 0.2, marginBottom: 16 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="1.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t2)', marginBottom: 6 }}>
            No signals
          </div>
          <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.6, maxWidth: 280 }}>
            {signals.length === 0
              ? 'Connect your first integration to start receiving revenue signals.'
              : `No ${activeFilter.toLowerCase()} signals right now.`}
          </div>
          {signals.length === 0 && (
            <a href="/integrations" style={{
              marginTop: 16, padding: '9px 18px',
              background: 'var(--o)', color: '#fff',
              borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600,
              textDecoration: 'none',
            }}>
              Connect integrations
            </a>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(signal => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onUpdate={refreshSignals}
            />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
