'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { attentionScore } from '@/lib/attention'
import { healthTone, formatWhen } from '@/lib/utils'
import { X } from '@/components/explain/Explain'
import { EmptyState } from '@/components/ui/EmptyState'
import { RiskFlagSheet, buildFlag, type RiskFlag } from '@/components/account/RiskFlagSheet'

import { buildA360 } from '@/lib/demo-accounts'
import { orgIdsBrowser } from '@/lib/org'
import { AskThis } from '@/components/agent/AskThis'

interface Account {
  id: string; name: string; domain?: string; health_score: number; value?: number
  stage?: string; owner?: string; risk_level?: string; probability?: number
  close_date?: string; last_contact_date?: string; tags?: string[]
}

function fmtVal(v?: number) {
  if (!v) return '--'
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${Math.round(v / 1000)}K`
  return `$${v}`
}
function riskClass(r?: string) {
  const x = (r || '').toLowerCase()
  if (x === 'high') return 'rhi'
  if (x === 'medium' || x === 'med') return 'rmd'
  return 'rlo'
}

type SigLite = { id: string; corroboration?: unknown; account_name: string | null; title: string | null; severity: string | null; status: string | null; is_dismissed: boolean | null; created_at: string | null }

// Demo-parity derivations, honest fallbacks: real values win; when absent we
// derive from live signals rather than showing blanks or inventing numbers.
function healthOf(a: Account, sigs: SigLite[]): number {
  if (a.health_score != null && a.health_score > 0) return a.health_score
  const nH = sigs.filter(x => x.severity === 'high').length
  const nW = sigs.filter(x => x.severity === 'watch').length
  const nP = sigs.filter(x => x.severity === 'positive').length
  return Math.max(25, Math.min(95, 90 - nH * 18 - nW * 6 + nP * 4))
}
function riskOf(a: Account, sigs: SigLite[]): string {
  if (a.risk_level) return a.risk_level
  if (sigs.some(x => x.severity === 'high')) return 'high'
  if (sigs.some(x => x.severity === 'watch')) return 'medium'
  return 'low'
}
function tagsOf(a: Account, sigs: SigLite[]): Array<[string, string]> {
  if (a.tags && a.tags.length) return a.tags.slice(0, 3).map(t => [t, 'blue'])
  const out: Array<[string, string]> = []
  if ((a.value ?? 0) >= 1_000_000) out.push(['Enterprise', 'blue'])
  if (sigs.some(x => x.severity === 'high')) out.push(['At risk', 'red'])
  else if (sigs.some(x => x.severity === 'positive')) out.push(['Momentum', 'green'])
  if (a.stage && /decision|contract|bought|negoti/i.test(a.stage)) out.push(['Late stage', 'amber'])
  return out.slice(0, 3)
}
function topSignalOf(sigs: SigLite[]): SigLite | null {
  const rank = (sv: string | null) => sv === 'high' ? 0 : sv === 'watch' ? 1 : 2
  return [...sigs].sort((x, y) => rank(x.severity) - rank(y.severity) || String(y.created_at).localeCompare(String(x.created_at)))[0] ?? null
}
type HeadStat = { n: string; lbl: string; tone: 'critical' | 'warn' | 'good' | 'ink'; strong?: boolean; m?: string; color?: string }
type DemoHeadline = { highCount: number; highValue: number; darkHours: number; closingName: string; healthyCount: number }
const TONE = { critical: 'var(--critical, #c43d2b)', warn: 'var(--warn, #d38b1d)', good: 'var(--good, #2f8f5b)', ink: 'var(--ink, #0E0D0B)' } as const
const NUMWORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
const numWord = (n: number) => (n >= 0 && n <= 10 ? NUMWORD[n] : String(n))

const agoDays = (iso?: string | null): string => (iso ? formatWhen(iso) : '--')

export type AccountMeta = Record<string, { role?: string; rep?: string; trend?: string }>
export function PortfolioReal({ accounts, demoSignals, demoHead, meta = {} }: { accounts: Account[]; demoSignals?: unknown[]; demoHead?: { headline: DemoHeadline; stats: HeadStat[] }; meta?: AccountMeta }) {
  const [mounted, setMounted] = useState(false)
  const [statHover, setStatHover] = useState<number | null>(null)   // strong underline follows the pointer
  const [view, setView] = useState<'all' | 'high' | 'closing' | 'stalled'>('all')
  useEffect(() => { setMounted(true) }, [])
  const [sigMap, setSigMap] = useState<Map<string, SigLite[]>>(new Map())
  const [soon48, setSoon48] = useState<Set<string>>(new Set())
  const [flag, setFlag] = useState<RiskFlag | null>(null)
  useEffect(() => {
    let dead = false
    if (demoSignals) {
      // demo: no database round-trips
      const m = new Map<string, SigLite[]>()
      for (const raw of demoSignals) {
        const sg = raw as unknown as SigLite
        if (!sg.account_name || (sg.status && sg.status !== 'open') ) continue
        const arr = m.get(sg.account_name) ?? []
        arr.push(sg); m.set(sg.account_name, arr)
      }
      setSigMap(m)
      return () => { dead = true }
    }
    const supa = createClient()
    supa.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      if (demoSignals) return
      supa.from('gcal_event_state').select('account_name').in('user_id', await orgIdsBrowser(supa, user.id)).not('account_name', 'is', null)
        .gte('start_ts', new Date().toISOString()).lte('start_ts', new Date(Date.now() + 48 * 3600_000).toISOString()).limit(50)
        .then(({ data }) => { if (!dead) setSoon48(new Set(((data ?? []) as Array<{ account_name: string }>).map(x => x.account_name))) })
      supa.from('signals')
        .select('id, account_name, title, severity, status, is_dismissed, created_at, corroboration')
        .in('user_id', await orgIdsBrowser(supa, user.id)).eq('is_dismissed', false)
        .or('status.is.null,status.eq.open')
        .order('created_at', { ascending: false }).limit(400)
        .then(({ data }) => {
          if (dead) return
          const m = new Map<string, SigLite[]>()
          for (const sg of ((data ?? []) as SigLite[])) {
            if (!sg.account_name) continue
            const arr = m.get(sg.account_name) ?? []
            arr.push(sg); m.set(sg.account_name, arr)
          }
          setSigMap(m)
        })
    })
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoSignals])

  const router = useRouter()
  function openA360(a: Account) {
    router.push(`/accounts/${encodeURIComponent(a.name)}`)
  }

  if (accounts.length === 0) {
    return (
      <div className="dsk-screen on">
        <div className="page-hdr fade-in">
          <h1>Portfolio</h1>
          <p>Your accounts will appear here once connected.</p>
        </div>
        <div className="dcard fade-in" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 6 }}>No accounts yet.</div>
          <div style={{ fontSize: 13, color: 'var(--t4)', marginBottom: 18 }}>Let Popsicle scan your inbox and find the companies worth tracking.</div>
          <button onClick={() => { window.location.href = '/welcome?force=1' }} style={{ padding: '11px 22px', background: 'var(--o)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", boxShadow: '0 3px 14px rgba(255,107,53,.22)' }}>Discover accounts</button>
        </div>
      </div>
    )
  }

  return (
    <div className="dsk-screen on">
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
        Portfolio <span style={{ margin: '0 8px' }}>/</span> {accounts.length} accounts
      </div>
      {(() => {
        const RED = TONE.critical, GREEN = TONE.good
        const high = accounts.filter(x => (x.risk_level || '') === 'high')
        const highVal = high.reduce((a, x) => a + (Number(x.value) || 0), 0)
        const medium = accounts.filter(x => (x.risk_level || '') === 'medium')
        const mediumVal = medium.reduce((a, x) => a + (Number(x.value) || 0), 0)
        const closing = accounts.filter(x => /clos/i.test(x.stage || ''))
        const closingVal = closing.reduce((a, x) => a + (Number(x.value) || 0), 0)
        const healthy = accounts.filter(x => (x.risk_level || '') === 'low' && !/clos/i.test(x.stage || ''))
        const scored = accounts.filter(x => x.health_score != null)
        const avgHealth = scored.length ? Math.round(scored.reduce((a, x) => a + (Number(x.health_score) || 0), 0) / scored.length) : null
        const darkHrs = (x: Account) => x.last_contact_date ? (Date.now() - new Date(x.last_contact_date).getTime()) / 3600000 : 0
        const allDark = high.length > 0 && high.every(x => darkHrs(x) > 48)
        const closingNow = closing.find(x => !/won/i.test(x.stage || ''))

        const h = demoHead?.headline
        // a third sentence: how concentrated the book is, and anything healthy that is quietly slipping
        const byValue = [...accounts].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
        const bookTotal = accounts.reduce((a, x) => a + (Number(x.value) || 0), 0)
        const topTwo = byValue.slice(0, 2).reduce((a, x) => a + (Number(x.value) || 0), 0)
        const topShare = bookTotal > 0 ? Math.round((topTwo / bookTotal) * 100) : 0
        const slipping = accounts.find(a => (a.health_score ?? 100) >= 60 && (a.health_score ?? 100) < 72 && a.risk_level !== 'high')
        const third = accounts.length >= 3 && topShare >= 40
          ? <> {byValue[0].name} and {byValue[1].name} are <span style={{ color: 'var(--accent, #E85A25)' }}>{topShare}%</span> of the book.</>
          : slipping ? <> {slipping.name} has quietly <span style={{ color: RED }}>slipped</span> to <span style={{ color: RED }}>{slipping.health_score}</span>, worth a look before it hardens.</>
          : accounts.length > 0 ? <> {accounts.length} account{accounts.length === 1 ? '' : 's'} in the book, worth {fmtVal(bookTotal)} a year.</> : null
        const headline = h ? (
          <>
            {numWord(h.highCount)} account{h.highCount === 1 ? '' : 's'} carr{h.highCount === 1 ? 'ies' : 'y'} <span style={{ color: RED }}>{fmtVal(h.highValue)}</span> of high risk, both dark for over {h.darkHours} hours.{' '}
            <span style={{ color: 'var(--ink-muted)' }}>{h.closingName} is <span style={{ color: GREEN }}>closing this week</span>.{third}</span>
          </>
        ) : (
          <>
            {high.length > 0
              ? <>{numWord(high.length)} account{high.length === 1 ? '' : 's'} carr{high.length === 1 ? 'ies' : 'y'} <span style={{ color: RED }}>{fmtVal(highVal)}</span> of high risk{allDark ? `, ${high.length === 1 ? '' : high.length === 2 ? 'both ' : 'all '}dark for over 48 hours` : ''}.{' '}</>
              : <>Nothing is flagged high risk right now.{' '}</>}
            <span style={{ color: 'var(--ink-muted)' }}>
              {closingNow ? <>{closingNow.name.split(' ')[0]} is <span style={{ color: GREEN }}>closing this week</span>.</>
                : healthy.length ? <>{numWord(healthy.length)} account{healthy.length === 1 ? ' is' : 's are'} healthy.</> : null}
              {third}
            </span>
          </>
        )
        const totalArr = accounts.reduce((a, x) => a + (Number(x.value) || 0), 0)
        const stats: HeadStat[] = demoHead?.stats ?? [
          { n: fmtVal(totalArr), lbl: `total ARR · ${accounts.length} accounts`, tone: 'ink', m: 'total_arr' },
          { n: String(high.length), lbl: `high risk · ${fmtVal(highVal)}`, tone: 'critical', m: 'accounts_high' },
          { n: String(medium.length), lbl: `medium · ${fmtVal(mediumVal)} exposure`, tone: 'warn', m: 'accounts_medium' },
          { n: String(closing.length), lbl: `closing or won · ${fmtVal(closingVal)}`, tone: 'good', m: 'accounts_closing' },
          { n: avgHealth != null ? String(avgHealth) : '--', lbl: 'avg health', tone: 'ink', strong: true, m: 'avg_health', color: avgHealth != null ? healthTone(avgHealth) : undefined },
        ]
        return (
          <>
            <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.4vw,44px)', letterSpacing: '-.035em', margin: '18px 0 0', lineHeight: 1.14, maxWidth: 920, color: 'var(--ink)' }}>
              {headline}
            </h1>
            <div style={{ height: 0, borderTop: '1px solid var(--rule-strong, #0E0D0B)', margin: 'var(--gap-m) 0 0' }} />
            <div className="g4" onMouseLeave={() => setStatHover(null)} style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, minmax(0,1fr))`, columnGap: 28 }}>
              {stats.map((st, i) => (
                <div key={i} onMouseEnter={() => setStatHover(i)}
                  style={{ paddingTop: 22, paddingBottom: 18, position: 'relative', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                  <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, background: 'var(--rule-strong, #0E0D0B)', opacity: (statHover ?? stats.length - 1) === i ? 1 : 0, transition: 'opacity .18s ease' }} />
                  <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.045em', fontSize: 40, lineHeight: 1, color: st.color ?? TONE[st.tone], fontVariantNumeric: 'tabular-nums' }}>{st.m ? <X m={st.m}>{st.n}</X> : st.n}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 10 }}>{st.lbl}</div>
                </div>
              ))}
            </div>
          </>
        )
      })()}
      {(() => {
        const dark = (a: Account) => a.last_contact_date ? Math.floor((Date.now() - new Date(a.last_contact_date).getTime()) / 86400000) : 0
        const isClosing = (a: Account) => /^clos/i.test(a.stage || '') && !/won/i.test(a.stage || '')
        const isStalled = (a: Account) => !isClosing(a) && !/won/i.test(a.stage || '') && (dark(a) >= 5 || (sigMap.get(a.name) ?? []).some(x => /silent_stall|timeline_slip|deal_stage_backward/.test((x as { signal_type?: string | null }).signal_type || '')))
        const counts = { all: accounts.length, high: accounts.filter(a => (a.risk_level || '') === 'high').length, closing: accounts.filter(isClosing).length, stalled: accounts.filter(isStalled).length }
        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 'var(--gap-l)', paddingBottom: 14, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--ink)' }}>All accounts</h2>
            <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: 'var(--inset, #F4F0E8)', borderRadius: 'var(--toggle-radius, 0px)' }}>
              {([['all', 'All'], ['high', 'High risk'], ['closing', 'Closing'], ['stalled', 'Stalled']] as const).map(([k, lbl]) => (
                <button key={k} onClick={() => setView(k)} style={{ font: 'inherit', fontSize: 12.5, fontWeight: view === k ? 600 : 500, padding: '6px 13px', borderRadius: 'var(--toggle-radius, 0px)', border: 0, cursor: 'pointer', background: view === k ? 'var(--d-btn, var(--ink))' : 'transparent', color: view === k ? '#fff' : 'var(--ink-muted)' }}>
                  {lbl} <span style={{ opacity: .55, marginLeft: 4 }}>{counts[k]}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })()}
      <RiskFlagSheet flag={flag} onClose={() => setFlag(null)} />
      {(() => {
        const COLS = '34px minmax(120px,1.5fr) minmax(62px,.62fr) minmax(62px,.58fr) minmax(66px,.75fr) minmax(84px,1.15fr) minmax(70px,.7fr) minmax(52px,.5fr) minmax(52px,.5fr) 112px'
        const cell: React.CSSProperties = { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
        const riskColor: Record<string, string> = { high: 'var(--critical, #c43d2b)', medium: 'var(--warn, #d38b1d)', low: 'var(--good, #2f8f5b)' }
        const dark = (a: Account) => a.last_contact_date ? Math.floor((Date.now() - new Date(a.last_contact_date).getTime()) / 86400000) : 0
        const isClosing = (a: Account) => /^clos/i.test(a.stage || '') && !/won/i.test(a.stage || '')
        const isStalled = (a: Account) => !isClosing(a) && !/won/i.test(a.stage || '') && (dark(a) >= 5 || (sigMap.get(a.name) ?? []).some(x => /silent_stall|timeline_slip|deal_stage_backward/.test((x as { signal_type?: string | null }).signal_type || '')))
        const inView = accounts.filter(a => view === 'all' ? true : view === 'high' ? (a.risk_level || '') === 'high' : view === 'closing' ? isClosing(a) : isStalled(a))
        // urgency first: lowest health at the top, healthiest at the bottom; attention score breaks ties
        const ordered = [...inView].sort((x, y) => {
          const hx = healthOf(x, sigMap.get(x.name) ?? []), hy = healthOf(y, sigMap.get(y.name) ?? [])
          if (hx !== hy) return hx - hy
          const dx = x.last_contact_date ? Math.floor((Date.now() - new Date(x.last_contact_date).getTime()) / 86400000) : null
          const dy = y.last_contact_date ? Math.floor((Date.now() - new Date(y.last_contact_date).getTime()) / 86400000) : null
          return attentionScore(sigMap.get(y.name) ?? [], dy, soon48.has(y.name)) - attentionScore(sigMap.get(x.name) ?? [], dx, soon48.has(x.name))
        })
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: COLS, columnGap: 6, padding: '14px 0 10px', fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
              <span>Hlth</span><span style={{ paddingLeft: 26 }}>Account</span><span style={{ textAlign: 'center' }}>ARR</span><span style={{ textAlign: 'center' }}>Risk</span>
              <span style={{ textAlign: 'center' }}>Stage</span><span>Signal</span><span style={{ textAlign: 'center' }}>Owner</span><span style={{ textAlign: 'center' }}>Trend</span><span style={{ textAlign: 'center' }}>Touch</span><span style={{ textAlign: 'center' }}>Actions</span>
            </div>
            {ordered.length === 0 && <EmptyState line={view === 'all' ? 'No accounts yet.' : `Nothing ${view === 'high' ? 'high risk' : view} right now.`} hint={view === 'all' ? 'Let Popsicle scan your inbox and find the companies worth tracking.' : 'Switch the view, or wait for the next signal.'} compact />}
            {ordered.map(a => {
              const sigs = sigMap.get(a.name) ?? []
              const h = healthOf(a, sigs)
              const risk = riskOf(a, sigs)
              const top = topSignalOf(sigs)
              return (
                <div key={a.id} onClick={() => openA360(a)} className="tbl-row askable ask-offset"
                  style={{ display: 'grid', gridTemplateColumns: COLS, columnGap: 6, alignItems: 'center', padding: '15px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', fontSize: 13, lineHeight: 1.4, cursor: 'pointer' }}>
                  <AskThis q={`Is ${a.name} going to close, and what's the biggest risk?`} account={a.name} />
                  <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.03em', fontSize: 22, color: healthTone(h), fontVariantNumeric: 'tabular-nums' }}><X m="account_health" account={a.name}>{h}</X></span>
                  <div style={{ minWidth: 0, paddingLeft: 26 }}>
                    <Link href={`/accounts/${encodeURIComponent(a.name)}`} prefetch onClick={e => e.stopPropagation()} style={{ ...cell, display: 'block', fontWeight: 600, fontSize: 14, color: 'var(--ink)', textDecoration: 'none' }}>{a.name}</Link>
                    <div style={{ ...cell, fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>{a.owner ? <>{a.owner}{meta[a.name]?.role ? ` · ${meta[a.name].role}` : ''}</> : (a.domain || '')}</div>
                  </div>
                  <span style={{ ...cell, fontSize: 13.5, fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)', textAlign: 'center' }}><X m="account_arr" account={a.name}>{fmtVal(a.value)}</X></span>
                  <span onClick={e => { e.stopPropagation(); setFlag(buildFlag(a.name, sigs, risk, href => router.push(href))) }} title="Why this risk"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', justifySelf: 'center',
                      padding: '3px 10px', borderRadius: 0, background: risk === 'high' ? 'rgba(196,61,43,.10)' : risk === 'medium' ? 'rgba(211,139,29,.12)' : 'rgba(47,143,91,.10)' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', flex: 'none', background: riskColor[risk] }} />
                    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.02em', color: riskColor[risk] }}>{risk === 'medium' ? 'Med' : risk === 'high' ? 'High' : 'Low'}</span>
                  </span>
                  <span style={{ ...cell, color: 'var(--ink-muted)', textAlign: 'center' }}>{a.stage || '--'}</span>
                  <span style={{ ...cell, color: top ? (top.severity === 'high' ? riskColor.high : top.severity === 'positive' ? riskColor.low : riskColor.medium) : 'var(--ink-faint)' }}>{top?.title || '--'}</span>
                  <span style={{ ...cell, color: 'var(--ink-muted)', textAlign: 'center' }}>{meta[a.name]?.rep ?? '--'}</span>
                  <span style={{ ...cell, textAlign: 'center', fontSize: 13, color: (meta[a.name]?.trend ?? '').startsWith('-') ? 'var(--critical, #c43d2b)' : (meta[a.name]?.trend ?? '').startsWith('+') ? 'var(--good, #2f8f5b)' : 'var(--ink-faint)' }}>{meta[a.name]?.trend ? `${(meta[a.name].trend!.startsWith('-') ? '↘ ' : '↗ ')}${meta[a.name].trend}` : '--'}</span>
                  <span style={{ ...cell, color: 'var(--ink-faint)', textAlign: 'center' }}>{mounted ? agoDays(a.last_contact_date) : ''}</span>
                  <button onClick={e => { e.stopPropagation(); if (top) router.push(`/signals?signal=${top.id}&action=reply`); else openA360(a) }}
                    style={{ font: 'inherit', fontSize: 12.5, fontWeight: 500, width: 112, justifySelf: 'center', padding: '8px 0', borderRadius: 0, border: 0, background: 'var(--accent-tint, #FFF1EA)', color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {top ? 'Draft email' : 'Open account'}
                  </button>
                </div>
              )
            })}
          </>
        )
      })()}
    </div>
  )
}
