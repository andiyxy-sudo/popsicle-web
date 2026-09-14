'use client'

import { useState, useEffect } from 'react'

// Team — coverage by owner, computed from the accounts each person owns and
// the signals raised on them. Single-seat workspaces see their own coverage
// rather than an empty "invite your team" screen. Seats/invites are not built,
// so nothing here pretends they are.

import { useRouter } from 'next/navigation'
import type { Account, Signal } from '@/types'
import { PageHead } from '@/components/layout/PageHead'
import { formatCurrency } from '@/lib/utils'

export function TeamReal({ accounts, signals, me, integrations }: { accounts: Account[]; signals: Signal[]; me: string; integrations: string[] }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const router = useRouter()
  const open = signals.filter(s => !s.is_dismissed && (!s.status || s.status === 'open'))
  const handled = signals.filter(s => s.status === 'handled')

  const owners = new Map<string, { accounts: Account[]; open: Signal[]; handled: Signal[]; value: number; risk: number }>()
  for (const a of accounts) {
    const key = a.owner || me
    const o = owners.get(key) ?? { accounts: [], open: [], handled: [], value: 0, risk: 0 }
    o.accounts.push(a)
    o.value += Number(a.value) || 0
    owners.set(key, o)
  }
  for (const s of signals) {
    const a = accounts.find(x => x.name === s.account_name)
    const key = a?.owner || me
    const o = owners.get(key)
    if (!o) continue
    if (s.status === 'handled') o.handled.push(s)
    else if (!s.is_dismissed && (!s.status || s.status === 'open')) {
      o.open.push(s)
      if (s.severity === 'high') o.risk += Number(s.risk_amount) || 0
    }
  }
  const rows = Array.from(owners.entries()).sort((a, b) => b[1].value - a[1].value)
  const coverage = handled.length + open.length > 0 ? Math.round((handled.length / (handled.length + open.length)) * 100) : null

  const secHead = (title: string, right?: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 16, borderBottom: '1px solid var(--rule-strong, #0E0D0B)', marginTop: 64 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--ink)' }}>{title}</h2>
      {right}
    </div>
  )

  return (
    <div className="dsk-screen on">
      <PageHead
        eyebrow="Team"
        crumb={mounted ? `${rows.length} owner${rows.length === 1 ? '' : 's'} · ${accounts.length} accounts` : `${accounts.length} accounts`}
        title={rows.length > 1
          ? <>{rows.length} people carry {formatCurrency(rows.reduce((s, [, o]) => s + o.value, 0))}.{' '}<span style={{ color: 'var(--ink-muted)' }}>{open.length} signal{open.length === 1 ? '' : 's'} are open across the book.</span></>
          : <>You carry {formatCurrency(rows[0]?.[1].value ?? 0)} across {accounts.length} account{accounts.length === 1 ? '' : 's'}.{' '}<span style={{ color: 'var(--ink-muted)' }}>{open.length} signal{open.length === 1 ? '' : 's'} open{handled.length ? `, ${handled.length} handled so far` : ''}.</span></>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', paddingTop: 4 }}>
        {[
          { n: String(accounts.length), lbl: 'accounts covered', color: 'var(--ink)' },
          { n: String(open.length), lbl: 'signals open now', color: open.length ? 'var(--warn, #d38b1d)' : 'var(--ink)' },
          { n: String(handled.length), lbl: 'signals handled', color: 'var(--good, #2f8f5b)' },
          { n: coverage != null ? `${coverage}%` : '--', lbl: 'handled rate', color: 'var(--ink)' },
        ].map((st, i, arr) => (
          <div key={i} style={{ paddingRight: 32 }}>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.045em', fontSize: 40, lineHeight: 1, color: st.color, fontVariantNumeric: 'tabular-nums' }}>{st.n}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 8 }}>{st.lbl}</div>
          </div>
        ))}
      </div>

      {secHead('Coverage by owner')}
      <div style={{ display: 'grid', gridTemplateColumns: '36px minmax(120px,1.4fr) minmax(60px,.6fr) minmax(70px,.7fr) minmax(60px,.6fr) minmax(70px,.7fr)', columnGap: 12, padding: '14px 0 8px', fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
        <span /><span>Owner</span><span>Accounts</span><span>Book</span><span>Open</span><span>At risk</span>
      </div>
      {rows.map(([name, o]) => (
        <div key={name} style={{ display: 'grid', gridTemplateColumns: '36px minmax(120px,1.4fr) minmax(60px,.6fr) minmax(70px,.7fr) minmax(60px,.6fr) minmax(70px,.7fr)', columnGap: 12, alignItems: 'center', padding: '16px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', fontSize: 12.5 }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 11 }}>
            {name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
          </span>
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{name}{name === me && <span style={{ color: 'var(--ink-faint)', fontWeight: 400, marginLeft: 8 }}>you</span>}</span>
          <span style={{ color: 'var(--ink)' }}>{o.accounts.length}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{formatCurrency(o.value)}</span>
          <span style={{ color: o.open.length ? 'var(--warn, #d38b1d)' : 'var(--ink-faint)' }}>{o.open.length}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: o.risk ? 'var(--critical, #c43d2b)' : 'var(--ink-faint)' }}>{o.risk ? formatCurrency(o.risk) : '--'}</span>
        </div>
      ))}

      {secHead('Workspace', <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{integrations.length} sources live</span>)}
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', padding: '20px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
        {integrations.length === 0 && <span style={{ fontSize: 14, color: 'var(--ink-faint)' }}>No sources connected yet.</span>}
        {integrations.map(p => (
          <span key={p} style={{ fontSize: 13.5, color: 'var(--ink)', textTransform: 'capitalize' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good, #2f8f5b)', display: 'inline-block', marginRight: 8 }} />{p}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, maxWidth: 620, marginTop: 20 }}>
        Seats and invitations are not enabled on this workspace yet. Owners shown above come from the accounts themselves.{' '}
        <span onClick={() => router.push('/integrations')} style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}>Manage sources →</span>
      </div>
    </div>
  )
}
