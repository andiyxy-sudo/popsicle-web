'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { attentionScore } from '@/lib/attention'

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
function agoDays(iso?: string | null): string {
  if (!iso) return '--'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return d <= 0 ? 'today' : `${d}d ago`
}

export function PortfolioReal({ accounts, demoSignals }: { accounts: Account[]; demoSignals?: unknown[] }) {
  const [sigMap, setSigMap] = useState<Map<string, SigLite[]>>(new Map())
  const [soon48, setSoon48] = useState<Set<string>>(new Set())
  useEffect(() => {
    let dead = false
    if (demoSignals) {
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
    window.dispatchEvent(new CustomEvent('open-a360', { detail: {
      id: a.id, name: a.name, contact: a.domain || '', stage: a.stage || 'Active',
      arr: fmtVal(a.value), health: a.health_score ?? 50, signals: 0, daysDark: '--',
      risk: (a.risk_level || 'low').toUpperCase(), rep: a.owner || 'You',
      lastTouch: a.last_contact_date ? `Last contact: ${a.last_contact_date}` : 'No recent contact',
      _needsLoad: true,
    } }))
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
        const totalVal = accounts.reduce((a, x) => a + (Number(x.value) || 0), 0)
        const atRisk = accounts.filter(x => (x.risk_level || '') === 'high')
        const riskVal = atRisk.reduce((a, x) => a + (Number(x.value) || 0), 0)
        const dark = accounts.filter(x => x.last_contact_date && (Date.now() - new Date(x.last_contact_date).getTime()) / 86400000 > 14)
        return (
          <>
            <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.4vw,44px)', letterSpacing: '-.035em', margin: '18px 0 0', lineHeight: 1.14, maxWidth: 920, color: 'var(--ink)' }}>
              {fmtVal(totalVal)} across {accounts.length} account{accounts.length === 1 ? '' : 's'}.{' '}
              <span style={{ color: 'var(--ink-muted)' }}>
                {atRisk.length > 0 ? <><span style={{ color: 'var(--critical, #c43d2b)' }}>{fmtVal(riskVal)}</span> sits in {atRisk.length} at-risk account{atRisk.length === 1 ? '' : 's'}{dark.length ? `, and ${dark.length} have gone quiet` : ''}.</> : <>Nothing flagged high risk right now.</>}
              </span>
            </h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginTop: 40, paddingTop: 26, borderTop: '1px solid var(--rule-strong, #0E0D0B)' }}>
              {[
                { n: fmtVal(totalVal), lbl: 'pipeline value', color: 'var(--ink)' },
                { n: fmtVal(riskVal), lbl: `at risk · ${atRisk.length} accounts`, color: 'var(--critical, #c43d2b)' },
                { n: String(dark.length), lbl: 'gone quiet · 14d+', color: 'var(--warn, #d38b1d)' },
                { n: String(accounts.length), lbl: 'accounts tracked', color: 'var(--ink)' },
              ].map((st, i, arr) => (
                <div key={i} style={{ paddingRight: 24, borderRight: i < arr.length - 1 ? '1px solid var(--hairline, #EFEAE1)' : 'none', paddingLeft: i === 0 ? 0 : 24 }}>
                  <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.045em', fontSize: 40, lineHeight: 1, color: st.color, fontVariantNumeric: 'tabular-nums' }}>{st.n}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 8 }}>{st.lbl}</div>
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
      <table className="dtable">
          <thead><tr><th style={{ width: 50 }}>Health</th><th>Account</th><th>ARR</th><th>Risk</th><th>Stage</th><th>Top Signal</th><th>Tags</th><th>Last Touch</th><th style={{ width: 120 }}>Action</th></tr></thead>
          <tbody>
            {[...accounts].sort((x, y) => {
              const dx = x.last_contact_date ? Math.floor((Date.now() - new Date(x.last_contact_date).getTime()) / 86400000) : null
              const dy = y.last_contact_date ? Math.floor((Date.now() - new Date(y.last_contact_date).getTime()) / 86400000) : null
              return attentionScore(sigMap.get(y.name) ?? [], dy, soon48.has(y.name)) - attentionScore(sigMap.get(x.name) ?? [], dx, soon48.has(x.name))
            }).map(a => {
              const sigs = sigMap.get(a.name) ?? []
              const h = healthOf(a, sigs)
              const risk = riskOf(a, sigs)
              const tags = tagsOf(a, sigs)
              const top = topSignalOf(sigs)
              const hbg = h < 40 ? 'var(--danger-bg)' : h < 65 ? 'var(--amber-bg)' : 'var(--ok-bg)'
              const hc = h < 40 ? 'var(--danger)' : h < 65 ? 'var(--amber)' : 'var(--ok)'
              const sigc = top?.severity === 'high' ? 'var(--danger)' : top?.severity === 'positive' ? 'var(--ok)' : 'var(--amber)'
              const btn = { fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--t2)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" } as const
              return (
                <tr key={a.id} className={h < 40 ? 'row-hi' : h < 65 ? 'row-md' : 'row-ok'} onClick={() => openA360(a)} style={{ cursor: 'pointer' }}>
                  <td><div className="port-health" style={{ background: hbg, color: hc }}>{h}</div></td>
                  <td><div style={{ fontWeight: 700 }}>{a.name}</div>{a.domain && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{a.domain}</div>}</td>
                  <td style={{ fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>{fmtVal(a.value)}</td>
                  <td><span className={`rp ${riskClass(risk)}`}>{risk.toUpperCase()}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--t2)' }}>{a.stage || '--'}</td>
                  <td style={{ fontSize: 12, color: top ? sigc : 'var(--t4)', maxWidth: 200 }}>{top?.title || '--'}</td>
                  <td><div className="port-tags">{tags.length ? tags.map(([t, c], i) => <span key={i} className={`port-tag port-tag-${c}`}>{t}</span>) : <span style={{ color: 'var(--t4)', fontSize: 11 }}>--</span>}</div></td>
                  <td style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>{agoDays(a.last_contact_date)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button style={btn} onClick={() => openA360(a)}>Open</button>
                      {top && <button style={{ ...btn, borderColor: 'var(--o)', color: 'var(--o)' }} onClick={() => router.push(`/signals?signal=${top.id}&action=reply`)}>Draft</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
    </div>
  )
}
