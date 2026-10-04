'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CONCERN_ACTIONS, CONCERN_LABELS } from '@/lib/concern-labels'
import { dueLabel, deriveDueAt, type Severity } from '@/packages/popsicle-shared/severity'
import { SourceIcon } from '@/components/pk/SourceIcon'

type Feed = {
  id: string; account_name: string | null; signal_type: string | null; severity: string | null
  title: string | null; description: string | null; source_integration: string | null
  created_at: string | null; due_at: string | null; handled_at: string | null
  handled_action: string | null; risk_amount: number | null; locked?: boolean | null
}
type Send = {
  id: string; account_name: string | null; subject: string | null; to_email: string | null
  mode: string | null; approved_by: string | null; created_at: string | null; signal_id: string | null
}

const label = (t: string | null) => CONCERN_LABELS[String(t)] ?? 'Concern'
const action = (t: string | null) => CONCERN_ACTIONS[String(t)] ?? 'Follow up'

export function ActionsReal({ open, handled, sends }: { open: Feed[]; handled: Feed[]; sends: Send[] }) {
  const router = useRouter()
  const [mounted] = useState(true)

  // what needs a person: soonest first, and anything overdue at the top
  const queue = useMemo(() => {
    return [...open]
      .map(s => {
        const due = s.due_at ?? deriveDueAt((s.severity ?? 'watch') as Severity, new Date(s.created_at ?? Date.now()))
        return { s, d: dueLabel(due) }
      })
      .filter(x => x.s.severity !== 'positive')
      .sort((a, b) => (a.d?.minutes ?? 1e9) - (b.d?.minutes ?? 1e9))
      .slice(0, 12)
  }, [open])

  // what Popsicle did on its own: a send with no approver, plus anything it closed out
  const automatic = useMemo(() => {
    const fromSends = sends.filter(x => !x.approved_by).map(x => ({
      key: `send-${x.id}`, when: x.created_at, account: x.account_name,
      what: `Sent "${x.subject ?? 'a follow-up'}"${x.to_email ? ` to ${x.to_email}` : ''}`,
      kind: 'sent' as const, signal: x.signal_id,
    }))
    const fromHandled = handled.filter(h => h.handled_action && /auto|popsicle/i.test(h.handled_action)).map(h => ({
      key: `auto-${h.id}`, when: h.handled_at, account: h.account_name,
      what: `${label(h.signal_type)} closed: ${h.handled_action}`, kind: 'closed' as const, signal: h.id,
    }))
    return [...fromSends, ...fromHandled].sort((a, b) => String(b.when).localeCompare(String(a.when))).slice(0, 10)
  }, [sends, handled])

  // what the team did, with Popsicle's draft behind it
  const withYou = useMemo(() => {
    const approved = sends.filter(x => x.approved_by).map(x => ({
      key: `ap-${x.id}`, when: x.created_at, account: x.account_name,
      what: `Sent "${x.subject ?? 'a follow-up'}" after you approved it`, signal: x.signal_id,
    }))
    const closed = handled.filter(h => !h.handled_action || !/auto|popsicle/i.test(h.handled_action)).map(h => ({
      key: `h-${h.id}`, when: h.handled_at, account: h.account_name,
      what: `${label(h.signal_type)}${h.handled_action ? ` · ${h.handled_action}` : ' handled'}`, signal: h.id,
    }))
    return [...approved, ...closed].sort((a, b) => String(b.when).localeCompare(String(a.when))).slice(0, 10)
  }, [sends, handled])

  const when = (iso: string | null | undefined) => {
    if (!iso || !mounted) return ''
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    return mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.round(mins / 60)}h ago` : `${Math.round(mins / 1440)}d ago`
  }

  const head = (title: string, note: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
      <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 21, letterSpacing: '-.03em', margin: 0, color: 'var(--ink)' }}>{title}</h2>
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{note}</span>
    </div>
  )

  const overdue = queue.filter(x => x.d?.tone === 'overdue').length

  return (
    <div className="dsk-screen on">
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.8px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
        Actions · {queue.length} waiting on you
      </span>
      <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(23px,2.4vw,30px)', letterSpacing: '-.035em', lineHeight: 1.2, margin: '12px 0 0', maxWidth: '38ch', color: 'var(--ink)' }}>
        {queue.length === 0
          ? <>Nothing is waiting on you. <span style={{ color: 'var(--ink-muted)' }}>Popsicle is still watching.</span></>
          : <>{queue.length} {queue.length === 1 ? 'thing needs' : 'things need'} you{overdue > 0 ? <>, <span style={{ color: 'var(--critical, #c43d2b)' }}>{overdue} already overdue</span></> : ''}. <span style={{ color: 'var(--ink-muted)' }}>{automatic.length} handled without you since.</span></>}
      </h1>

      <section style={{ marginTop: 'var(--gap-l, 40px)' }}>
        {head('Waiting on you', 'drafted and ready')}
        {queue.map(({ s, d }) => {
          const locked = !!s.locked
          return (
            <div key={s.id} className="tbl-row askable" onClick={() => router.push(`/concerns?signal=${s.id}`)}
              style={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1fr) 128px 118px', gap: 16, alignItems: 'center', padding: '15px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: 'pointer' }}>
              <SourceIcon name={s.source_integration ?? ''} size={26} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--ink)' }}>{s.account_name ?? 'Account'}</span>
                  <span style={{ fontSize: 13.5, color: s.severity === 'high' ? 'var(--critical, #c43d2b)' : 'var(--warn, #d38b1d)' }}>{label(s.signal_type)}</span>
                </span>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {locked ? 'Unlock to read what was said' : (s.description || s.title || '')}
                </span>
              </span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase',
                color: d?.tone === 'overdue' ? 'var(--critical, #c43d2b)' : d?.tone === 'soon' ? 'var(--accent)' : 'var(--ink-faint)' }}>
                {d?.text ?? ''}
              </span>
              <button onClick={e => { e.stopPropagation(); router.push(`/concerns?signal=${s.id}`) }}
                style={{ font: 'inherit', fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 0, cursor: 'pointer', whiteSpace: 'nowrap',
                  border: 0, background: 'linear-gradient(135deg,#FF8A50,#E85A25)', color: '#fff' }}>
                {locked ? 'Unlock' : action(s.signal_type)}
              </button>
            </div>
          )
        })}
        {queue.length === 0 && <div style={{ padding: '18px 0', fontSize: 14, color: 'var(--ink-muted)' }}>Nothing open needs a reply right now.</div>}
      </section>

      <section style={{ marginTop: 'var(--gap-l, 40px)' }}>
        {head('Popsicle handled these', 'no one asked it to')}
        {automatic.map(a => (
          <div key={a.key} className="tbl-row" onClick={() => a.signal && router.push(`/concerns?signal=${a.signal}`)}
            style={{ display: 'grid', gridTemplateColumns: '3px minmax(0,1fr) 90px', gap: 16, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: a.signal ? 'pointer' : 'default' }}>
            <span aria-hidden style={{ alignSelf: 'stretch', background: 'var(--good, #2f8f5b)' }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, color: 'var(--ink)' }}>{a.what}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{a.account ?? ''}</span>
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: 'var(--ink-faint)', textAlign: 'right' }}>{when(a.when)}</span>
          </div>
        ))}
        {automatic.length === 0 && (
          <div style={{ padding: '18px 0', fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, maxWidth: '62ch' }}>
            Nothing yet. Popsicle acts on its own only where you allow it.{' '}
            <a href="/settings?sheet=auto" style={{ color: 'var(--accent)', textDecoration: 'none', borderBottom: '1px solid rgba(232,90,37,.35)' }}>Choose what it may do</a>
            {' '}— closing Concerns the reply already answered and parking noise are the safe ones to start with. Everything it does appears here.
          </div>
        )}
      </section>

      <section style={{ marginTop: 'var(--gap-l, 40px)' }}>
        {head('Done with you', 'your approvals and closes')}
        {withYou.map(a => (
          <div key={a.key} className="tbl-row" onClick={() => a.signal && router.push(`/concerns?signal=${a.signal}`)}
            style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 90px', gap: 16, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: a.signal ? 'pointer' : 'default' }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, color: 'var(--ink)' }}>{a.what}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{a.account ?? ''}</span>
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: 'var(--ink-faint)', textAlign: 'right' }}>{when(a.when)}</span>
          </div>
        ))}
        {withYou.length === 0 && <div style={{ padding: '18px 0', fontSize: 14, color: 'var(--ink-muted)' }}>Nothing closed yet this period.</div>}
      </section>
    </div>
  )
}
