'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { attentionScore } from '@/lib/attention'
import { RiskFlagSheet, buildFlag, type RiskFlag } from '@/components/account/RiskFlagSheet'

import { buildA360 } from '@/lib/demo-accounts'

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
type HeadStat = { n: string; lbl: string; tone: 'critical' | 'warn' | 'good' | 'ink'; strong?: boolean }
type DemoHeadline = { highCount: number; highValue: number; darkHours: number; closingName: string; healthyCount: number }
const TONE = { critical: 'var(--critical, #c43d2b)', warn: 'var(--warn, #d38b1d)', good: 'var(--good, #2f8f5b)', ink: 'var(--ink, #0E0D0B)' } as const
const NUMWORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
const numWord = (n: number) => (n >= 0 && n <= 10 ? NUMWORD[n] : String(n))

function agoDays(iso?: string | null): string {
  if (!iso) return '--'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return d <= 0 ? 'today' : `${d}d ago`
}

export function PortfolioReal({ accounts, demoSignals, demoHead }: { accounts: Account[]; demoSignals?: unknown[]; demoHead?: { headline: DemoHeadline; stats: HeadStat[] } }) {
  const [mounted, setMounted] = useState(false)
  const [statHover, setStatHover] = useState<number | null>(null)   // strong underline follows the pointer
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
    supa.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      if (demoSignals) return
      supa.from('gcal_event_state').select('account_name').eq('user_id', user.id).not('account_name', 'is', null)
        .gte('start_ts', new Date().toISOString()).lte('start_ts', new Date(Date.now() + 48 * 3600_000).toISOString()).limit(50)
        .then(({ data }) => { if (!dead) setSoon48(new Set(((data ?? []) as Array<{ account_name: string }>).map(x => x.account_name))) })
      supa.from('signals')
        .select('id, account_name, title, severity, status, is_dismissed, created_at, corroboration')
        .eq('user_id', user.id).eq('is_dismissed', false)
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
        const headline = h ? (
          <>
            {numWord(h.highCount)} account{h.highCount === 1 ? '' : 's'} carr{h.highCount === 1 ? 'ies' : 'y'} <span style={{ color: RED }}>{fmtVal(h.highValue)}</span> of high risk, both dark for over {h.darkHours} hours.{' '}
            <span style={{ color: 'var(--ink-muted)' }}>{h.closingName} is <span style={{ color: GREEN }}>closing this week</span> and {numWord(h.healthyCount).toLowerCase()} more are healthy.</span>
          </>
        ) : (
          <>
            {high.length > 0
              ? <>{numWord(high.length)} account{high.length === 1 ? '' : 's'} carr{high.length === 1 ? 'ies' : 'y'} <span style={{ color: RED }}>{fmtVal(highVal)}</span> of high risk{allDark ? `, ${high.length === 1 ? '' : high.length === 2 ? 'both ' : 'all '}dark for over 48 hours` : ''}.{' '}</>
              : <>Nothing is flagged high risk right now.{' '}</>}
            <span style={{ color: 'var(--ink-muted)' }}>
              {closingNow ? <>{closingNow.name.split(' ')[0]} is <span style={{ color: GREEN }}>closing this week</span>{healthy.length ? <> and {numWord(healthy.length).toLowerCase()} more are healthy</> : null}.</>
                : healthy.length ? <>{numWord(healthy.length)} account{healthy.length === 1 ? ' is' : 's are'} healthy.</> : null}
            </span>
          </>
        )
        const stats: HeadStat[] = demoHead?.stats ?? [
          { n: String(high.length), lbl: `high risk · ${fmtVal(highVal)} at risk`, tone: 'critical' },
          { n: String(medium.length), lbl: `medium · ${fmtVal(mediumVal)} exposure`, tone: 'warn' },
          { n: String(closing.length), lbl: `closing or won · ${fmtVal(closingVal)}`, tone: 'good' },
          { n: avgHealth != null ? String(avgHealth) : '--', lbl: 'avg health', tone: 'ink', strong: true },
        ]
        return (
          <>
            <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.4vw,44px)', letterSpacing: '-.035em', margin: '18px 0 0', lineHeight: 1.14, maxWidth: 920, color: 'var(--ink)' }}>
              {headline}
            </h1>
            <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '40px 0 0' }} />
            <div className="g4" onMouseLeave={() => setStatHover(null)} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', columnGap: 32 }}>
              {stats.map((st, i) => (
                <div key={i} onMouseEnter={() => setStatHover(i)}
                  style={{ paddingTop: 22, paddingBottom: 18, position: 'relative', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
                  <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, background: 'var(--rule-strong, #0E0D0B)', opacity: (statHover ?? stats.length - 1) === i ? 1 : 0, transition: 'opacity .18s ease' }} />
                  <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.045em', fontSize: 40, lineHeight: 1, color: TONE[st.tone], fontVariantNumeric: 'tabular-nums' }}>{st.n}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 10 }}>{st.lbl}</div>
                </div>
              ))}
            </div>
          </>
        )
      })()}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 56, paddingBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--ink)' }}>All accounts</h2>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>by attention</span>
      </div>
      <RiskFlagSheet flag={flag} onClose={() => setFlag(null)} />
      {(() => {
        const COLS = '34px minmax(104px,1.5fr) minmax(62px,.62fr) minmax(62px,.58fr) minmax(66px,.8fr) minmax(84px,1.2fr) minmax(52px,.5fr) 112px'
        const cell: React.CSSProperties = { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
        const riskColor: Record<string, string> = { high: 'var(--critical, #c43d2b)', medium: 'var(--warn, #d38b1d)', low: 'var(--good, #2f8f5b)' }
        const ordered = [...accounts].sort((x, y) => {
          const dx = x.last_contact_date ? Math.floor((Date.now() - new Date(x.last_contact_date).getTime()) / 86400000) : null
          const dy = y.last_contact_date ? Math.floor((Date.now() - new Date(y.last_contact_date).getTime()) / 86400000) : null
          return attentionScore(sigMap.get(y.name) ?? [], dy, soon48.has(y.name)) - attentionScore(sigMap.get(x.name) ?? [], dx, soon48.has(x.name))
        })
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: COLS, columnGap: 6, padding: '14px 0 8px', fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-faint)', borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
              <span>Hlth</span><span style={{ paddingLeft: 26 }}>Account</span><span>ARR</span><span>Risk</span>
              <span>Stage</span><span>Top Signal</span><span>Touch</span><span />
            </div>
            {ordered.map(a => {
              const sigs = sigMap.get(a.name) ?? []
              const h = healthOf(a, sigs)
              const risk = riskOf(a, sigs)
              const top = topSignalOf(sigs)
              return (
                <div key={a.id} onClick={() => openA360(a)} className="tbl-row"
                  style={{ display: 'grid', gridTemplateColumns: COLS, columnGap: 6, alignItems: 'center', padding: '15px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', fontSize: 13, lineHeight: 1.4, cursor: 'pointer' }}>
                  <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.03em', fontSize: 22, color: h >= 70 ? 'var(--good, #2f8f5b)' : h >= 40 ? 'var(--warn, #d38b1d)' : 'var(--critical, #c43d2b)', fontVariantNumeric: 'tabular-nums' }}>{h}</span>
                  <div style={{ minWidth: 0, paddingLeft: 26 }}>
                    <Link href={`/accounts/${encodeURIComponent(a.name)}`} prefetch onClick={e => e.stopPropagation()} style={{ ...cell, display: 'block', fontWeight: 600, fontSize: 14, color: 'var(--ink)', textDecoration: 'none' }}>{a.name}</Link>
                    <div style={{ ...cell, fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>{a.domain || ''}</div>
                  </div>
                  <span style={{ ...cell, fontSize: 13.5, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{fmtVal(a.value)}</span>
                  <span onClick={e => { e.stopPropagation(); setFlag(buildFlag(a.name, sigs, risk, href => router.push(href))) }} title="Why this risk"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', justifySelf: 'start',
                      padding: '3px 10px', borderRadius: 999, background: risk === 'high' ? 'rgba(196,61,43,.10)' : risk === 'medium' ? 'rgba(211,139,29,.12)' : 'rgba(47,143,91,.10)' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', flex: 'none', background: riskColor[risk] }} />
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.1px', color: riskColor[risk] }}>{risk === 'medium' ? 'MED' : risk.toUpperCase()}</span>
                  </span>
                  <span style={{ ...cell, color: 'var(--ink)' }}>{a.stage || '--'}</span>
                  <span style={{ ...cell, color: top ? (top.severity === 'high' ? riskColor.high : top.severity === 'positive' ? riskColor.low : riskColor.medium) : 'var(--ink-faint)' }}>{top?.title || '--'}</span>
                  <span style={{ ...cell, color: 'var(--ink-muted)' }}>{mounted ? agoDays(a.last_contact_date) : ''}</span>
                  <button onClick={e => { e.stopPropagation(); if (top) router.push(`/signals?signal=${top.id}&action=reply`); else openA360(a) }}
                    style={{ font: 'inherit', fontSize: 12.5, fontWeight: 500, width: 112, padding: '8px 0', borderRadius: 999, border: 0, background: 'var(--accent-tint, #FFF1EA)', color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
