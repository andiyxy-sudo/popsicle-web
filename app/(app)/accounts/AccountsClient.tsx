'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Account } from '@/types'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'

interface AccountsClientProps {
  initialAccounts: Account[]
  searchQuery: string
}

const RISK_CONFIG = {
  high: { label: 'At Risk', bg: 'var(--danger-bg)', color: 'var(--danger)', border: 'var(--danger-bd)' },
  medium: { label: 'Watch', bg: 'var(--amber-bg)', color: 'var(--amber)', border: 'var(--amber-bd)' },
  low: { label: 'Healthy', bg: 'var(--ok-bg)', color: 'var(--ok)', border: 'var(--ok-bd)' },
}

export function AccountsClient({ initialAccounts, searchQuery }: AccountsClientProps) {
  const [accounts] = useState<Account[]>(initialAccounts)
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [search, setSearch] = useState(searchQuery)
  const router = useRouter()

  const filtered = accounts.filter(a => {
    if (filter !== 'all' && a.risk_level !== filter) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (accounts.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '80px 24px', textAlign: 'center',
      }}>
        <div style={{ opacity: 0.2, marginBottom: 16 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t2)', marginBottom: 6 }}>
          No accounts yet
        </div>
        <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.6, maxWidth: 320 }}>
          Connect Gmail, Google Calendar, or Zoom to automatically discover accounts from your conversations.
        </div>
        <a href="/integrations" style={{
          marginTop: 20, padding: '10px 20px',
          background: 'var(--o)', color: '#fff',
          borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600,
          textDecoration: 'none',
        }}>
          Connect integrations
        </a>
      </div>
    )
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--inset)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)', padding: '8px 12px', flex: 1, maxWidth: 300,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter accounts..."
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, color: 'var(--t1)', flex: 1,
              fontFamily: "'Outfit', sans-serif",
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'high', 'medium', 'low'] as const).map(f => {
            const label = f === 'all' ? 'All' : f === 'high' ? 'At Risk' : f === 'medium' ? 'Watch' : 'Healthy'
            const active = filter === f
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 12px', borderRadius: 7, border: '1px solid',
                fontSize: 11, fontWeight: active ? 700 : 500,
                cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
                background: active
                  ? f === 'high' ? 'var(--danger-bg)'
                  : f === 'medium' ? 'var(--amber-bg)'
                  : f === 'low' ? 'var(--ok-bg)'
                  : 'var(--surface)'
                  : 'var(--inset)',
                color: active
                  ? f === 'high' ? 'var(--danger)'
                  : f === 'medium' ? 'var(--amber)'
                  : f === 'low' ? 'var(--ok)'
                  : 'var(--t1)'
                  : 'var(--t3)',
                borderColor: active
                  ? f === 'high' ? 'var(--danger-bd)'
                  : f === 'medium' ? 'var(--amber-bd)'
                  : f === 'low' ? 'var(--ok-bd)'
                  : 'var(--o-border)'
                  : 'var(--border)',
                transition: 'all .13s',
              }}>
                {label}
              </button>
            )
          })}
        </div>

        <span style={{ fontSize: 12, color: 'var(--t4)', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
          {filtered.length} of {accounts.length}
        </span>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--r)',
        boxShadow: 'var(--sh-sm)',
        overflow: 'hidden',
        border: '1px solid var(--border-soft)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {['Account', 'Stage', 'Value', 'Health', 'Risk', 'Last Contact'].map(h => (
                <th key={h} style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '1.5px',
                  textTransform: 'uppercase', color: 'var(--t4)',
                  padding: '11px 14px', textAlign: 'left',
                  borderBottom: '1px solid rgba(74,60,50,.08)',
                  background: 'var(--surface)', position: 'sticky', top: 0,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px 14px', color: 'var(--t4)', fontSize: 13 }}>
                  No accounts match your filter
                </td>
              </tr>
            ) : filtered.map((account, i) => {
              const risk = account.risk_level ? RISK_CONFIG[account.risk_level] : null
              const rowBg = account.risk_level === 'high' ? 'rgba(220,38,38,.025)'
                : account.risk_level === 'medium' ? 'rgba(217,119,6,.02)'
                : 'transparent'

              return (
                <tr
                  key={account.id}
                  onClick={() => router.push(`/account/${account.id}`)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => {
                    const cells = e.currentTarget.querySelectorAll('td')
                    cells.forEach(td => {
                      (td as HTMLElement).style.background = account.risk_level === 'high'
                        ? 'rgba(220,38,38,.055)'
                        : account.risk_level === 'medium'
                        ? 'rgba(217,119,6,.05)'
                        : 'var(--o-bg)'
                    })
                  }}
                  onMouseLeave={e => {
                    const cells = e.currentTarget.querySelectorAll('td')
                    cells.forEach(td => { (td as HTMLElement).style.background = rowBg })
                  }}
                >
                  <td style={{
                    padding: '13px 14px', fontSize: 13,
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(74,60,50,.06)' : 'none',
                    background: rowBg,
                    boxShadow: account.risk_level === 'high' ? 'inset 3px 0 0 var(--danger)'
                      : account.risk_level === 'medium' ? 'inset 3px 0 0 var(--amber)'
                      : account.risk_level === 'low' ? 'inset 3px 0 0 var(--ok)'
                      : 'none',
                    verticalAlign: 'middle',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--o-bg), var(--inset))',
                        border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: 'var(--o)',
                      }}>
                        {getInitials(account.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--t1)' }}>{account.name}</div>
                        {account.domain && (
                          <div style={{ fontSize: 11, color: 'var(--t4)', fontFamily: "'DM Mono', monospace" }}>
                            {account.domain}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 14px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(74,60,50,.06)' : 'none', background: rowBg, verticalAlign: 'middle' }}>
                    <span style={{ fontSize: 12, color: 'var(--t2)' }}>{account.stage ?? '--'}</span>
                  </td>
                  <td style={{ padding: '13px 14px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(74,60,50,.06)' : 'none', background: rowBg, verticalAlign: 'middle' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', fontFamily: "'DM Mono', monospace" }}>
                      {formatCurrency(account.value)}
                    </span>
                  </td>
                  <td style={{ padding: '13px 14px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(74,60,50,.06)' : 'none', background: rowBg, verticalAlign: 'middle' }}>
                    {account.health_score != null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: 'var(--inset)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            width: `${account.health_score}%`,
                            background: account.health_score >= 70 ? 'var(--ok)' : account.health_score >= 40 ? 'var(--amber)' : 'var(--danger)',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', fontFamily: "'DM Mono', monospace", width: 28 }}>
                          {account.health_score}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--t4)', fontSize: 12 }}>--</span>
                    )}
                  </td>
                  <td style={{ padding: '13px 14px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(74,60,50,.06)' : 'none', background: rowBg, verticalAlign: 'middle' }}>
                    {risk ? (
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '3px 9px',
                        borderRadius: 'var(--r-pill)', textTransform: 'uppercase',
                        fontFamily: "'DM Mono', monospace", letterSpacing: '.6px',
                        background: risk.bg, color: risk.color, border: `1px solid ${risk.border}`,
                      }}>
                        {risk.label}
                      </span>
                    ) : <span style={{ color: 'var(--t4)', fontSize: 12 }}>--</span>}
                  </td>
                  <td style={{ padding: '13px 14px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(74,60,50,.06)' : 'none', background: rowBg, verticalAlign: 'middle' }}>
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>
                      {formatDate(account.last_contact_date)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
