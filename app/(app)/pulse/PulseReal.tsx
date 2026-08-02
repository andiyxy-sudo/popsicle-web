'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import type { Account, Signal } from '@/types'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'

interface Props {
  name: string
  accounts: Account[]
  signals: Signal[]
  integrationCount: number
}


// Pre-meeting brief: within 30 minutes of a mapped-account meeting, assemble
// the walk-in card: top open signals, last touch, outstanding commitments from
// the latest analyzed call, and days dark. Data: gcal_event_state (RLS-scoped,
// account_name pre-computed server-side). Renders nothing when no meeting is
// near - honest empty state.
interface BriefData {
  summary: string; startTs: string; account: string
  signals: Array<{ id: string; title: string | null; severity: string | null }>
  lastTouch: string | null; daysDark: number | null
  commitments: Array<{ who?: string; what?: string }>
}

function PreMeetingBrief() {
  const router = useRouter()
  const [brief, setBrief] = useState<BriefData | null>(null)

  useEffect(() => {
    let dead = false
    async function load() {
      const supa = createClient()
      const { data: { user } } = await supa.auth.getUser()
      if (!user || dead) return
      const now = Date.now()
      const { data: ev } = await supa.from('gcal_event_state')
        .select('event_id, start_ts, summary, account_name')
        .eq('user_id', user.id).not('account_name', 'is', null)
        .gte('start_ts', new Date(now - 5 * 60_000).toISOString())
        .lte('start_ts', new Date(now + 30 * 60_000).toISOString())
        .order('start_ts', { ascending: true }).limit(1).maybeSingle()
      if (!ev || dead) return
      const account = String(ev.account_name)
      const [sigRes, blRes, acctRes] = await Promise.all([
        supa.from('signals').select('id, title, severity')
          .eq('user_id', user.id).eq('account_name', account)
          .eq('is_dismissed', false).eq('is_snoozed', false)
          .or('status.is.null,status.eq.open')
          .order('created_at', { ascending: false }).limit(3),
        supa.from('account_baselines').select('last_message_at')
          .eq('user_id', user.id).eq('account_name', account).maybeSingle(),
        supa.from('accounts').select('id').eq('user_id', user.id).eq('name', account).maybeSingle(),
      ])
      let commitments: Array<{ who?: string; what?: string }> = []
      if (acctRes.data?.id) {
        const { data: tr } = await supa.from('zoom_transcripts')
          .select('commitments').eq('user_id', user.id).eq('account_id', acctRes.data.id)
          .not('analyzed_at', 'is', null).order('start_time', { ascending: false }).limit(1).maybeSingle()
        commitments = (tr?.commitments as Array<{ who?: string; what?: string }>) ?? []
      }
      const lastTouch = blRes.data?.last_message_at ?? null
      if (dead) return
      setBrief({
        summary: String(ev.summary || 'Meeting'), startTs: String(ev.start_ts), account,
        signals: (sigRes.data ?? []) as BriefData['signals'],
        lastTouch,
        daysDark: lastTouch ? Math.floor((now - new Date(lastTouch).getTime()) / 86400_000) : null,
        commitments: commitments.slice(0, 3),
      })
    }
    load()
    const t = setInterval(load, 5 * 60_000)
    return () => { dead = true; clearInterval(t) }
  }, [])

  if (!brief) return null
  const mins = Math.max(0, Math.round((new Date(brief.startTs).getTime() - Date.now()) / 60_000))
  return (
    <div className="dcard fade-in" style={{ marginBottom: 18, padding: 0, overflow: 'hidden', border: '1px solid rgba(255,107,53,.35)', boxShadow: '0 4px 18px rgba(255,107,53,.12)' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--o)', padding: '3px 10px', borderRadius: 20, letterSpacing: '.5px' }}>{mins <= 1 ? 'STARTING NOW' : `IN ${mins} MIN`}</span>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--t1)' }}>{brief.summary}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t3)' }}>{brief.account}</span>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--t4)', fontFamily: "'DM Mono',monospace" }}>
          {brief.daysDark != null ? `Last touch ${brief.daysDark === 0 ? 'today' : brief.daysDark + 'd ago'}` : 'No touches recorded'}
        </div>
      </div>
      <div style={{ padding: '12px 20px', display: 'grid', gridTemplateColumns: brief.commitments.length ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>Open signals</div>
          {brief.signals.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--t4)' }}>None open. Clean slate.</div>}
          {brief.signals.map(sg => (
            <div key={sg.id} onClick={() => router.push(`/signals?signal=${sg.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, cursor: 'pointer' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: sg.severity === 'high' ? 'var(--danger)' : sg.severity === 'positive' ? 'var(--ok)' : 'var(--amber)' }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--t2)' }}>{sg.title}</span>
            </div>
          ))}
        </div>
        {brief.commitments.length > 0 && (
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>Outstanding commitments</div>
            {brief.commitments.map((c, i) => (
              <div key={i} style={{ fontSize: 11.5, color: 'var(--t2)', marginBottom: 5, lineHeight: 1.45 }}><b>{c.who}:</b> {c.what}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}



// Compact activity icons, demo aesthetic (flat marks sized for the 30px tile).
// Gmail is the demo's exact envelope; the rest follow its scale and flatness.
const ACT_ICONS: Record<string, React.ReactNode> = {
  gmail: (
    <svg width="22" height="17" viewBox="0 0 24 18"><rect width="24" height="18" rx="2" fill="#fff"/><rect x=".5" y=".5" width="23" height="17" rx="1.5" fill="none" stroke="#ddd" strokeWidth=".5"/><path d="M2 2l10 7.5L22 2" stroke="#EA4335" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 2v14h20V2" stroke="#EA4335" strokeWidth="1.2" fill="none" strokeLinejoin="round" opacity=".25"/></svg>
  ),
  slack: (
    <svg width="16" height="16" viewBox="0 0 24 24"><path d="M9.5 2a2 2 0 100 4h2V4a2 2 0 00-2-2zM9.5 7h-5a2 2 0 100 4h5a2 2 0 100-4z" fill="#36C5F0"/><path d="M22 9.5a2 2 0 10-4 0v2h2a2 2 0 002-2zM17 9.5v-5a2 2 0 10-4 0v5a2 2 0 104 0z" fill="#2EB67D"/><path d="M14.5 22a2 2 0 100-4h-2v2a2 2 0 002 2zM14.5 17h5a2 2 0 100-4h-5a2 2 0 100 4z" fill="#ECB22E"/><path d="M2 14.5a2 2 0 104 0v-2H4a2 2 0 00-2 2zM7 14.5v5a2 2 0 104 0v-5a2 2 0 10-4 0z" fill="#E01E5A"/></svg>
  ),
  gcal: (
    <svg width="16" height="16" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="18" rx="2.5" fill="#fff" stroke="#ddd" strokeWidth=".6"/><rect x="2" y="4" width="20" height="5" rx="2.5" fill="#4285F4"/><rect x="2" y="7" width="20" height="2" fill="#4285F4"/><path d="M7 2v4M17 2v4" stroke="#4285F4" strokeWidth="2" strokeLinecap="round"/><text x="12" y="18.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="#4285F4" fontFamily="Arial">17</text></svg>
  ),
  zoom: (
    <svg width="17" height="17" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#2D8CFF"/><path d="M5 9.4c0-.8.6-1.4 1.4-1.4h6.2c.8 0 1.4.6 1.4 1.4v5.2c0 .8-.6 1.4-1.4 1.4H6.4c-.8 0-1.4-.6-1.4-1.4V9.4z" fill="#fff"/><path d="M15 11l3.6-2.4c.4-.3 1-.1 1 .5v5.8c0 .6-.6.8-1 .5L15 13v-2z" fill="#fff"/></svg>
  ),
  hubspot: (
    <svg width="16" height="16" viewBox="0 0 24 24"><circle cx="15" cy="14" r="5.2" fill="none" stroke="#FF7A59" strokeWidth="2.6"/><path d="M15 8.8V4.5M15 4.5a1.6 1.6 0 10-.01 0zM10.6 11.2L5.5 6.9M5.9 19.6l3.4-3.1" stroke="#FF7A59" strokeWidth="2.2" strokeLinecap="round"/></svg>
  ),
  fireflies: (
    <svg width="15" height="15" viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3" fill="#7C5CFC"/><path d="M5 11a7 7 0 0014 0M12 18v4M8.5 22h7" stroke="#7C5CFC" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>
  ),
}

// Live activity: recent signal events only (not raw inbox traffic) - each
// entry is something Popsicle judged worth surfacing, with its source platform.
function ActivityFeed({ signals }: { signals: Signal[] }) {
  const items = signals
    .filter(sg => !sg.is_dismissed && sg.status !== 'deleted')
    .slice(0, 6)
  const ago = (iso: string | null) => {
    if (!iso) return ''
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 60) return `${Math.max(1, m)}m`
    if (m < 1440) return `${Math.floor(m / 60)}h`
    return `${Math.floor(m / 1440)}d`
  }
  if (!items.length) return <div style={{ padding: '24px 20px', fontSize: 11.5, color: 'var(--t4)', textAlign: 'center' }}>Activity appears as signals arrive.</div>
  return (
    <div style={{ padding: '10px 20px' }}>
      {items.map(sg => (
        <div key={sg.id} className="activity-item">
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ACT_ICONS[sg.source_integration || ''] ?? <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase' }}>{(sg.source_integration || '?').slice(0, 2)}</span>}</div>
          <div className="activity-body">{sg.status === 'handled' && <span style={{ color: 'var(--ok)', fontWeight: 900 }}>✓ </span>}{sg.account_name ? <strong>{sg.account_name}</strong> : null}{sg.account_name ? ' — ' : ''}{sg.title}</div>
          <div className="activity-time">{ago(sg.created_at)}</div>
        </div>
      ))}
    </div>
  )
}


// AI Confidence ring (header, demo position): average model confidence across
// analyzed signals, with a click/hover popover explaining the number. Hidden
// until at least one signal carries a confidence value - never a made-up %.
function ConfidenceRing({ signals }: { signals: Signal[] }) {
  const [open, setOpen] = useState(false)
  const [big, setBig] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  useEffect(() => {
    if (!open || !anchor.current) { setPos(null); return }
    const r = anchor.current.getBoundingClientRect()
    setPos({ top: r.bottom + 10, right: Math.max(12, window.innerWidth - r.right) })
  }, [open])
  const confs = signals.map(sg => (sg.ai_analysis as { confidence?: number } | null)?.confidence).filter((c): c is number => typeof c === 'number')
  if (!confs.length) return null
  const pct = Math.round(confs.reduce((a, b) => a + b, 0) / confs.length)
  const color = '#22C55E'  // demo brand green; per-signal colors live in the breakdown
  const C = 2 * Math.PI * 19
  return (
    <div ref={anchor} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
      onClick={() => { setOpen(false); setBig(true) }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className="conf-ring" style={{ width: 46, height: 46 }}>
        <svg width="46" height="46" viewBox="0 0 46 46" style={{ overflow: 'visible' }}>
          <circle cx="23" cy="23" r="19" fill="none" stroke="rgba(34,197,94,.12)" strokeWidth="3.5"/>
          <circle cx="23" cy="23" r="19" fill="none" stroke="#22C55E" strokeWidth="6" strokeDasharray={String(C)} strokeDashoffset={String(C * (1 - pct / 100))} strokeLinecap="round" transform="rotate(-90 23 23)" opacity=".25"/>
          <circle cx="23" cy="23" r="19" fill="none" stroke="#22C55E" strokeWidth="3.5" strokeDasharray={String(C)} strokeDashoffset={String(C * (1 - pct / 100))} strokeLinecap="round" transform="rotate(-90 23 23)"/>
        </svg>
        <div className="conf-ring-val" style={{ fontSize: 11, fontWeight: 900, color }}>{pct}%</div>
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ok)' }}>AI Confidence</div>
        <div style={{ fontSize: 9, color: 'var(--t3)' }}>{confs.length} signal{confs.length === 1 ? '' : 's'}</div>
      </div>
      {big && typeof document !== 'undefined' && createPortal((() => {
        const hi = confs.filter(c => c >= 80).length
        const mid = confs.filter(c => c >= 60 && c < 80).length
        const lo = confs.filter(c => c < 60).length
        const scored = signals
          .map(sg => ({ sg, c: (sg.ai_analysis as { confidence?: number } | null)?.confidence }))
          .filter((x): x is { sg: Signal; c: number } => typeof x.c === 'number')
          .sort((a, b) => a.c - b.c)
        const shown = scored.slice(0, 8)
        const clrOf = (c: number) => c >= 80 ? 'var(--ok)' : c >= 60 ? 'var(--amber)' : 'var(--danger)'
        const C2 = 2 * Math.PI * 30
        const bigBar = (label: string, n: number, clr: string, hint: string) => (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--t1)' }}>{label} <span style={{ fontWeight: 600, color: 'var(--t3)' }}>· {hint}</span></span>
              <span style={{ fontSize: 11, fontWeight: 800, color: clr, fontFamily: "'DM Mono',monospace" }}>{n}</span>
            </div>
            <div style={{ height: 7, borderRadius: 5, background: 'var(--inset)', overflow: 'hidden' }}>
              <div style={{ width: `${confs.length ? Math.round(n / confs.length * 100) : 0}%`, height: '100%', background: clr, borderRadius: 5 }}></div>
            </div>
          </div>
        )
        return (
          <div onClick={() => setBig(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,9,.45)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '84vh', overflowY: 'auto', background: 'var(--surface, #fff)', borderRadius: 18, boxShadow: '0 28px 72px rgba(15,12,9,.3)' }}>
              <div style={{ padding: '20px 26px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(34,197,94,.12)" strokeWidth="5"/>
                    <circle cx="36" cy="36" r="30" fill="none" stroke={color} strokeWidth="5" strokeDasharray={String(C2)} strokeDashoffset={String(C2 * (1 - pct / 100))} strokeLinecap="round" transform="rotate(-90 36 36)"/>
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, color }}>{pct}%</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--t1)', letterSpacing: '-.3px' }}>AI Confidence</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>Average across {confs.length} analyzed signal{confs.length === 1 ? '' : 's'} in your workspace</div>
                </div>
                <button onClick={() => setBig(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 19, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ padding: '18px 26px' }}>
                <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.65, marginBottom: 16 }}>
                  Every signal Popsicle raises carries a confidence score: how clearly the evidence in the source conversation supports the claim. A direct quote like &ldquo;the price is too high for us&rdquo; scores high; an inferred mood shift scores lower. The number here is the average across everything analyzed, so it moves as new calls and threads are processed.
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 8 }}>Distribution</div>
                {bigBar('High ≥80%', hi, 'var(--ok)', 'act on these directly')}
                {bigBar('Medium 60–79%', mid, 'var(--amber)', 'skim the quote first')}
                {bigBar('Low <60%', lo, 'var(--danger)', 'verify before acting')}
                {shown.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>What's driving the number</div>
                    {shown.map(({ sg, c }) => (
                      <div key={sg.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
                        <span style={{ fontSize: 11, fontWeight: 900, color: clrOf(c), fontFamily: "'DM Mono',monospace", width: 34, flexShrink: 0 }}>{c}%</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sg.title}</div>
                          {sg.account_name && <div style={{ fontSize: 10, color: 'var(--t3)' }}>{sg.account_name}</div>}
                        </div>
                      </div>
                    ))}
                    {scored.length > shown.length && <div style={{ fontSize: 10.5, color: 'var(--t4)', marginTop: 6 }}>and {scored.length - shown.length} more</div>}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.6, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  Confidence improves as Popsicle sees more: transcribed calls give the clearest evidence, and removing wrong signals (Remove → reason) teaches detection what to skip. Lowest-confidence signals are listed first above — worth opening each one and checking its quoted evidence.
                </div>
              </div>
            </div>
          </div>
        )
      })(), document.body)}
      {open && pos && typeof document !== 'undefined' && createPortal((() => {
        const hi = confs.filter(c => c >= 80).length
        const mid = confs.filter(c => c >= 60 && c < 80).length
        const lo = confs.filter(c => c < 60).length
        const bar = (label: string, n: number, clr: string) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--t3)', width: 64 }}>{label}</span>
            <div style={{ flex: 1, height: 5, borderRadius: 4, background: 'var(--inset)', overflow: 'hidden' }}>
              <div style={{ width: `${confs.length ? Math.round(n / confs.length * 100) : 0}%`, height: '100%', background: clr, borderRadius: 4 }}></div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--t2)', fontFamily: "'DM Mono',monospace", width: 14, textAlign: 'right' }}>{n}</span>
          </div>
        )
        return (
          <div style={{ position: 'fixed', top: pos.top, right: pos.right, width: 288, background: 'var(--surface, #fff)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 16px 44px rgba(15,12,9,.22)', padding: '16px 18px', zIndex: 900, cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color }}>{pct}%</span>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--t1)' }}>average AI confidence</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--t3)', lineHeight: 1.55, marginBottom: 10 }}>
              Across {confs.length} analyzed signal{confs.length === 1 ? '' : 's'}. Confidence reflects how clear the evidence was in the source conversation.
            </div>
            {bar('High ≥80%', hi, 'var(--ok)')}
            {bar('Medium', mid, 'var(--amber)')}
            {bar('Low <60%', lo, 'var(--danger)')}
            <div style={{ fontSize: 10, color: 'var(--t4)', lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
              Open low-confidence signals and check the quoted evidence before acting. Marking wrong ones as removed teaches detection.
            </div>
          </div>
        )
      })(), document.body)}
    </div>
  )
}


// Shared health formula: 100 minus open risk, plus positive momentum.
function computeHealth(signals: Signal[], accounts: Account[]): number {
  const open = signals.filter(sg => !sg.is_dismissed && !sg.is_snoozed && (!sg.status || sg.status === 'open'))
  const nHigh = open.filter(sg => sg.severity === 'high').length
  const nWatch = open.filter(sg => sg.severity === 'watch').length
  const nPos = signals.filter(sg => sg.severity === 'positive').length
  const nRiskAcct = accounts.filter(a => a.risk_level === 'high').length
  return Math.max(20, Math.min(98, 100 - nHigh * 8 - nWatch * 3 - nRiskAcct * 6 + nPos * 2))
}

export function PulseReal({ name, accounts, signals, integrationCount }: Props) {
  // Health trend: snapshot today's score, compare to the latest prior day.
  const [healthDelta, setHealthDelta] = useState<{ pts: number; label: string } | null>(null)
  useEffect(() => {
    let dead = false
    async function snap() {
      const supa = createClient()
      const { data: { user } } = await supa.auth.getUser()
      if (!user || dead) return
      const today = new Date().toISOString().slice(0, 10)
      const health = computeHealth(signals, accounts)
      await supa.from('pulse_health_history').upsert({ user_id: user.id, day: today, health }, { onConflict: 'user_id,day' })
      const { data: prev } = await supa.from('pulse_health_history')
        .select('day, health').eq('user_id', user.id).lt('day', today)
        .order('day', { ascending: false }).limit(1).maybeSingle()
      if (dead || !prev) return
      const pts = health - Number(prev.health)
      const days = Math.round((new Date(today).getTime() - new Date(String(prev.day)).getTime()) / 86400000)
      const label = days <= 1 ? 'vs yesterday' : days <= 7 ? `vs ${days}d ago` : 'vs last visit'
      if (pts !== 0) setHealthDelta({ pts, label })
    }
    snap()
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const router = useRouter()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const pipelineValue = accounts.reduce((s, a) => s + (a.value ?? 0), 0)
  const atRisk = accounts.filter(a => a.risk_level === 'high')
  const atRiskValue = atRisk.reduce((s, a) => s + (a.value ?? 0), 0)
  const highSignals = signals.filter(s => s.severity === 'high').length
  const watchSignals = signals.filter(s => s.severity === 'watch').length
  const posSignals = signals.filter(s => s.severity === 'positive').length

  const empty = accounts.length === 0 && signals.length === 0

  if (empty) {
    return (
      <div className="dsk-screen on">
        <div className="page-hdr fade-in">
          <p style={{ marginBottom: 4, fontSize: 15, fontWeight: 600, color: 'var(--t2)' }}>{greeting}, {name}.</p>
          <h1 style={{ marginBottom: 0 }}>Revenue Pulse</h1>
        </div>
        <div className="dcard fade-in" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ opacity: .25, marginBottom: 16 }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="1.5" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Welcome to Popsicle</div>
          <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto 20px' }}>
            {integrationCount > 0
              ? 'Your integration is connected. Next, let Popsicle scan your inbox and find the accounts worth watching.'
              : 'Connect Gmail and Popsicle will scan your inbox, find your accounts, and start surfacing revenue signals automatically.'}
          </div>
          <button onClick={() => router.push('/welcome')} style={{ padding: '11px 22px', background: 'var(--o)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", boxShadow: '0 3px 14px rgba(255,107,53,.22)' }}>
            {integrationCount > 0 ? 'Find my accounts →' : 'Set up Popsicle →'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dsk-screen on">
      <div className="page-hdr fade-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ marginBottom: 4, fontSize: 15, fontWeight: 600, color: 'var(--t2)' }}>{greeting}, {name}.</p>
            <h1 style={{ marginBottom: 0 }}>Revenue Pulse</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: integrationCount > 0 ? 'var(--ok)' : 'var(--t4)', animation: integrationCount > 0 ? 'pulse 2s ease-in-out infinite' : undefined }}></div>
              <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>
                {integrationCount} integration{integrationCount === 1 ? '' : 's'} connected
              </span>
            </div>
            <ConfidenceRing signals={signals} />
          </div>
        </div>
      </div>

      <PreMeetingBrief />


      <div className="kpi-grid">
        {(() => {
          // Deterministic pipeline health: start at 100, subtract for open
          // risk, credit positive momentum. Honest bounds, no invented deltas.
          const health = computeHealth(signals, accounts)
          const confs = signals.map(sg => (sg.ai_analysis as { confidence?: number } | null)?.confidence).filter((c): c is number => typeof c === 'number')
          const aiConf = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null
          return (
            <div className="kpi-hero">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div className="kpi-hero-lbl" style={{ marginBottom: 0 }}>Pipeline Health Score</div>
                <button onClick={() => router.push('/ask')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', color: '#fff', fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Ask
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div className="kpi-hero-val">{health}</div>
                  <span style={{ fontSize: 20, color: 'rgba(255,255,255,.4)', fontWeight: 500 }}>/100</span>
                  {healthDelta && (
                    <span className="kpi-hero-badge" style={{ marginLeft: 4 }}>
                      {healthDelta.pts > 0 ? '▲ +' : '▼ '}{healthDelta.pts} pts {healthDelta.label}
                    </span>
                  )}
                </div>
                <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.18)' }}></div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>Pipeline Value</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-.5px', lineHeight: 1 }}>{formatCurrency(pipelineValue)}</div>
                </div>
              </div>
              <div className="kpi-hero-footer">
                <div className="kpi-hero-stat"><strong>{accounts.length}</strong>Accounts</div>
                <div className="kpi-hero-stat"><strong>{signals.length}</strong>Signals</div>
                <div className="kpi-hero-stat"><strong>{atRisk.length}</strong>At risk</div>
                {aiConf != null && <div className="kpi-hero-stat"><strong>{aiConf}%</strong>AI conf</div>}
              </div>
            </div>
          )
        })()}

        <div className="dcard kpi-support kpi-support-danger">
          <div className="dcard-title">Revenue at Risk</div>
          <div className="dcard-val" style={{ color: 'var(--danger)' }}>{atRiskValue > 0 ? formatCurrency(atRiskValue) : '--'}</div>
          <div className="dcard-sub">{atRisk.length} account{atRisk.length === 1 ? '' : 's'} flagged high risk</div>
        </div>

        <div className="dcard kpi-support kpi-support-blue">
          <div className="dcard-title">Active Signals</div>
          <div className="dcard-val">{signals.length}</div>
          {(() => {
            const today = new Date(); today.setHours(0, 0, 0, 0)
            const n = signals.filter(sg => sg.created_at && new Date(sg.created_at) >= today).length
            return <div className="dcard-sub">{n > 0 ? <><span className="dcard-delta delta-up">▲ {n} new</span> today</> : 'No new signals today'}</div>
          })()}
          <div style={{ display: 'flex', gap: 10, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--danger)' }}>{highSignals}</strong> High</span>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--amber)' }}>{watchSignals}</strong> Watch</span>
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}><strong style={{ color: 'var(--ok)' }}>{posSignals}</strong> Pos</span>
          </div>
        </div>

        <div className="dcard kpi-support kpi-support-ok">
          <div className="dcard-title">Connected</div>
          <div className="dcard-val" style={{ color: integrationCount > 0 ? 'var(--ok)' : 'var(--t4)' }}>{integrationCount}</div>
          <div className="dcard-sub">integration{integrationCount === 1 ? '' : 's'} active</div>
        </div>
      </div>

      {/* AI Brief + Revenue Loop + Activity (showcase layout, real data) */}
      {(() => {
        const open = signals.filter(sg => !sg.is_dismissed && !sg.is_snoozed && (!sg.status || sg.status === 'open'))
        const handled = signals.filter(sg => sg.status === 'handled')
        const highs = open.filter(sg => sg.severity === 'high')
        const positives = signals.filter(sg => sg.severity === 'positive')
        const bySrc = new Set(open.map(sg => sg.source_integration).filter(Boolean))
        const riskByAcct = new Map<string, number>()
        for (const sg of open) if (sg.account_name && sg.risk_amount) riskByAcct.set(sg.account_name, (riskByAcct.get(sg.account_name) || 0) + Number(sg.risk_amount))
        const topRisk = Array.from(riskByAcct.entries()).sort((a, b) => b[1] - a[1])[0]
        const openAccts = new Set(open.map(sg => sg.account_name).filter(Boolean))
        const protectedVal = handled.reduce((a, sg) => a + (Number(sg.risk_amount) || 0), 0)
        const stalest = [...accounts].filter(a => a.last_contact_date).sort((a, b) => String(a.last_contact_date).localeCompare(String(b.last_contact_date)))[0]
        const daysDark = stalest?.last_contact_date ? Math.floor((Date.now() - new Date(stalest.last_contact_date).getTime()) / 86400000) : null

        // Demo-style items: one readable sentence each, insight + bolded action.
        const ACTION_BY_TYPE: Record<string, string> = {
          silent_stall: 'book a check-in this week', call_objection: 'address it in your next reply',
          call_sentiment_drop: 'call before the mood hardens', timeline_slip: 'confirm the real date with your champion',
          deal_stage_backward: 'call to find out what changed', meeting_cancelled: 'get it rebooked before momentum fades',
          meeting_declined: 'follow up and re-book it', price_flinch: 'lead with ROI in the next touch',
          competitor_mention: 'send the comparison one-pager', champion_change: 'map the new decision-maker now',
          legal_loopin: 'loop legal in early', call_buying_signal: 'strike while it is warm',
          call_commitment: 'hold them to it in writing', reengaged: 'lock the next step today',
        }
        const D = { danger: ['var(--danger)', 'rgba(224,62,62,.04)', 'rgba(224,62,62,.1)'], amber: ['var(--amber)', 'rgba(232,133,10,.04)', 'rgba(232,133,10,.1)'], ok: ['var(--ok)', 'rgba(42,157,92,.04)', 'rgba(42,157,92,.1)'], blue: ['var(--blue)', 'rgba(59,111,222,.04)', 'rgba(59,111,222,.1)'] } as const
        const mk = (k: keyof typeof D, text: React.ReactNode) => ({ color: D[k][0], bg: D[k][1], bd: D[k][2], text })
        const actFor = (sg: Signal) => {
          const rec = (sg.ai_analysis as { recommendation?: string } | null)?.recommendation
          if (typeof rec === 'string' && rec.length > 6 && rec.length < 90) return rec.replace(/\.$/, '')
          return ACTION_BY_TYPE[sg.signal_type || ''] || 'open it and decide'
        }
        const briefItems: Array<{ color: string; bg: string; bd: string; text: React.ReactNode }> = []
        for (const sg of highs.slice(0, 3)) {
          briefItems.push(mk('danger', <>{sg.account_name ? <>{sg.account_name}: </> : null}{sg.title} — <strong>{actFor(sg)}</strong></>))
        }
        if (topRisk) briefItems.push(mk('amber', <><strong>{formatCurrency(topRisk[1])} at risk</strong> across {riskByAcct.size} account{riskByAcct.size === 1 ? '' : 's'} — {topRisk[0]} carries the most exposure right now</>))
        if (positives[0]) briefItems.push(mk('ok', <>{positives[0].account_name ? <>{positives[0].account_name}: </> : null}{positives[0].title} — <strong>{actFor(positives[0])}</strong></>))
        if (handled.length > 0) briefItems.push(mk('ok', <>You handled <strong>{handled.length} signal{handled.length === 1 ? '' : 's'}</strong>{protectedVal > 0 ? <> worth {formatCurrency(protectedVal)} of at-risk value</> : null} — detection is feeding your pipeline hygiene</>))
        if (stalest && daysDark != null && daysDark > 14) briefItems.push(mk('blue', <>{stalest.name} has been dark for <strong>{daysDark} days</strong>{stalest.value ? <> with {formatCurrency(Number(stalest.value))} on the table</> : null} — worth a touch this week</>))
        {
          const lowConf = signals.filter(sg => { const c = (sg.ai_analysis as { confidence?: number } | null)?.confidence; return typeof c === 'number' && c < 60 })
          if (lowConf.length > 0) briefItems.push(mk('blue', <>{lowConf.length} signal{lowConf.length === 1 ? '' : 's'} sit under 60% AI confidence — <strong>check their quoted evidence before acting</strong></>))
        }
        const watchOnly = open.filter(sg => sg.severity === 'watch' && !highs.some(h => h.account_name === sg.account_name)).slice(0, 7 - briefItems.length)
        for (const sg of watchOnly) {
          if (briefItems.length >= 7) break
          briefItems.push(mk('amber', <>{sg.account_name ? <>{sg.account_name}: </> : null}{sg.title} — <strong>{actFor(sg)}</strong></>))
        }

        const secHead = (icon: React.ReactNode, label: string) => (
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon}
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>{label}</span>
          </div>
        )
        const loopStep = (title: string, sub: string, n: string, color: string, done?: boolean) => (
          <div className="loop-step" style={done ? { background: 'rgba(42,157,92,.06)', borderColor: 'rgba(42,157,92,.15)' } : undefined}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>{sub}</div></div>
            <span style={{ fontSize: 18, fontWeight: 900, color }}>{n}</span>
          </div>
        )

        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 320px', gap: 20, marginBottom: 24 }}>
            <div className="dcard fade-in fade-in-3" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>AI Brief</span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ok)', animation: 'pulse 2s ease-in-out infinite' }}></div>
                  <span style={{ fontSize: 10, color: 'var(--t3)' }}>just now</span>
                  <span style={{ fontSize: 8, fontWeight: 700, background: 'linear-gradient(135deg,var(--o),#FFD166)', color: '#fff', padding: '2px 8px', borderRadius: 20 }}>LIVE</span>
                </div>
              </div>
              <div style={{ padding: '14px 20px' }}>
                {briefItems.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--t4)', textAlign: 'center', padding: '14px 0' }}>All quiet. The brief fills in as signals arrive.</div>}
                {briefItems.map((b, i) => (
                  <div key={i} className="ai-brief-item" style={{ background: b.bg, border: `1px solid ${b.bd}`, borderRadius: 10 }}>
                    <div className="ai-brief-dot" style={{ background: b.color }}></div>
                    <div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.55 }}>{b.text}</div>
                  </div>
                ))}
                <div onClick={() => router.push('/ask')} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 11.5, fontWeight: 700, color: 'var(--o)', cursor: 'pointer' }}>Ask AI to expand on any insight →</div>
              </div>
            </div>

            <div className="dcard fade-in fade-in-4" style={{ padding: 0, overflow: 'hidden' }}>
              {secHead(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>, 'Revenue Loop')}
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {loopStep('Signals', bySrc.size ? `Across ${Array.from(bySrc).map(x => String(x)).join(' · ')}` : 'Open right now', String(open.length), 'var(--danger)')}
                <div className="loop-connector"></div>
                {loopStep('Accounts flagged', 'With at least one open signal', String(openAccts.size), 'var(--amber)')}
                <div className="loop-connector"></div>
                {loopStep('Handled', 'Actions you have taken', String(handled.length), 'var(--o)')}
                <div className="loop-connector"></div>
                {loopStep('Value acted on', 'At-risk $ on handled signals', protectedVal > 0 ? formatCurrency(protectedVal) : '$0', 'var(--ok)', true)}
              </div>
            </div>

            <div className="dcard fade-in fade-in-5" style={{ padding: 0, overflow: 'hidden' }}>
              {secHead(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, 'Activity')}
              <ActivityFeed signals={signals} />
            </div>
          </div>
        )
      })()}

      {/* Accounts needing attention */}
      {(() => {
        const open = signals.filter(sg => !sg.is_dismissed && !sg.is_snoozed && (!sg.status || sg.status === 'open'))
        const topSig = new Map<string, { id: string; title: string | null; severity: string | null }>()
        const counts = new Map<string, { h: number; w: number; p: number }>()
        for (const sg of open) {
          if (!sg.account_name) continue
          if (!topSig.has(sg.account_name) || (sg.severity === 'high' && topSig.get(sg.account_name)!.severity !== 'high')) topSig.set(sg.account_name, { id: sg.id, title: sg.title ?? null, severity: sg.severity ?? null })
          const c = counts.get(sg.account_name) ?? { h: 0, w: 0, p: 0 }
          if (sg.severity === 'high') c.h++; else if (sg.severity === 'watch') c.w++; else if (sg.severity === 'positive') c.p++
          counts.set(sg.account_name, c)
        }
        const rows = accounts
          .map(a => {
            const sg = topSig.get(a.name)
            const c = counts.get(a.name) ?? { h: 0, w: 0, p: 0 }
            const dark = a.last_contact_date ? Math.floor((Date.now() - new Date(a.last_contact_date).getTime()) / 86400000) : null
            return { a, sg, sgId: sg?.id ?? null, nHigh: c.h, nWatch: c.w, nPos: c.p, dark, score: (sg?.severity === 'high' ? 3 : sg ? 2 : 0) + ((dark ?? 0) > 21 ? 1 : 0) }
          })
          .filter(r => r.score > 0)
          .sort((x, y) => y.score - x.score || (Number(y.a.value) || 0) - (Number(x.a.value) || 0))
          .slice(0, 6)
        if (!rows.length) return null
        return (
          <div className="dcard fade-in fade-in-5" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Accounts Needing Attention</span>
              </div>
              <span className="see-all" onClick={() => router.push('/portfolio')} style={{ cursor: 'pointer' }}>View portfolio →</span>
            </div>
            <table className="dtable">
              <thead><tr><th style={{ width: 50 }}>Health</th><th>Account</th><th>Value</th><th>Risk</th><th>Stage</th><th>Top Signal</th><th>Tags</th><th>Last Touch</th><th style={{ width: 120 }}>Action</th></tr></thead>
              <tbody>
                {rows.map(({ a, sg, sgId, nHigh, nWatch, nPos, dark }) => {
                  const h = (a.health_score != null && a.health_score > 0) ? a.health_score : Math.max(25, Math.min(95, 90 - nHigh * 18 - nWatch * 6 + nPos * 4))
                  const risk = a.risk_level || (nHigh ? 'high' : nWatch ? 'medium' : 'low')
                  const tags: Array<[string, string]> = (a.tags && a.tags.length) ? a.tags.slice(0, 3).map(t => [t, 'blue'] as [string, string]) : (() => {
                    const out: Array<[string, string]> = []
                    if ((a.value ?? 0) >= 1_000_000) out.push(['Enterprise', 'blue'])
                    if (nHigh) out.push(['At risk', 'red'])
                    else if (nPos) out.push(['Momentum', 'green'])
                    if (a.stage && /decision|contract|bought|negoti/i.test(a.stage)) out.push(['Late stage', 'amber'])
                    return out.slice(0, 3)
                  })()
                  const hbg = h < 40 ? 'var(--danger-bg)' : h < 65 ? 'var(--amber-bg)' : 'var(--ok-bg)'
                  const hc = h < 40 ? 'var(--danger)' : h < 65 ? 'var(--amber)' : 'var(--ok)'
                  const btn = { fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--t2)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" } as const
                  return (
                    <tr key={a.id} className={h < 40 ? 'row-hi' : h < 65 ? 'row-md' : 'row-ok'} onClick={() => router.push(`/accounts?open=${encodeURIComponent(a.name)}`)} style={{ cursor: 'pointer' }}>
                      <td><div className="port-health" style={{ background: hbg, color: hc }}>{h}</div></td>
                      <td><div style={{ fontWeight: 700 }}>{a.name}</div>{a.owner && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{a.owner}</div>}</td>
                      <td style={{ fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>{a.value ? formatCurrency(Number(a.value)) : '--'}</td>
                      <td><span className={`rp ${risk === 'high' ? 'rhi' : risk === 'medium' ? 'rmd' : 'rlo'}`}>{risk.toUpperCase()}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--t2)' }}>{a.stage || '--'}</td>
                      <td style={{ fontSize: 12, color: sg?.severity === 'high' ? 'var(--danger)' : sg?.severity === 'positive' ? 'var(--ok)' : 'var(--amber)', maxWidth: 200 }}>{sg?.title || '--'}</td>
                      <td><div className="port-tags">{tags.length ? tags.map(([t, c], i) => <span key={i} className={`port-tag port-tag-${c}`}>{t}</span>) : <span style={{ color: 'var(--t4)', fontSize: 11 }}>--</span>}</div></td>
                      <td style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>{dark != null ? (dark === 0 ? 'today' : `${dark}d ago`) : '--'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button style={btn} onClick={() => router.push(`/accounts?open=${encodeURIComponent(a.name)}`)}>Open</button>
                          {sgId && <button style={{ ...btn, borderColor: 'var(--o)', color: 'var(--o)' }} onClick={() => router.push(`/signals?signal=${sgId}&action=reply`)}>Draft</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* Recent signals list */}
      <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o)" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Recent Signals</span>
          </div>
          <span className="see-all" onClick={() => router.push('/signals')}>View all →</span>
        </div>
        <div style={{ padding: 16 }}>
          {signals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--t4)', fontSize: 13 }}>No active signals yet</div>
          ) : signals.slice(0, 8).map(s => {
            const c = s.severity === 'high' ? 'var(--danger)' : s.severity === 'positive' ? 'var(--ok)' : 'var(--amber)'
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-soft)' }}>
                <div style={{ width: 3, height: 32, borderRadius: 2, background: c, flexShrink: 0 }}></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{s.title}</div>
                  {s.account_name && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{s.account_name}</div>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--t4)', fontFamily: "'DM Mono',monospace" }}>{formatRelativeTime(s.created_at)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
