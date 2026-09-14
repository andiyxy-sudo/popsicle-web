'use client'

// Forecast — real close dates, real values, real risk. Weighted by stage
// (a published ladder, not a hidden model) and discounted by open high-severity
// signals on that account, so the "at risk" figure traces to actual evidence.
// No close date, no row: absence over invention.

import { useRouter } from 'next/navigation'
import type { Account, Signal } from '@/types'
import { PageHead } from '@/components/layout/PageHead'
import { formatCurrency } from '@/lib/utils'

const STAGE_WEIGHT: Array<[RegExp, number]> = [
  [/closed won|expansion/i, 1],
  [/contract|signature|paperwork/i, .9],
  [/negotiat/i, .75],
  [/decision maker|bought.?in/i, .6],
  [/proposal|quote/i, .45],
  [/evaluat|technical|poc|pilot/i, .3],
  [/discovery|qualif/i, .15],
]
const weightOf = (stage?: string | null) => {
  for (const [re, w] of STAGE_WEIGHT) if (stage && re.test(stage)) return w
  return .2
}
const monthKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (k: string) => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }

export function ForecastReal({ accounts, signals }: { accounts: Account[]; signals: Signal[] }) {
  const router = useRouter()
  const open = signals.filter(s => !s.is_dismissed && (!s.status || s.status === 'open'))
  const highBy = new Map<string, number>()
  for (const s of open) if (s.account_name && s.severity === 'high') highBy.set(s.account_name, (highBy.get(s.account_name) ?? 0) + 1)

  const dated = accounts.filter(a => a.close_date && a.value)
  const rows = dated.map(a => {
    const w = weightOf(a.stage)
    const risky = (highBy.get(a.name) ?? 0) > 0
    const value = Number(a.value) || 0
    return { a, value, weighted: value * w * (risky ? .6 : 1), w, risky, month: monthKey(a.close_date!) }
  }).sort((x, y) => String(x.a.close_date).localeCompare(String(y.a.close_date)))

  const total = rows.reduce((s, r) => s + r.value, 0)
  const weighted = rows.reduce((s, r) => s + r.weighted, 0)
  const atRisk = rows.filter(r => r.risky).reduce((s, r) => s + r.value, 0)
  const commit = rows.filter(r => r.w >= .75 && !r.risky).reduce((s, r) => s + r.value, 0)

  const byMonth = new Map<string, { value: number; weighted: number; n: number }>()
  for (const r of rows) {
    const m = byMonth.get(r.month) ?? { value: 0, weighted: 0, n: 0 }
    m.value += r.value; m.weighted += r.weighted; m.n++
    byMonth.set(r.month, m)
  }
  const months = Array.from(byMonth.entries()).sort()
  const maxMonth = Math.max(1, ...months.map(([, m]) => m.value))

  const secHead = (title: string, right?: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 16, borderBottom: '1px solid var(--rule-strong, #0E0D0B)', marginTop: 64 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--ink)' }}>{title}</h2>
      {right}
    </div>
  )

  if (rows.length === 0) {
    return (
      <div className="dsk-screen on">
        <PageHead eyebrow="Forecast" crumb="no close dates yet"
          title={<>Nothing to forecast yet.{' '}<span style={{ color: 'var(--ink-muted)' }}>Accounts need a close date and a value before they can be projected.</span></>} />
        <div style={{ fontSize: 15, color: 'var(--ink-muted)', lineHeight: 1.6, maxWidth: 620 }}>
          Connect HubSpot, or set close dates on your accounts, and this screen fills in with weighted pipeline by month.
        </div>
      </div>
    )
  }

  return (
    <div className="dsk-screen on">
      <PageHead
        eyebrow="Forecast"
        crumb={`${rows.length} dated deals`}
        title={<><span style={{ color: 'var(--accent)' }}>{formatCurrency(weighted)}</span> weighted against {formatCurrency(total)} of dated pipeline.{' '}
          <span style={{ color: 'var(--ink-muted)' }}>{atRisk > 0 ? <><span style={{ color: 'var(--critical, #c43d2b)' }}>{formatCurrency(atRisk)}</span> of it carries an open risk signal.</> : <>Nothing dated is flagged at risk.</>}</span></>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', paddingTop: 4 }}>
        {[
          { n: formatCurrency(commit), lbl: 'commit · late stage, unflagged', color: 'var(--good, #2f8f5b)' },
          { n: formatCurrency(weighted), lbl: 'weighted · stage-adjusted', color: 'var(--ink)' },
          { n: formatCurrency(atRisk), lbl: 'at risk · has high signal', color: 'var(--critical, #c43d2b)' },
          { n: String(rows.length), lbl: 'deals with a close date', color: 'var(--ink)' },
        ].map((st, i, arr) => (
          <div key={i} style={{ paddingRight: 24, paddingLeft: i === 0 ? 0 : 24, borderRight: i < arr.length - 1 ? '1px solid var(--hairline, #EFEAE1)' : 'none' }}>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.045em', fontSize: 40, lineHeight: 1, color: st.color, fontVariantNumeric: 'tabular-nums' }}>{st.n}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 8 }}>{st.lbl}</div>
          </div>
        ))}
      </div>

      {secHead('By close month')}
      {months.map(([k, m]) => (
        <div key={k} style={{ padding: '20px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{monthLabel(k)}</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{m.n} deal{m.n === 1 ? '' : 's'}</span>
            <span style={{ marginLeft: 'auto', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-.03em', color: 'var(--ink)' }}>{formatCurrency(m.value)}</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--accent)' }}>{formatCurrency(m.weighted)} wtd</span>
          </div>
          <div style={{ height: 4, background: 'var(--hairline, #EFEAE1)', marginTop: 12, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${(m.value / maxMonth) * 100}%`, background: 'var(--ink)' }} />
            <div style={{ position: 'absolute', top: 0, bottom: 0, width: `${(m.weighted / maxMonth) * 100}%`, background: 'var(--accent)' }} />
          </div>
        </div>
      ))}

      {secHead('Every dated deal', <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>by close date</span>)}
      <div style={{ display: 'grid', gridTemplateColumns: '96px minmax(120px,1.6fr) minmax(70px,.7fr) minmax(90px,.9fr) minmax(60px,.5fr) 96px', columnGap: 10, padding: '14px 0 8px', fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
        <span>Close</span><span>Account</span><span>Value</span><span>Stage</span><span>Odds</span><span>Weighted</span>
      </div>
      {rows.map(r => (
        <div key={r.a.id} onClick={() => router.push(`/accounts?open=${encodeURIComponent(r.a.name)}`)}
          style={{ display: 'grid', gridTemplateColumns: '96px minmax(120px,1.6fr) minmax(70px,.7fr) minmax(90px,.9fr) minmax(60px,.5fr) 96px', columnGap: 10, alignItems: 'center', padding: '15px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer', fontSize: 12.5 }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: r.risky ? 'var(--critical, #c43d2b)' : 'var(--ink-muted)' }}>{new Date(r.a.close_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--ink)' }}>
            {r.a.name}{r.risky && <span style={{ color: 'var(--critical, #c43d2b)', marginLeft: 8, fontSize: 11.5, fontWeight: 500 }}>at risk</span>}
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{formatCurrency(r.value)}</span>
          <span style={{ color: 'var(--ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.a.stage || '--'}</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{Math.round(r.w * 100)}%</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--accent)' }}>{formatCurrency(r.weighted)}</span>
        </div>
      ))}

      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-faint)', marginTop: 22 }}>
        weighting: closed 100 · contract 90 · negotiation 75 · bought-in 60 · proposal 45 · evaluation 30 · discovery 15 · open high signal −40%
      </div>
    </div>
  )
}
