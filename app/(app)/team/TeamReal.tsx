'use client'

// Team intelligence, built to the design: a narrative headline, coverage
// figures, the saves leaderboard, per-rep breakdowns with response trend and
// activity, the unactioned queue, and the execution summary. Every number is
// computed from the accounts each person owns and the signals raised on them.

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Account, Signal } from '@/types'
import { formatCurrency } from '@/lib/utils'

const MONO = { fontFamily: "'DM Mono',monospace", letterSpacing: '1.5px', textTransform: 'uppercase' as const }
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase()
const hue = (n: string) => ['#E85A25', '#2f6f9f', '#7C5CFC', '#2f8f5b', '#d38b1d'][n.length % 5]

export function TeamReal({ accounts, signals, me }: { accounts: Account[]; signals: Signal[]; me: string; integrations?: string[] }) {
  const [mounted, setMounted] = useState(false)
  const [queueRep, setQueueRep] = useState<string>('All')
  useEffect(() => { setMounted(true) }, [])
  const router = useRouter()

  const live = signals.filter(s => !s.is_dismissed && s.status !== 'deleted')
  const open = live.filter(s => !s.status || s.status === 'open')
  const handled = live.filter(s => s.status === 'handled')

  // ---------- coverage by owner ----------
  type Rep = { name: string; accounts: Account[]; open: Signal[]; handled: Signal[]; value: number; risk: number; protectedValue: number }
  const byRep = new Map<string, Rep>()
  const repOf = (a: Account) => a.owner || me
  for (const a of accounts) {
    const k = repOf(a)
    const r = byRep.get(k) ?? { name: k, accounts: [], open: [], handled: [], value: 0, risk: 0, protectedValue: 0 }
    r.accounts.push(a)
    r.value += Number(a.value) || 0
    byRep.set(k, r)
  }
  const ownerFor = (accountName?: string | null) => {
    const a = accounts.find(x => x.name === accountName)
    return a ? repOf(a) : me
  }
  for (const s of live) {
    const r = byRep.get(ownerFor(s.account_name))
    if (!r) continue
    if (s.status === 'handled') { r.handled.push(s); r.protectedValue += Number(s.risk_amount) || 0 }
    else if (!s.status || s.status === 'open') { r.open.push(s); r.risk += Number(s.risk_amount) || 0 }
  }
  const reps = Array.from(byRep.values()).sort((a, b) => b.protectedValue - a.protectedValue || b.value - a.value)

  // ---------- headline figures ----------
  const totalValue = accounts.reduce((a, x) => a + (Number(x.value) || 0), 0)
  const protectedTotal = handled.reduce((a, s) => a + (Number(s.risk_amount) || 0), 0)
  const waitingValue = open.reduce((a, s) => a + (Number(s.risk_amount) || 0), 0)
  const criticalAccounts = Array.from(new Set(open.filter(s => s.severity === 'high').map(s => s.account_name).filter(Boolean))) as string[]
  const coveredAccounts = accounts.filter(a => live.some(s => s.account_name === a.name)).length
  const coverage = accounts.length ? Math.round((coveredAccounts / accounts.length) * 100) : 0
  const actionRate = live.length ? Math.round((handled.length / live.length) * 100) : 0

  // median hours a signal waits before being handled
  const timeToAction = (() => {
    const hrs = handled
      .map(s => { const h = (s as unknown as { handled_at?: string }).handled_at; return s.created_at && h ? (new Date(h).getTime() - new Date(s.created_at).getTime()) / 3600000 : null })
      .filter((x): x is number => typeof x === 'number' && x >= 0)
      .sort((a, b) => a - b)
    if (!hrs.length) return null
    return hrs[Math.floor(hrs.length / 2)]
  })()
  const repResponse = (r: Rep) => {
    const hrs = r.handled
      .map(s => { const h = (s as unknown as { handled_at?: string }).handled_at; return s.created_at && h ? (new Date(h).getTime() - new Date(s.created_at).getTime()) / 3600000 : null })
      .filter((x): x is number => typeof x === 'number' && x >= 0)
      .sort((a, b) => a - b)
    return hrs.length ? hrs[Math.floor(hrs.length / 2)] : null
  }

  const sevSplit = [
    { k: 'Critical', color: 'var(--critical, #c43d2b)', sigs: open.filter(s => s.severity === 'high') },
    { k: 'Watching', color: 'var(--warn, #d38b1d)', sigs: open.filter(s => s.severity === 'watch') },
    { k: 'Healthy', color: 'var(--good, #2f8f5b)', sigs: open.filter(s => s.severity === 'positive') },
  ].map(x => ({
    ...x,
    value: x.sigs.reduce((a, s) => a + (Number(s.risk_amount) || 0), 0),
    accts: new Set(x.sigs.map(s => s.account_name).filter(Boolean)).size,
  }))

  const bullets = [
    criticalAccounts.length ? { tone: 'var(--critical, #c43d2b)', lead: `${criticalAccounts.length} critical account${criticalAccounts.length === 1 ? '' : 's'}`, rest: `: ${criticalAccounts.slice(0, 3).join(', ')}.` } : null,
    reps[0] ? { tone: 'var(--good, #2f8f5b)', lead: `${reps[0].name} leads on saves`, rest: `, ${formatCurrency(reps[0].protectedValue)} protected across ${reps[0].accounts.length} account${reps[0].accounts.length === 1 ? '' : 's'}.` } : null,
    timeToAction != null ? { tone: 'var(--warn, #d38b1d)', lead: `${timeToAction.toFixed(1)}h median response`, rest: ' from signal raised to handled.' } : null,
    { tone: 'var(--ink)', lead: 'Coverage', rest: `: ${coveredAccounts} of ${accounts.length} accounts have live signal.` },
  ].filter(Boolean) as Array<{ tone: string; lead: string; rest: string }>

  // ---------- unactioned queue ----------
  const queue = open
    .filter(s => queueRep === 'All' || ownerFor(s.account_name) === queueRep)
    .sort((a, b) => (Number(b.risk_amount) || 0) - (Number(a.risk_amount) || 0))
    .slice(0, 8)
  const ageOf = (iso?: string | null) => {
    if (!iso || !mounted) return ''
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
    return h < 24 ? `${Math.max(1, h)}h` : `${Math.floor(h / 24)}d`
  }

  const sec = (title: string, right?: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 12, borderBottom: '1px solid var(--rule-strong, #0E0D0B)', marginTop: 52 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--ink)' }}>{title}</h2>
      {right}
    </div>
  )

  return (
    <div className="dsk-screen on">
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, minHeight: 36, flexWrap: 'wrap' }}>
        <div style={{ ...MONO, fontSize: 11, color: 'var(--ink-faint)' }}>
          Team intelligence <span style={{ margin: '0 8px' }}>/</span> {reps.length} owner{reps.length === 1 ? '' : 's'}
        </div>
        <div style={{ ...MONO, fontSize: 10.5, color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          action rate {actionRate}% <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good, #2f8f5b)' }} />
        </div>
      </div>

      {/* narrative */}
      <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(26px,3vw,36px)', letterSpacing: '-.035em', lineHeight: 1.2, margin: '18px 0 0', color: 'var(--ink)' }}>
        The team protected <span style={{ color: 'var(--accent)' }}>{formatCurrency(protectedTotal)}</span>
        {reps.length > 1 ? <> across {reps.length} reps.</> : ' this quarter.'}{' '}
        <span style={{ color: 'var(--ink-muted)' }}>
          {open.length > 0 ? <>{open.length} signal{open.length === 1 ? '' : 's'} worth <span style={{ color: 'var(--critical, #c43d2b)' }}>{formatCurrency(waitingValue)}</span> are still waiting for a response.</> : <>Nothing is waiting for a response.</>}
        </span>
      </h1>

      {bullets.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(205px,1fr))', gap: 26, marginTop: 24 }}>
          {bullets.map((b, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '10px 1fr', gap: 10, fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-muted)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.tone, marginTop: 7 }} />
              <div><strong style={{ fontWeight: 600, color: 'var(--ink)' }}>{b.lead}</strong>{b.rest}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '32px 0 26px' }} />

      {/* three coverage figures, each with its own breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 48 }}>
        <div>
          <div style={{ ...MONO, fontSize: 10, color: 'var(--ink-faint)' }}>ARR under management</div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.6vw,44px)', letterSpacing: '-.05em', lineHeight: 1, marginTop: 9, color: 'var(--critical, #c43d2b)' }}>
            {formatCurrency(totalValue)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 7 }}>across {accounts.length} account{accounts.length === 1 ? '' : 's'}</div>
          <div style={{ marginTop: 16 }}>
            {sevSplit.map(x => (
              <div key={x.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', fontSize: 13.5 }}>
                <span style={{ color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: x.color }} />{x.k}
                </span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: x.color }}>
                  {x.value > 0 ? formatCurrency(x.value) : '--'} · {x.accts} acct{x.accts === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ ...MONO, fontSize: 10, color: 'var(--ink-faint)' }}>Time to action</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 9 }}>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.6vw,44px)', letterSpacing: '-.05em', lineHeight: 1, color: 'var(--ink)' }}>
              {timeToAction != null ? timeToAction.toFixed(1) : '--'}
            </span>
            <span style={{ fontSize: 16, color: 'var(--ink-muted)' }}>h</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 7 }}>median, signal raised to handled</div>
          <div style={{ marginTop: 16 }}>
            {reps.map(r => {
              const t = repResponse(r)
              return (
                <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--ink)' }}>{r.name}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: t != null && timeToAction != null && t <= timeToAction ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)' }}>
                    {t != null ? `${t.toFixed(1)}h` : '--'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <div style={{ ...MONO, fontSize: 10, color: 'var(--ink-faint)' }}>Signal coverage</div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.6vw,44px)', letterSpacing: '-.05em', lineHeight: 1, marginTop: 9, color: 'var(--good, #2f8f5b)' }}>
            {coverage}%
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 7 }}>{coveredAccounts} of {accounts.length} accounts covered</div>
          <div style={{ marginTop: 16 }}>
            {[
              { k: 'Signals this period', v: String(live.length), c: 'var(--ink)' },
              { k: 'Actioned', v: `${handled.length} / ${live.length}`, c: 'var(--good, #2f8f5b)' },
              { k: 'Still open', v: String(open.length), c: open.length ? 'var(--critical, #c43d2b)' : 'var(--ink)' },
            ].map(x => (
              <div key={x.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', fontSize: 13.5 }}>
                <span style={{ color: 'var(--ink)' }}>{x.k}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: x.c }}>{x.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* leaderboard */}
      {sec('Popsicle saves leaderboard', <span style={{ ...MONO, fontSize: 10, color: 'var(--ink-faint)' }}>team total {formatCurrency(protectedTotal)}</span>)}
      <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(120px,1.5fr) minmax(56px,.5fr) minmax(56px,.5fr) minmax(70px,.7fr) minmax(56px,.5fr) minmax(60px,.6fr)', columnGap: 12, padding: '14px 0 8px', ...MONO, fontSize: 9.5, color: 'var(--ink-faint)' }}>
        <span>#</span><span>Rep</span><span>Signals</span><span>Saved</span><span>Protected</span><span>Resp</span><span>Save rate</span>
      </div>
      {reps.map((r, i) => {
        const rate = r.open.length + r.handled.length > 0 ? Math.round((r.handled.length / (r.open.length + r.handled.length)) * 100) : 0
        const t = repResponse(r)
        return (
          <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '28px minmax(120px,1.5fr) minmax(56px,.5fr) minmax(56px,.5fr) minmax(70px,.7fr) minmax(56px,.5fr) minmax(60px,.6fr)', columnGap: 12, alignItems: 'center', padding: '15px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', fontSize: 13.5 }}>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 17, color: i === 0 ? 'var(--accent)' : 'var(--ink-faint)' }}>{i + 1}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', background: hue(r.name), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 700, flex: 'none' }}>{initials(r.name)}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-faint)' }}>{r.accounts.length} account{r.accounts.length === 1 ? '' : 's'}</span>
              </span>
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.open.length + r.handled.length}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--good, #2f8f5b)' }}>{r.handled.length}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.protectedValue > 0 ? formatCurrency(r.protectedValue) : '--'}</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--ink-muted)' }}>{t != null ? `${t.toFixed(1)}h` : '--'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ flex: 1, height: 3, background: 'var(--hairline, #EFEAE1)', position: 'relative', minWidth: 24 }}>
                <span style={{ position: 'absolute', inset: 0, width: `${rate}%`, background: rate >= 70 ? 'var(--good, #2f8f5b)' : 'var(--accent)' }} />
              </span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{rate}%</span>
            </span>
          </div>
        )
      })}

      {/* individual breakdown */}
      {sec('Individual breakdown', <span style={{ ...MONO, fontSize: 10, color: 'var(--ink-faint)' }}>accounts owned</span>)}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 40, marginTop: 24 }}>
        {reps.map(r => {
          const t = repResponse(r)
          const trend = r.accounts.slice(0, 7).map(a => Number(a.health_score) || 50)
          const pts = trend.length > 1 ? trend : [50, 50]
          const maxT = Math.max(...pts, 1)
          const d = pts.map((v, i) => `${(i / (pts.length - 1)) * 100},${34 - (v / maxT) * 28}`).join(' L')
          const good = t != null && timeToAction != null && t <= timeToAction
          return (
            <div key={r.name}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ width: 32, height: 32, borderRadius: '50%', background: hue(r.name), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700, flex: 'none' }}>{initials(r.name)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{r.accounts.length} account{r.accounts.length === 1 ? '' : 's'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: '-.04em', color: 'var(--good, #2f8f5b)' }}>{r.protectedValue > 0 ? formatCurrency(r.protectedValue) : '--'}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>protected</div>
                </div>
              </div>

              <div style={{ ...MONO, fontSize: 9.5, color: 'var(--ink-faint)', marginTop: 18, display: 'flex', justifyContent: 'space-between' }}>
                <span>account health</span>
                <span style={{ color: good ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)' }}>{good ? 'responsive' : 'needs coaching'}</span>
              </div>
              <svg viewBox="0 0 100 36" width="100%" height={40} preserveAspectRatio="none" style={{ marginTop: 8, display: 'block' }}>
                <path d={`M${d}`} fill="none" stroke={good ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)'} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
              </svg>

              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14 }}>
                {r.accounts.slice(0, 5).map(a => (
                  <span key={a.id} onClick={() => router.push(`/accounts/${encodeURIComponent(a.name)}`)}
                    style={{ fontSize: 11.5, color: 'var(--ink-muted)', background: 'var(--inset, #F0EDE7)', borderRadius: 999, padding: '4px 11px', cursor: 'pointer' }}>{a.name}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* unactioned queue */}
      {sec('Unactioned signal queue', <span style={{ ...MONO, fontSize: 10, color: 'var(--critical, #c43d2b)' }}>{formatCurrency(waitingValue)} waiting</span>)}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 4px' }}>
        {['All', ...reps.map(r => r.name)].map(k => (
          <button key={k} onClick={() => setQueueRep(k)}
            style={{ font: 'inherit', fontSize: 12.5, fontWeight: queueRep === k ? 600 : 500, padding: '6px 14px', borderRadius: 999, border: 0, cursor: 'pointer',
              background: queueRep === k ? 'var(--ink, #0E0D0B)' : 'var(--inset, #F0EDE7)', color: queueRep === k ? '#fff' : 'var(--ink-muted)' }}>
            {k === 'All' ? `All · ${open.length}` : `${k.split(' ')[0]} · ${byRep.get(k)?.open.length ?? 0}`}
          </button>
        ))}
      </div>
      {queue.length === 0 && <div style={{ padding: '22px 0', fontSize: 14, color: 'var(--ink-faint)' }}>Nothing is waiting. Everything raised has been handled.</div>}
      {queue.map(s => {
        const c = s.severity === 'high' ? 'var(--critical, #c43d2b)' : s.severity === 'positive' ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)'
        const owner = ownerFor(s.account_name)
        return (
          <div key={s.id} onClick={() => router.push(`/signals?signal=${s.id}`)}
            style={{ display: 'grid', gridTemplateColumns: '3px minmax(0,1fr) auto auto', gap: 16, alignItems: 'center', padding: '15px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer' }}>
            <span style={{ width: 3, alignSelf: 'stretch', background: c }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{s.account_name}</span>
                <span style={{ ...MONO, fontSize: 9.5, color: c }}>{s.severity === 'high' ? 'critical' : s.severity === 'positive' ? 'positive' : 'watch'}</span>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 3 }}>{s.title}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12.5, color: c }}>{ageOf(s.created_at)}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>unactioned</div>
            </div>
            <span title={owner} style={{ width: 26, height: 26, borderRadius: '50%', background: hue(owner), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 }}>{initials(owner)}</span>
          </div>
        )
      })}
      <div onClick={() => router.push(`/ask?q=${encodeURIComponent('Which unactioned signals should the team prioritise?')}`)}
        style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)', marginTop: 16, cursor: 'pointer' }}>Ask AI to prioritise →</div>

      {/* execution summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 48, marginTop: 52 }}>
        <div>
          <div style={{ ...MONO, fontSize: 10, color: 'var(--ink-faint)', paddingBottom: 10, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>Revenue movement</div>
          {[
            { k: 'New critical accounts', v: `+${criticalAccounts.length}`, c: criticalAccounts.length ? 'var(--critical, #c43d2b)' : 'var(--ink)' },
            { k: 'Accounts stabilized', v: `+${new Set(handled.map(s => s.account_name)).size}`, c: 'var(--good, #2f8f5b)' },
            { k: 'Actions taken', v: String(handled.length), c: 'var(--ink)' },
            { k: 'Open exposure', v: formatCurrency(waitingValue), c: 'var(--critical, #c43d2b)' },
          ].map(r => (
            <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '13px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', fontSize: 14 }}>
              <span style={{ color: 'var(--ink)' }}>{r.k}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12.5, color: r.c }}>{r.v}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ ...MONO, fontSize: 10, color: 'var(--ink-faint)', paddingBottom: 10, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>Coverage & ownership</div>
          {reps.map(r => (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: hue(r.name), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 9.5, fontWeight: 700, flex: 'none' }}>{initials(r.name)}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--ink)' }}>{r.name}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                {r.accounts.length} · {formatCurrency(r.value)}
              </span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ ...MONO, fontSize: 10, color: 'var(--ink-faint)', paddingBottom: 10, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>Execution quality</div>
          <div style={{ display: 'flex', gap: 30, marginTop: 16 }}>
            <div>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: '-.04em', color: 'var(--ink)' }}>{timeToAction != null ? `${timeToAction.toFixed(1)}h` : '--'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4 }}>time to action</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: '-.04em', color: actionRate >= 70 ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)' }}>{actionRate}%</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4 }}>follow-through</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: '-.04em', color: 'var(--ink)' }}>{coverage}%</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4 }}>coverage</div>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            {reps.map(r => {
              const rate = r.open.length + r.handled.length > 0 ? Math.round((r.handled.length / (r.open.length + r.handled.length)) * 100) : 0
              const t = repResponse(r)
              return (
                <div key={r.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 48px 44px', gap: 10, padding: '10px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--ink-muted)', textAlign: 'right' }}>{t != null ? `${t.toFixed(1)}h` : '--'}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: rate >= 70 ? 'var(--good, #2f8f5b)' : 'var(--warn, #d38b1d)', textAlign: 'right' }}>{rate}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
