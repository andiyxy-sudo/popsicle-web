'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { attentionScore } from '@/lib/attention'
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
  const demoMode = typeof document !== 'undefined' && document.body.dataset.demo === '1'
  const router = useRouter()
  const [brief, setBrief] = useState<BriefData | null>(null)
  const [points, setPoints] = useState<string[]>([])
  const notified = { current: false } as { current: boolean }

  useEffect(() => {
    let dead = false
    if (demoMode) return
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
          .eq('is_dismissed', false)
          .or('status.is.null,status.eq.open')
          .order('created_at', { ascending: false }).limit(3),
        supa.from('account_baselines').select('last_message_at')
          .eq('user_id', user.id).eq('account_name', account).maybeSingle(),
        supa.from('accounts').select('id').eq('user_id', user.id).eq('name', account).maybeSingle(),
      ])
      // Commitments state lives in the commitments TABLE (mobile contract #4).
      let commitments: Array<{ who?: string; what?: string }> = []
      {
        const { data: cm } = await supa.from('commitments')
          .select('text, owner, due_at').eq('user_id', user.id).eq('account_name', account)
          .eq('status', 'open').order('due_at', { ascending: true, nullsFirst: false }).limit(5)
        commitments = (cm ?? []).map((c: { text: string; owner: string | null; due_at: string | null }) => ({
          who: c.owner === 'us' ? 'We' : c.owner === 'them' ? 'They' : undefined,
          what: c.text + (c.due_at ? ` (due ${new Date(c.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''),
        }))
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
      // Guarded talking points (optional content: empty result = hidden section)
      fetch('/api/brief-points', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account }) })
        .then(r => r.json()).then(j => { if (!dead && Array.isArray(j.points)) setPoints(j.points) }).catch(() => {})
      // Browser notification, only if the user already granted permission
      if (!notified.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        notified.current = true
        const mins = Math.max(0, Math.round((new Date(String(ev.start_ts)).getTime() - Date.now()) / 60_000))
        try { new Notification(`Meeting in ${mins} min: ${ev.summary || 'Meeting'}`, { body: `${account} - open Pulse for your brief` }) } catch { /* blocked */ }
      }
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
      <div style={{ padding: '12px 20px', display: 'grid', gridTemplateColumns: `repeat(${1 + (points.length ? 1 : 0) + (brief.commitments.length ? 1 : 0)}, 1fr)`, gap: 16 }}>
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
        {points.length > 0 && (
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>Talking points</div>
            {points.map((pt, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 5, alignItems: 'baseline' }}>
                <span style={{ color: 'var(--o)', fontWeight: 900, fontSize: 11, flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ fontSize: 11.5, color: 'var(--t2)', lineHeight: 1.5 }}>{pt}</span>
              </div>
            ))}
          </div>
        )}
        {brief.commitments.length > 0 && (
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>Outstanding commitments</div>
            {brief.commitments.map((c, i) => (
              <div key={i} style={{ fontSize: 11.5, color: 'var(--t2)', marginBottom: 5, lineHeight: 1.45 }}>{c.who ? <b>{c.who}: </b> : null}{c.what}</div>
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
    <svg width="21" height="21" viewBox="0 0 24 24"><path d="M9.5 2a2 2 0 100 4h2V4a2 2 0 00-2-2zM9.5 7h-5a2 2 0 100 4h5a2 2 0 100-4z" fill="#36C5F0"/><path d="M22 9.5a2 2 0 10-4 0v2h2a2 2 0 002-2zM17 9.5v-5a2 2 0 10-4 0v5a2 2 0 104 0z" fill="#2EB67D"/><path d="M14.5 22a2 2 0 100-4h-2v2a2 2 0 002 2zM14.5 17h5a2 2 0 100-4h-5a2 2 0 100 4z" fill="#ECB22E"/><path d="M2 14.5a2 2 0 104 0v-2H4a2 2 0 00-2 2zM7 14.5v5a2 2 0 104 0v-5a2 2 0 10-4 0z" fill="#E01E5A"/></svg>
  ),
  gcal: (
    <svg width="21" height="21" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="18" rx="2.5" fill="#fff" stroke="#ddd" strokeWidth=".6"/><rect x="2" y="4" width="20" height="5" rx="2.5" fill="#4285F4"/><rect x="2" y="7" width="20" height="2" fill="#4285F4"/><path d="M7 2v4M17 2v4" stroke="#4285F4" strokeWidth="2" strokeLinecap="round"/><text x="12" y="18.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="#4285F4" fontFamily="Arial">17</text></svg>
  ),
  zoom: (
    <svg width="22" height="22" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#2D8CFF"/><path d="M5 9.4c0-.8.6-1.4 1.4-1.4h6.2c.8 0 1.4.6 1.4 1.4v5.2c0 .8-.6 1.4-1.4 1.4H6.4c-.8 0-1.4-.6-1.4-1.4V9.4z" fill="#fff"/><path d="M15 11l3.6-2.4c.4-.3 1-.1 1 .5v5.8c0 .6-.6.8-1 .5L15 13v-2z" fill="#fff"/></svg>
  ),
  hubspot: (
    <svg width="21" height="21" viewBox="0 0 24 24"><circle cx="15" cy="14" r="5.2" fill="none" stroke="#FF7A59" strokeWidth="2.6"/><path d="M15 8.8V4.5M15 4.5a1.6 1.6 0 10-.01 0zM10.6 11.2L5.5 6.9M5.9 19.6l3.4-3.1" stroke="#FF7A59" strokeWidth="2.2" strokeLinecap="round"/></svg>
  ),
  fireflies: (
    <svg width="20" height="20" viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3" fill="#7C5CFC"/><path d="M5 11a7 7 0 0014 0M12 18v4M8.5 22h7" stroke="#7C5CFC" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>
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
function ConfidenceRing({ signals, forceOpen, onClose }: { signals: Signal[]; forceOpen?: boolean; onClose?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [big, setBigRaw] = useState(false)
  const setBig = (v: boolean) => { setBigRaw(v); if (!v && onClose) onClose() }
  useEffect(() => { if (forceOpen) setBigRaw(true) }, [forceOpen])
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
    <div ref={anchor} style={{ position: 'relative', display: forceOpen !== undefined ? 'none' : 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
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
        const clrOf = (c: number) => c >= 80 ? 'var(--good, #2f8f5b)' : c >= 60 ? 'var(--warn, #d38b1d)' : 'var(--critical, #c43d2b)'
        const mlbl = (t: string) => (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: '2.2px', textTransform: 'uppercase', color: 'var(--ink-faint, #A09C97)', marginBottom: 14 }}>{t}</div>
        )
        const band = (label: string, n: number, color: string, hint: string) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0', borderTop: '1px solid var(--hairline, #EFEAE1)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flex: 'none' }} />
            <span style={{ flex: 1, fontSize: 16, color: 'var(--ink)' }}>{label} <span style={{ color: 'var(--ink-faint)' }}>· {hint}</span></span>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: '-.03em', color }}>{n}</span>
          </div>
        )
        return (
          <div onClick={() => setBig(false)} style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(14,13,11,.42)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--paper, #FBF8F3)', padding: '40px 44px 44px', boxShadow: '0 40px 90px -30px rgba(14,13,11,.5)', animation: 'fadeUp .3s both' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: '2.2px', textTransform: 'uppercase', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />detection quality
                </span>
                <button onClick={() => setBig(false)} style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: '2.2px', textTransform: 'uppercase', color: 'var(--ink-faint)', background: 'none', border: 0, cursor: 'pointer' }}>close</button>
              </div>
              <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 34, letterSpacing: '-.035em', margin: '14px 0 0', color: 'var(--ink)' }}>AI Confidence</h2>
              <div style={{ height: 1, background: 'var(--rule-strong, #0E0D0B)', margin: '26px 0 28px' }} />

              {mlbl('average across ' + confs.length + ' analysed signal' + (confs.length === 1 ? '' : 's'))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 56, letterSpacing: '-.045em', lineHeight: 1, color: clrOf(pct) }}>{pct}%</span>
                <span style={{ flex: 1, height: 3, background: 'var(--hairline, #EFEAE1)', position: 'relative' }}>
                  <span style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: clrOf(pct) }} />
                </span>
              </div>

              <div style={{ marginTop: 34 }}>
                {mlbl('distribution')}
                {band('High', hi, 'var(--good, #2f8f5b)', 'act directly')}
                {band('Medium', mid, 'var(--warn, #d38b1d)', 'skim the quote')}
                {band('Low', lo, 'var(--critical, #c43d2b)', 'verify first')}
              </div>

              {scored.length > 0 && (
                <div style={{ marginTop: 34 }}>
                  {mlbl("what's driving the number")}
                  {scored.slice(0, 6).map(({ sg, c }) => (
                    <div key={sg.id} onClick={() => { setBig(false); router.push(`/signals?signal=${sg.id}`) }} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer' }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: clrOf(c), width: 42, flex: 'none' }}>{c}%</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sg.account_name ? `${sg.account_name}: ` : ''}{sg.title}</span>
                      <span style={{ color: 'var(--accent)', fontSize: 15 }}>→</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 30, paddingLeft: 16, borderLeft: `3px solid var(--accent)` }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: '2.2px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>how it improves</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>Transcribed calls give the clearest evidence. Removing wrong signals teaches detection what to skip.</div>
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
  const open = signals.filter(sg => !sg.is_dismissed && (!sg.status || sg.status === 'open'))
  const nHigh = open.filter(sg => sg.severity === 'high').length
  const nWatch = open.filter(sg => sg.severity === 'watch').length
  const nPos = signals.filter(sg => sg.severity === 'positive').length
  const nRiskAcct = accounts.filter(a => a.risk_level === 'high').length
  return Math.max(20, Math.min(98, 100 - nHigh * 8 - nWatch * 3 - nRiskAcct * 6 + nPos * 2))
}

// TODAY block (mobile item 22): meetings today, due/overdue commitments, and
// accounts needing attention ranked by the shared attention formula (order
// only, no visible score). Sections are absent when empty; quiet day = block hidden.
function TodayBlock({ accounts, signals }: { accounts: Account[]; signals: Signal[] }) {
  const demoMode = accounts.some(a => String(a.id).startsWith('demo-'))
  const router = useRouter()
  const [meetings, setMeetings] = useState<Array<{ event_id: string; start_ts: string; summary: string | null; account_name: string | null }>>([])
  const [due, setDue] = useState<Array<{ id: string; text: string; owner: string | null; due_at: string | null; account_name: string | null }>>([])
  const [soonAccts, setSoonAccts] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let dead = false
    if (demoMode) { setLoaded(true); return }
    async function load() {
      const supa = createClient()
      const { data: { user } } = await supa.auth.getUser()
      if (!user) return
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const end = new Date(start); end.setDate(end.getDate() + 1)
      const soon = new Date(Date.now() + 48 * 3600_000)
      const [m, c, s48] = await Promise.all([
        supa.from('gcal_event_state').select('event_id, start_ts, summary, account_name').eq('user_id', user.id)
          .gte('start_ts', start.toISOString()).lt('start_ts', end.toISOString()).neq('status', 'cancelled').order('start_ts').limit(12),
        supa.from('commitments').select('id, text, owner, due_at, account_name').eq('user_id', user.id).eq('status', 'open')
          .lte('due_at', end.toISOString()).order('due_at').limit(10),
        supa.from('gcal_event_state').select('account_name').eq('user_id', user.id).not('account_name', 'is', null)
          .gte('start_ts', new Date().toISOString()).lte('start_ts', soon.toISOString()).limit(50),
      ])
      if (dead) return
      setMeetings((m.data as typeof meetings) ?? [])
      setDue((c.data as typeof due) ?? [])
      setSoonAccts(new Set(((s48.data ?? []) as Array<{ account_name: string | null }>).map(x => x.account_name).filter(Boolean) as string[]))
      setLoaded(true)
    }
    load()
    return () => { dead = true }
  }, [])

  const attention = (() => {
    const byAcct = new Map<string, Signal[]>()
    for (const sg of signals) if (sg.account_name) { const a = byAcct.get(sg.account_name) ?? []; a.push(sg); byAcct.set(sg.account_name, a) }
    return accounts.map(a => {
      const dark = a.last_contact_date ? Math.floor((Date.now() - new Date(a.last_contact_date).getTime()) / 86400000) : null
      const sigs = byAcct.get(a.name) ?? []
      const top = sigs.find(sg => !sg.is_dismissed && (!sg.status || sg.status === 'open') && sg.severity === 'high') ?? sigs.find(sg => !sg.is_dismissed && (!sg.status || sg.status === 'open'))
      return { a, dark, top, score: attentionScore(sigs, dark, soonAccts.has(a.name)) }
    }).filter(r => r.score > 0).sort((x, y) => y.score - x.score).slice(0, 5)
  })()

  if (!loaded) return null
  if (!meetings.length && !due.length && !attention.length) return null
  const secLbl = (t: string) => <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 7 }}>{t}</div>
  const cols = [meetings.length, due.length, attention.length].filter(Boolean).length
  return (
    <div className="dcard fade-in" style={{ marginBottom: 18, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Today</span>
        <span style={{ fontSize: 10.5, color: 'var(--t4)' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
      </div>
      <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 20 }}>
        {meetings.length > 0 && (
          <div>
            {secLbl(`${meetings.length} meeting${meetings.length === 1 ? '' : 's'}`)}
            {meetings.map(m => (
              <div key={m.event_id} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'baseline' }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--t3)', fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>{new Date(m.start_ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--t1)' }}>{m.summary || 'Meeting'}{m.account_name ? <span style={{ color: 'var(--t3)', fontWeight: 500 }}> · {m.account_name}</span> : null}</span>
              </div>
            ))}
          </div>
        )}
        {due.length > 0 && (
          <div>
            {secLbl('Commitments due')}
            {due.map(c => {
              const overdue = c.due_at ? new Date(c.due_at).getTime() < Date.now() - 86400000 : false
              return (
                <div key={c.id} onClick={() => c.account_name && router.push(`/accounts?open=${encodeURIComponent(c.account_name)}`)} style={{ display: 'flex', gap: 7, marginBottom: 6, cursor: c.account_name ? 'pointer' : 'default', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: overdue ? 'var(--danger)' : 'var(--amber)', flexShrink: 0 }}>{overdue ? 'OVERDUE' : 'DUE'}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--t1)', fontWeight: 600 }}>{c.owner === 'them' ? 'They: ' : c.owner === 'us' ? 'We: ' : ''}{c.text}{c.account_name ? <span style={{ color: 'var(--t3)', fontWeight: 500 }}> · {c.account_name}</span> : null}</span>
                </div>
              )
            })}
          </div>
        )}
        {attention.length > 0 && (
          <div>
            {secLbl('Needs attention')}
            {attention.map(({ a, top, dark }) => (
              <div key={a.id} onClick={() => router.push(`/accounts?open=${encodeURIComponent(a.name)}`)} style={{ display: 'flex', gap: 7, marginBottom: 6, cursor: 'pointer', alignItems: 'baseline' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, position: 'relative', top: -1, background: top?.severity === 'high' ? 'var(--danger)' : top ? 'var(--amber)' : 'var(--t4)' }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t1)' }}>{a.name}</span>
                <span style={{ fontSize: 10.5, color: 'var(--t3)' }}>{top?.title || (dark != null ? `quiet ${dark}d` : '')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Week-ahead digest (mobile item 20): Mondays only, dismissable per week
// (digest_dismissals, week_start = local Monday). Sections: meetings this
// week, commitments due this week, and gone-quiet accounts - gated on real
// correspondence history (total_reply_pairs >= 1) and silence beyond ~2x the
// account's own baseline interval (floor 14d). Quiet week = no card at all.
// Testing hook: ?digest=1 shows it on any day.
function WeekDigest() {
  const demoMode = typeof document !== 'undefined' && document.body.dataset.demo === '1'
  const router = useRouter()
  const [state, setState] = useState<null | {
    weekStart: string
    meetings: Array<{ event_id: string; start_ts: string; summary: string | null; account_name: string | null }>
    due: Array<{ id: string; text: string; owner: string | null; due_at: string | null; account_name: string | null }>
    quiet: Array<{ name: string; days: number }>
  }>(null)

  useEffect(() => {
    let dead = false
    const now = new Date()
    const preview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('digest') === '1'
    if (now.getDay() !== 1 && !preview) return
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0)
    const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
    const weekEnd = new Date(monday); weekEnd.setDate(monday.getDate() + 7)
    async function load() {
      const supa = createClient()
      const { data: { user } } = await supa.auth.getUser()
      if (!user || dead) return
      const { data: dis } = await supa.from('digest_dismissals').select('week_start').eq('user_id', user.id).eq('week_start', weekStart).maybeSingle()
      if (dis || dead) return
      const [m, c, bl] = await Promise.all([
        supa.from('gcal_event_state').select('event_id, start_ts, summary, account_name').eq('user_id', user.id)
          .gte('start_ts', monday.toISOString()).lt('start_ts', weekEnd.toISOString()).neq('status', 'cancelled').order('start_ts').limit(20),
        supa.from('commitments').select('id, text, owner, due_at, account_name').eq('user_id', user.id).eq('status', 'open')
          .gte('due_at', monday.toISOString()).lt('due_at', weekEnd.toISOString()).order('due_at').limit(12),
        supa.from('account_baselines').select('account_name, last_message_at, avg_interval_hours, total_reply_pairs')
          .eq('user_id', user.id).gte('total_reply_pairs', 1).not('last_message_at', 'is', null).limit(200),
      ])
      if (dead) return
      const quiet: Array<{ name: string; days: number }> = []
      for (const b of ((bl.data ?? []) as Array<{ account_name: string | null; last_message_at: string; avg_interval_hours: number | null; total_reply_pairs: number }>)) {
        if (!b.account_name) continue
        const days = Math.floor((Date.now() - new Date(b.last_message_at).getTime()) / 86400000)
        const baselineDays = Math.max(14, ((b.avg_interval_hours ?? 0) / 24) * 2)
        if (days >= baselineDays) quiet.push({ name: b.account_name, days })
      }
      quiet.sort((a, b) => b.days - a.days)
      const dedup = Array.from(new Map(quiet.map(q => [q.name, q])).values()).slice(0, 5)
      const meetings = (m.data as NonNullable<typeof state>['meetings']) ?? []
      const due = (c.data as NonNullable<typeof state>['due']) ?? []
      if (!meetings.length && !due.length && !dedup.length) return
      setState({ weekStart, meetings, due, quiet: dedup })
    }
    load()
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!state) return null
  const dismiss = async () => {
    const supa = createClient()
    const { data: { user } } = await supa.auth.getUser()
    if (user) await supa.from('digest_dismissals').upsert({ user_id: user.id, week_start: state.weekStart, dismissed_at: new Date().toISOString() })
    setState(null)
  }
  const secLbl = (t: string) => <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 7 }}>{t}</div>
  const dayLbl = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short' })
  const cols = [state.meetings.length, state.due.length, state.quiet.length].filter(Boolean).length
  return (
    <div className="dcard fade-in" style={{ marginBottom: 18, padding: 0, overflow: 'hidden', border: '1px solid rgba(255,107,53,.25)' }}>
      <div style={{ padding: '12px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Your Week Ahead</span>
        <span style={{ fontSize: 10.5, color: 'var(--t4)' }}>week of {new Date(state.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <button onClick={dismiss} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 10.5, fontWeight: 700, color: 'var(--t4)', fontFamily: "'Outfit',sans-serif" }}>Dismiss for this week</button>
      </div>
      <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 20 }}>
        {state.meetings.length > 0 && (
          <div>
            {secLbl(`${state.meetings.length} meeting${state.meetings.length === 1 ? '' : 's'} this week`)}
            {state.meetings.slice(0, 7).map(m => (
              <div key={m.event_id} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'baseline' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--t3)', fontFamily: "'DM Mono',monospace", width: 30, flexShrink: 0 }}>{dayLbl(m.start_ts)}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--t1)' }}>{m.summary || 'Meeting'}{m.account_name ? <span style={{ color: 'var(--t3)', fontWeight: 500 }}> · {m.account_name}</span> : null}</span>
              </div>
            ))}
            {state.meetings.length > 7 && <div style={{ fontSize: 10, color: 'var(--t4)' }}>and {state.meetings.length - 7} more</div>}
          </div>
        )}
        {state.due.length > 0 && (
          <div>
            {secLbl('Commitments due')}
            {state.due.map(c => (
              <div key={c.id} onClick={() => c.account_name && router.push(`/accounts?open=${encodeURIComponent(c.account_name)}`)} style={{ display: 'flex', gap: 8, marginBottom: 6, cursor: c.account_name ? 'pointer' : 'default', alignItems: 'baseline' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--amber)', fontFamily: "'DM Mono',monospace", width: 30, flexShrink: 0 }}>{c.due_at ? dayLbl(c.due_at) : ''}</span>
                <span style={{ fontSize: 11.5, color: 'var(--t1)', fontWeight: 600 }}>{c.owner === 'them' ? 'They: ' : c.owner === 'us' ? 'We: ' : ''}{c.text}{c.account_name ? <span style={{ color: 'var(--t3)', fontWeight: 500 }}> · {c.account_name}</span> : null}</span>
              </div>
            ))}
          </div>
        )}
        {state.quiet.length > 0 && (
          <div>
            {secLbl('Gone quiet')}
            {state.quiet.map(q => (
              <div key={q.name} onClick={() => router.push(`/accounts?open=${encodeURIComponent(q.name)}`)} style={{ display: 'flex', gap: 7, marginBottom: 6, cursor: 'pointer', alignItems: 'baseline' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t1)' }}>{q.name}</span>
                <span style={{ fontSize: 10.5, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>{q.days}d silent</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const TYPE_LABEL_SHORT: Record<string, string> = {
  silent_stall: 'Silent stall', competitor_mention: 'Competitor', legal_loopin: 'Legal loop-in',
  price_flinch: 'Price flinch', champion_change: 'Champion change', timeline_slip: 'Timeline slip',
  reengaged: 'Re-engaged', call_objection: 'Objection', call_sentiment_drop: 'Sentiment drop',
  call_buying_signal: 'Buying signal', call_commitment: 'Commitment', meeting_cancelled: 'Meeting cancelled',
  meeting_declined: 'Meeting declined', deal_stage_backward: 'Stage backward', commitment_overdue: 'Commitment overdue',
}

export function PulseReal({ name, accounts, signals, integrationCount }: Props) {
  // Demo rows live in the bundle, not the database: skip every client round-trip.
  const isDemoData = accounts.some(a => String(a.id).startsWith('demo-')) || signals.some(s => String(s.id).startsWith('demo-'))
  // Accounts with a meeting inside 48h (attention-formula factor).
  const [soon48, setSoon48] = useState<Set<string>>(new Set())
  useEffect(() => {
    let dead = false
    if (isDemoData) return
    const supa = createClient()
    supa.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supa.from('gcal_event_state').select('account_name').eq('user_id', user.id).not('account_name', 'is', null)
        .gte('start_ts', new Date().toISOString()).lte('start_ts', new Date(Date.now() + 48 * 3600_000).toISOString()).limit(50)
        .then(({ data }) => { if (!dead) setSoon48(new Set(((data ?? []) as Array<{ account_name: string }>).map(x => x.account_name))) })
    })
    return () => { dead = true }
  }, [])
  // Health trend: snapshot today's score, compare to the latest prior day.
  const [healthDelta, setHealthDelta] = useState<{ pts: number; label: string } | null>(null)
  useEffect(() => {
    let dead = false
    if (isDemoData) return
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

  // ---------- EDITORIAL PULSE (redesign Phase 3) ----------
  const open = signals.filter(sg => !sg.is_dismissed && (!sg.status || sg.status === 'open'))
  const handled = signals.filter(sg => sg.status === 'handled')
  const highs = open.filter(sg => sg.severity === 'high')
  const positives = signals.filter(sg => sg.severity === 'positive')
  const health = computeHealth(signals, accounts)
  const riskByAcct = new Map<string, number>()
  for (const sg of open) if (sg.account_name && sg.risk_amount) riskByAcct.set(sg.account_name, (riskByAcct.get(sg.account_name) || 0) + Number(sg.risk_amount))
  const atRiskTotal = Array.from(riskByAcct.values()).reduce((a, b) => a + b, 0)
  const protectedVal = handled.reduce((a, sg) => a + (Number(sg.risk_amount) || 0), 0)
  const confs = signals.map(sg => (sg.ai_analysis as { confidence?: number } | null)?.confidence).filter((c): c is number => typeof c === 'number')
  const aiConf = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null
  const [inboxOpen, setInboxOpen] = useState(false)
  const [confOpen, setConfOpen] = useState(false)

  const narrative = (() => {
    const deltaTxt = healthDelta ? `, ${healthDelta.pts > 0 ? 'up' : 'down'} ${Math.abs(healthDelta.pts)} ${healthDelta.label.replace('vs ', 'since ')}` : ''
    const riskAccts = riskByAcct.size
    return (
      <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.4vw,44px)', letterSpacing: '-.035em', margin: '18px 0 0', lineHeight: 1.14, maxWidth: 920 }}>
        Pipeline health is <span style={{ color: 'var(--accent-hot, #FF6B35)' }}>{health}</span>{deltaTxt}.{' '}
        <span style={{ color: 'var(--ink-muted)' }}>
          {atRiskTotal > 0 && riskAccts > 0
            ? <>{riskAccts === 1 ? 'One account holds' : `${riskAccts} accounts hold`} <span style={{ color: 'var(--critical, #c43d2b)' }}>{formatCurrency(atRiskTotal)}</span> of risk{highs.length > 0 ? ' and need you today' : ''}.</>
            : positives.length > 0 ? <>Momentum is on your side — {positives.length} positive signal{positives.length === 1 ? '' : 's'} in play.</>
            : open.length > 0 ? <>{open.length} open signal{open.length === 1 ? '' : 's'} worth a look.</>
            : <>All quiet across {accounts.length} account{accounts.length === 1 ? '' : 's'}.</>}
        </span>
      </h1>
    )
  })()

  const briefRows = (() => {
    const ACTION_BY_TYPE: Record<string, string> = {
      silent_stall: 'book a check-in this week', call_objection: 'address it in your next reply',
      call_sentiment_drop: 'call before the mood hardens', timeline_slip: 'confirm the real date with your champion',
      deal_stage_backward: 'call to find out what changed', meeting_cancelled: 'get it rebooked before momentum fades',
      meeting_declined: 'follow up and re-book it', price_flinch: 'lead with ROI in the next touch',
      competitor_mention: 'send the comparison one-pager', champion_change: 'map the new decision-maker now',
      legal_loopin: 'loop legal in early', call_buying_signal: 'strike while it is warm',
      call_commitment: 'hold them to it in writing', reengaged: 'lock the next step today',
      commitment_overdue: 'close it out or reset the date',
    }
    const actFor = (sg: Signal) => {
      const rec = (sg.ai_analysis as { recommendation?: string } | null)?.recommendation
      if (typeof rec === 'string' && rec.length > 6 && rec.length < 90) return rec.replace(/\.$/, '')
      return ACTION_BY_TYPE[sg.signal_type || ''] || 'open it and decide'
    }
    const rows: Array<{ pre: string; strong: string }> = []
    for (const sg of highs.slice(0, 3)) rows.push({ pre: `${sg.account_name ? sg.account_name + ': ' : ''}${sg.title} — `, strong: actFor(sg) })
    if (positives[0]) rows.push({ pre: `${positives[0].account_name ? positives[0].account_name + ': ' : ''}${positives[0].title} — `, strong: actFor(positives[0]) })
    const watch = open.filter(sg => sg.severity === 'watch').slice(0, 5 - rows.length)
    for (const sg of watch) { if (rows.length >= 5) break; rows.push({ pre: `${sg.account_name ? sg.account_name + ': ' : ''}${sg.title} — `, strong: actFor(sg) }) }
    return rows
  })()

  const loopRows = (() => {
    const bySrc = new Set(open.map(sg => sg.source_integration).filter(Boolean))
    const openAccts = new Set(open.map(sg => sg.account_name).filter(Boolean))
    return [
      { name: 'Signals', sub: bySrc.size ? `across ${Array.from(bySrc).join(' · ')}` : 'open right now', value: String(open.length), color: 'var(--critical, #c43d2b)' },
      { name: 'Accounts flagged', sub: 'with at least one open signal', value: String(openAccts.size), color: 'var(--warn, #d38b1d)' },
      { name: 'Handled', sub: 'actions you have taken', value: String(handled.length), color: 'var(--accent)' },
      { name: 'Value acted on', sub: 'at-risk $ on handled signals', value: protectedVal > 0 ? formatCurrency(protectedVal) : '$0', color: 'var(--good, #2f8f5b)' },
    ]
  })()

  const activityRows = signals.filter(sg => !sg.is_dismissed && sg.status !== 'deleted').slice(0, 6)
  const ago = (iso?: string | null) => {
    if (!iso) return ''
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 60) return `${Math.max(1, m)}m`
    if (m < 1440) return `${Math.floor(m / 60)}h`
    return `${Math.floor(m / 1440)}d`
  }

  const secHead = (title: string, right?: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 16, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--ink)' }}>{title}</h2>
      {right}
    </div>
  )
  const mono = (txt: string) => <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)' }}>{txt}</span>
  const liveDot = (
    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ position: 'relative', width: 6, height: 6, display: 'inline-block' }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent)' }}></span>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent)', animation: 'ping 1.8s ease-out infinite' }}></span>
      </span>
      live
    </span>
  )
  const dateCrumb = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="dsk-screen on" style={{ maxWidth: 1080 }}>
      {/* breadcrumb + live signal inbox */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', minHeight: 36 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          Revenue Pulse <span style={{ margin: '0 8px' }}>/</span> {dateCrumb}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setInboxOpen(o => !o)} style={{ font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 9, padding: '8px 14px', border: 0, background: inboxOpen ? 'rgba(14,13,11,.05)' : 'transparent', color: inboxOpen ? 'var(--ink)' : 'var(--ink-faint)', fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', cursor: 'pointer' }}>
              <span style={{ position: 'relative', width: 8, height: 8, flex: 'none' }}>
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent)' }}></span>
                {open.length > 0 && <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent)', animation: 'ping 2s ease-out infinite' }}></span>}
              </span>
              <span>{open.length} signal{open.length === 1 ? '' : 's'}</span>
            </button>
            {inboxOpen && (
              <div style={{ position: 'absolute', top: 44, right: 0, width: 430, maxWidth: 'calc(100vw - 280px)', zIndex: 60, background: 'var(--raised, #FFFDFA)', boxShadow: 'var(--shadow-panel, 0 32px 80px -24px rgba(14,13,11,.35))', animation: 'fadeUp .25s both', textAlign: 'left' }}>
                <div style={{ background: 'var(--ink)', color: 'var(--paper, #FBF8F3)', padding: '18px 22px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'rgba(251,248,243,.5)' }}>Inbox · open now</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--accent-light, #FF8A50)' }}>live</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
                    <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 34, letterSpacing: '-.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{open.length}</span>
                    <span style={{ fontSize: 14, color: 'rgba(251,248,243,.62)' }}>open signal{open.length === 1 ? '' : 's'}{highs.length > 0 ? <> · <span style={{ color: 'var(--accent-light, #FF8A50)' }}>{highs.length} critical</span></> : null}</span>
                  </div>
                </div>
                <div style={{ maxHeight: 390, overflowY: 'auto' }}>
                  {open.slice(0, 8).map(sg => (
                    <div key={sg.id} onClick={() => { setInboxOpen(false); router.push(`/signals?signal=${sg.id}`) }} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '0 14px', alignItems: 'center', padding: '15px 22px', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: sg.severity === 'high' ? 'var(--critical)' : sg.severity === 'positive' ? 'var(--good)' : 'var(--warn)' }}></span>
                          <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>{sg.account_name || 'Unmapped'}</span>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{sg.source_integration || ''}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4, lineHeight: 1.45, paddingLeft: 16 }}>{sg.title}</div>
                      </div>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)', whiteSpace: 'nowrap', alignSelf: 'start', paddingTop: 2 }}>{ago(sg.created_at)}</span>
                    </div>
                  ))}
                  {open.length === 0 && <div style={{ padding: '26px 22px', fontSize: 13, color: 'var(--ink-faint)' }}>Nothing open right now.</div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 22px', borderTop: '1px solid var(--rule-strong, #0E0D0B)' }}>
                  <span onClick={() => { setInboxOpen(false); router.push('/signals') }} style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}>All signals →</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {narrative}

      <PreMeetingBrief />
      <div style={{ marginTop: 24 }}><WeekDigest /></div>
      <TodayBlock accounts={accounts} signals={signals} />

      {/* naked stat row over the ink rule */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '28px 32px', marginTop: 40, paddingTop: 28, borderTop: '1px solid var(--rule-strong, #0E0D0B)' }}>
        <div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.045em', fontSize: 40, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{atRiskTotal > 0 ? formatCurrency(atRiskTotal) : '$0'}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 8 }}>revenue at risk · {riskByAcct.size} account{riskByAcct.size === 1 ? '' : 's'}</div>
        </div>
        <div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.045em', fontSize: 40, lineHeight: 1, background: 'var(--accent-gradient, linear-gradient(90deg,#FF8A50,#E85A25))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', fontVariantNumeric: 'tabular-nums' }}>{protectedVal > 0 ? formatCurrency(protectedVal) : '$0'}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 8 }}>value acted on · {handled.length} handled</div>
        </div>
        <div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.045em', fontSize: 40, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{formatCurrency(pipelineValue)}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 8 }}>pipeline value · {accounts.length} accounts</div>
        </div>
        {aiConf != null && (
          <div onClick={() => setConfOpen(true)} style={{ cursor: 'pointer' }}>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.045em', fontSize: 40, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{aiConf}%</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 7 }}>AI confidence <span style={{ color: 'var(--accent)', fontWeight: 600 }}>→</span></div>
          </div>
        )}
      </div>
      {confOpen && <ConfidenceRing signals={signals} forceOpen onClose={() => setConfOpen(false)} />}

      {/* three editorial columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 56, marginTop: 80 }}>
        <section style={{ minWidth: 0 }}>
          {secHead('Today', liveDot)}
          {briefRows.length === 0 && <div style={{ padding: '22px 0', fontSize: 14, color: 'var(--ink-faint)' }}>All quiet. This fills in as signals arrive.</div>}
          {briefRows.map((b, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 12, padding: '20px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', fontSize: 16, lineHeight: 1.5 }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)', paddingTop: 6 }}>{String(i + 1).padStart(2, '0')}</span>
              <div style={{ color: 'var(--ink)' }}>{b.pre}<strong style={{ fontWeight: 600 }}>{b.strong}</strong></div>
            </div>
          ))}
          <span onClick={() => router.push('/ask')} style={{ display: 'inline-block', marginTop: 20, fontSize: 14, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}>Expand any insight →</span>
        </section>
        <section style={{ minWidth: 0 }}>
          {secHead('Revenue Loop', mono('live'))}
          {loopRows.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, padding: '20px 0 14px', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 15, color: 'var(--ink)' }}>{l.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{l.sub}</div>
              </div>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.04em', fontSize: 36, lineHeight: 1, color: l.color, fontVariantNumeric: 'tabular-nums' }}>{l.value}</div>
            </div>
          ))}
        </section>
        <section style={{ minWidth: 0 }}>
          {secHead('Activity', mono('signal events'))}
          {activityRows.length === 0 && <div style={{ padding: '22px 0', fontSize: 14, color: 'var(--ink-faint)' }}>Activity appears as signals arrive.</div>}
          {activityRows.map(sg => (
            <div key={sg.id} onClick={() => router.push(`/signals?signal=${sg.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--wash, #F4F0E8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ACT_ICONS[sg.source_integration || ''] ?? <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>{(sg.source_integration || '?').slice(0, 2)}</span>}</div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45 }}>
                {sg.status === 'handled' && <span style={{ color: 'var(--good)', fontWeight: 800 }}>✓ </span>}
                {sg.account_name ? <strong style={{ fontWeight: 600 }}>{sg.account_name}</strong> : null}{sg.account_name ? ' — ' : ''}{sg.title}
              </div>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--ink-faint)', flexShrink: 0 }}>{ago(sg.created_at)}</span>
            </div>
          ))}
        </section>
      </div>

      {/* Accounts needing attention — design AccountTable grid (no <table>,
          never scrolls sideways; text tracks truncate before the action button) */}
      <div style={{ marginTop: 80 }}>
        {(() => {
          const COLS = '30px minmax(90px,1.5fr) minmax(52px,.62fr) minmax(50px,.58fr) minmax(56px,.8fr) minmax(70px,1.2fr) minmax(44px,.5fr) 104px'
          const cell: React.CSSProperties = { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
          const openT = signals.filter(sg => !sg.is_dismissed && (!sg.status || sg.status === 'open'))
          const byAcct = new Map<string, Signal[]>()
          for (const sg of openT) if (sg.account_name) { const a = byAcct.get(sg.account_name) ?? []; a.push(sg); byAcct.set(sg.account_name, a) }
          const ACTION_LABEL: Record<string, string> = {
            silent_stall: 'Draft email', call_objection: 'Send redline', price_flinch: 'Share ROI', competitor_mention: 'Send compare',
            legal_loopin: 'Send redline', champion_change: 'Map contact', timeline_slip: 'Confirm date', meeting_cancelled: 'Schedule call',
            meeting_declined: 'Schedule call', deal_stage_backward: 'Schedule call', call_buying_signal: 'Fast-track',
            call_commitment: 'Confirm', reengaged: 'Fast-track', commitment_overdue: 'Close out', call_sentiment_drop: 'Schedule call',
          }
          const rows = accounts.map(a => {
            const sigs = byAcct.get(a.name) ?? []
            const dark = a.last_contact_date ? Math.floor((Date.now() - new Date(a.last_contact_date).getTime()) / 86400000) : null
            const nHigh = sigs.filter(x => x.severity === 'high').length
            const nWatch = sigs.filter(x => x.severity === 'watch').length
            const nPos = sigs.filter(x => x.severity === 'positive').length
            const top = sigs.find(x => x.severity === 'high') ?? sigs[0] ?? null
            const risk = (a.risk_level || (nHigh ? 'high' : nWatch ? 'medium' : 'low')) as 'high' | 'medium' | 'low'
            const health = (a.health_score != null && a.health_score > 0) ? a.health_score : Math.max(25, Math.min(95, 90 - nHigh * 18 - nWatch * 6 + nPos * 4))
            return { a, sigs, dark, top, risk, health, score: attentionScore(sigs, dark, soon48.has(a.name)) }
          }).filter(r => r.score > 0).sort((x, y) => y.score - x.score).slice(0, 6)
          if (!rows.length) return null
          const riskColor = { high: 'var(--critical, #c43d2b)', medium: 'var(--warn, #d38b1d)', low: 'var(--good, #2f8f5b)' }
          return (
            <>
              {secHead('Accounts needing attention', <span onClick={() => router.push('/portfolio')} style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}>View all {accounts.length} accounts →</span>)}
              <div style={{ display: 'grid', gridTemplateColumns: COLS, columnGap: 6, padding: '14px 0 8px', fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                <span>Hlth</span><span style={{ paddingLeft: 26 }}>Account</span><span>ARR</span><span>Risk</span>
                <span>Stage</span><span>Top Signal</span><span>Touch</span><span />
              </div>
              {rows.map(({ a, sigs, dark, top, risk, health }) => (
                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: COLS, columnGap: 6, alignItems: 'center', padding: '14px 0', borderTop: '1px solid var(--hairline, #EFEAE1)', fontSize: 11.5, lineHeight: 1.35 }}>
                  <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, letterSpacing: '-.03em', fontSize: 21, color: riskColor[risk], fontVariantNumeric: 'tabular-nums' }}>{health}</span>
                  <div style={{ minWidth: 0, paddingLeft: 26 }}>
                    <span onClick={() => router.push(`/accounts?open=${encodeURIComponent(a.name)}`)} style={{ ...cell, display: 'block', fontWeight: 600, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer' }}>{a.name}</span>
                    <div style={{ ...cell, fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{a.domain || ''}</div>
                  </div>
                  <span style={{ ...cell, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{a.value ? formatCurrency(Number(a.value)) : '--'}</span>
                  <span style={{ ...cell, fontSize: 11.5, color: riskColor[risk], display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', flex: 'none', background: riskColor[risk] }} /><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.1px' }}>{risk === 'medium' ? 'MED' : risk.toUpperCase()}</span>
                  </span>
                  <span style={{ ...cell, color: 'var(--ink)' }}>{a.stage || '--'}</span>
                  <span style={{ ...cell, color: top ? riskColor[top.severity === 'high' ? 'high' : top.severity === 'positive' ? 'low' : 'medium'] : 'var(--ink-faint)' }}>{top?.title || '--'}</span>
                  <span style={{ ...cell, color: 'var(--ink-muted)' }}>{dark != null ? (dark === 0 ? 'today' : `${dark}d`) : '--'}</span>
                  <button onClick={() => top ? router.push(`/signals?signal=${top.id}&action=reply`) : router.push(`/accounts?open=${encodeURIComponent(a.name)}`)}
                    title={top ? (ACTION_LABEL[top.signal_type || ''] || 'Follow up') : 'Open'}
                    style={{ font: 'inherit', fontSize: 12, fontWeight: 500, width: 104, padding: '8px 0', borderRadius: 999, border: 0, background: 'var(--accent-tint, #FFF1EA)', color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {top ? (ACTION_LABEL[top.signal_type || ''] || 'Follow up') : 'Open account'}
                  </button>
                </div>
              ))}
            </>
          )
        })()}
      </div>

      <div style={{ height: 60 }}></div>
    </div>
  )
}
