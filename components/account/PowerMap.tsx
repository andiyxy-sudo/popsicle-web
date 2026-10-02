'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Who decides, who is on your side, and who is in the way. Read from contact_roles, which
// infer-contact-roles fills in from the actual mail. Two rules the mobile app also keeps:
// the person using Popsicle is never in their own power map, and neither is anyone at their company.
type Role = {
  contact_email: string
  contact_name: string | null
  display_name: string | null
  title: string | null
  stance: string | null
  reports_to: string | null
  confirmed: boolean | null
  hidden: boolean | null
}

const STANCE: Record<string, { label: string; color: string }> = {
  champion: { label: 'Champion', color: 'var(--good, #2f8f5b)' },
  supporter: { label: 'Supporter', color: 'var(--good, #2f8f5b)' },
  blocker: { label: 'Blocker', color: 'var(--critical, #c43d2b)' },
  skeptic: { label: 'Skeptic', color: 'var(--warn, #d38b1d)' },
  decision_maker: { label: 'Decides', color: 'var(--accent, #E85A25)' },
  neutral: { label: 'Neutral', color: 'var(--ink-faint, #A09C97)' },
}

export function PowerMap({ accountName }: { accountName: string }) {
  const [roles, setRoles] = useState<Role[] | null>(null)
  const [myDomain, setMyDomain] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    let dead = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setMyDomain((user.email ?? '').split('@')[1] ?? '')
      const { data } = await supabase.from('contact_roles')
        .select('contact_email, contact_name, display_name, title, stance, reports_to, confirmed, hidden')
        .eq('user_id', user.id).eq('account_name', accountName)
      if (!dead) setRoles((data ?? []) as Role[])
    })()
    return () => { dead = true }
  }, [accountName])

  async function save(email: string, patch: Partial<Role>) {
    setRoles(rs => (rs ?? []).map(r => r.contact_email === email ? { ...r, ...patch } : r))
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('contact_roles').update(patch).eq('user_id', user.id).eq('account_name', accountName).eq('contact_email', email)
  }

  if (!roles) return null
  // never the person themselves, never their own colleagues, never anyone they removed
  const people = roles.filter(r => {
    const dom = (r.contact_email ?? '').split('@')[1] ?? ''
    return !r.hidden && dom && dom !== myDomain
  })
  if (!people.length) return null

  const order = ['decision_maker', 'champion', 'supporter', 'neutral', 'skeptic', 'blocker']
  people.sort((a, b) => order.indexOf(String(a.stance)) - order.indexOf(String(b.stance)))

  return (
    <section style={{ marginTop: 'var(--gap-l, 40px)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--rule-strong, #0E0D0B)' }}>
        <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 21, letterSpacing: '-.03em', margin: 0, color: 'var(--ink)' }}>Power map</h2>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          {people.length} {people.length === 1 ? 'person' : 'people'}
        </span>
      </div>

      {people.map(p => {
        const name = p.display_name || p.contact_name || p.contact_email.split('@')[0]
        const st = STANCE[String(p.stance)] ?? STANCE.neutral
        const boss = p.reports_to ? people.find(x => x.contact_email === p.reports_to) : null
        return (
          <div key={p.contact_email} className="tbl-row"
            style={{ display: 'grid', gridTemplateColumns: '3px minmax(0,1fr) 120px 76px', gap: 16, alignItems: 'center', padding: '15px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)' }}>
            <span aria-hidden style={{ alignSelf: 'stretch', background: st.color, opacity: p.stance === 'neutral' || !p.stance ? 0.25 : 1 }} />
            <span style={{ minWidth: 0 }}>
              {editing === p.contact_email ? (
                <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
                  onBlur={() => { save(p.contact_email, { display_name: draft.trim() || null }); setEditing(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null) }}
                  style={{ font: 'inherit', fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', background: 'transparent', border: 0, borderBottom: '1px solid var(--accent)', outline: 'none', width: '100%', padding: '2px 0' }} />
              ) : (
                <span onClick={() => { setEditing(p.contact_email); setDraft(name) }} title="Click to rename"
                  style={{ display: 'block', fontSize: 15.5, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--ink)', cursor: 'text' }}>{name}</span>
              )}
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>
                {p.title || p.contact_email}{boss ? ` · reports to ${boss.display_name || boss.contact_name || boss.contact_email.split('@')[0]}` : ''}
                {p.confirmed === false ? ' · unconfirmed' : ''}
              </span>
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.4px', textTransform: 'uppercase', color: st.color }}>{st.label}</span>
            <button className="pm-remove" onClick={() => save(p.contact_email, { hidden: true })}
              style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', background: 'none', border: 0, color: 'var(--ink-faint)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              remove
            </button>
          </div>
        )
      })}
    </section>
  )
}
