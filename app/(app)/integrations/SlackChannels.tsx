'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

type Channel = {
  channel_id: string
  name: string
  is_private: boolean
  is_member: boolean
  member_count: number | null
  is_external: boolean
}
type Account = { id: string; name: string }

function prettify(channelName: string): string {
  return channelName.replace(/[-_]+/g, ' ').split(' ').filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// The Slack channel picker with ACCOUNT LINKING. Self-contained: fetches the
// workspace channels + the user's accounts, pre-checks tracked channels and
// their existing links, lets the user toggle channels and link each selected
// channel to an account (or spin up a new account named after the channel),
// then saves everything back. Linking is what turns a channel's messages into
// account intelligence: comms show up in the Account 360 and detection tags
// signals with the account's real name (including retroactively for messages
// already synced).
export function SlackChannelPicker({ onCancel, onSaved }: { onCancel: () => void; onSaved: (count: number) => void }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingLabel, setSavingLabel] = useState('Saving...')
  const [error, setError] = useState<string | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // channel_id -> account id, or 'new' (create an account named after the channel)
  const [links, setLinks] = useState<Record<string, string>>({})
  const [q, setQ] = useState('')

  async function token(): Promise<string | null> {
    const { data: { session } } = await createClient().auth.getSession()
    return session?.access_token ?? null
  }

  async function load() {
    setLoading(true); setError(null)
    try {
      const t = await token()
      if (!t) { window.location.href = '/login'; return }
      const res = await fetch(`${SUPA_URL}/functions/v1/slack-channels`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
        body: JSON.stringify({ action: 'list' }),
      })
      const data = await res.json()
      if (!res.ok || data?.error) {
        setError(data?.error === 'needs_reconnect'
          ? 'Slack needs reconnecting. Disconnect and connect Slack again to refresh access.'
          : (data?.detail || data?.error || 'Could not load channels.'))
        setChannels([])
      } else {
        setChannels(data.channels || [])
        setAccounts(data.accounts || [])
        setSelected(new Set<string>(data.tracked || []))
        // Auto-suggest links: a channel like #proj-kata pre-links to the
        // account "Kata" when the names overlap. Existing links win; the user
        // can always change or clear a suggestion before saving.
        const links: Record<string, string> = { ...(data.links || {}) }
        const accList: Account[] = data.accounts || []
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
        for (const c of (data.channels || []) as Channel[]) {
          if (links[c.channel_id]) continue
          const chNorm = norm(c.name)
          const chTokens = c.name.toLowerCase().split(/[-_\s]+/).filter(w => w.length >= 4)
          for (const a of accList) {
            const aFirst = norm(String(a.name).split(' ')[0])
            if (aFirst.length >= 4 && (chNorm.includes(aFirst) || chTokens.some(t => norm(a.name).includes(t)))) {
              links[c.channel_id] = a.id
              break
            }
          }
        }
        setLinks(links)
      }
    } catch {
      setError('Network error loading channels. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function setLink(id: string, val: string) {
    setLinks(prev => {
      const next = { ...prev }
      if (val) next[id] = val; else delete next[id]
      return next
    })
  }

  async function save() {
    setSaving(true); setError(null)
    try {
      const t = await token()
      if (!t) { window.location.href = '/login'; return }
      const chosen = channels.filter(c => selected.has(c.channel_id))

      // Create any "new" accounts first (named after their channel), collecting
      // the resulting ids so the links point at real rows.
      const resolved: Record<string, string> = {}
      const newOnes = chosen.filter(c => links[c.channel_id] === 'new')
      for (let i = 0; i < newOnes.length; i++) {
        const c = newOnes[i]
        setSavingLabel(`Creating ${prettify(c.name)}...`)
        const r = await fetch(`${SUPA_URL}/functions/v1/enrich-account`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
          body: JSON.stringify({ account_name: prettify(c.name) }),
        })
        const j = await r.json().catch(() => ({}))
        if (r.ok && j.account_id) resolved[c.channel_id] = j.account_id
      }

      setSavingLabel('Saving...')
      const payload = chosen.map(c => {
        const link = links[c.channel_id]
        const accountId = link === 'new' ? (resolved[c.channel_id] || null) : (link || null)
        return { channel_id: c.channel_id, channel_name: c.name, is_external: c.is_external, linked_account_id: accountId }
      })
      const res = await fetch(`${SUPA_URL}/functions/v1/slack-channels`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
        body: JSON.stringify({ action: 'set-tracked', channels: payload }),
      })
      const data = await res.json()
      if (!res.ok || data?.error) { setError(data?.detail || data?.error || 'Could not save.'); setSaving(false); return }
      onSaved(payload.length)
    } catch {
      setError('Network error saving. Try again.')
      setSaving(false)
    }
  }

  const filtered = q.trim()
    ? channels.filter(c => c.name.toLowerCase().includes(q.trim().toLowerCase()))
    : channels

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.5, marginBottom: 14 }}>
        Choose the channels Popsicle should read. Link a channel to an account and its conversations feed that account&apos;s intelligence.
      </div>

      {!loading && !error && channels.length > 6 && (
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search channels"
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--inset)', color: 'var(--t1)', fontSize: 13, fontFamily: "'Outfit',sans-serif", marginBottom: 10, outline: 'none' }}
        />
      )}

      {!loading && !error && channels.length > 1 && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
          <button onClick={() => setSelected(new Set(channels.map(c => c.channel_id)))} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: 'var(--o)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Select all</button>
          <button onClick={() => setSelected(new Set())} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: 'var(--t3)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Clear</button>
        </div>
      )}

      <div style={{ maxHeight: 320, overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--t3)', fontSize: 13 }}>Loading channels...</div>
        )}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '20px 8px' }}>
            <div style={{ fontSize: 13, color: 'var(--danger)', lineHeight: 1.55, marginBottom: 12 }}>{error}</div>
            <button onClick={load} style={{ padding: '7px 16px', borderRadius: 9, background: 'var(--inset)', border: '1px solid var(--border)', color: 'var(--t1)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Try again</button>
          </div>
        )}

        {!loading && !error && channels.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--t3)', fontSize: 13, lineHeight: 1.55 }}>
            No channels found yet. Add the Popsicle app to the channels you want to track in Slack, then tap Refresh.
          </div>
        )}

        {!loading && !error && filtered.map(c => {
          const on = selected.has(c.channel_id)
          const link = links[c.channel_id] || ''
          return (
            <div key={c.channel_id} style={{ borderRadius: 10, background: on ? 'rgba(255,107,53,.06)' : 'transparent', marginBottom: 2 }}>
              <div
                onClick={() => toggle(c.channel_id)}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 10px', cursor: 'pointer' }}
              >
                <div style={{ width: 20, height: 20, borderRadius: 6, border: on ? 'none' : '1.5px solid var(--border)', background: on ? 'var(--o)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--t3)' }}>{c.is_private ? '\uD83D\uDD12' : '#'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    {c.is_external && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--o)', background: 'rgba(255,107,53,.1)', padding: '1px 6px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '.5px', flexShrink: 0 }}>External</span>}
                  </div>
                </div>
                {c.member_count != null && <div style={{ fontSize: 11, color: 'var(--t4)', flexShrink: 0 }}>{c.member_count}</div>}
              </div>
              {/* Account link row for selected channels */}
              {on && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 10px 41px' }} onClick={e => e.stopPropagation()}>
                  <span style={{ fontSize: 10.5, color: 'var(--t4)', fontWeight: 700, flexShrink: 0 }}>Account</span>
                  <select
                    value={link}
                    onChange={e => setLink(c.channel_id, e.target.value)}
                    style={{ flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inset)', color: link ? 'var(--t1)' : 'var(--t3)', fontSize: 11.5, fontWeight: 600, fontFamily: "'Outfit',sans-serif", outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Not linked</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    <option value="new">New account: {prettify(c.name)}</option>
                  </select>
                </div>
              )}
            </div>
          )
        })}

        {!loading && !error && q.trim() && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--t3)', fontSize: 12 }}>No channels match &quot;{q}&quot;.</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>{selected.size} selected</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} disabled={saving} style={{ padding: '9px 16px', borderRadius: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--t2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
          <button onClick={save} disabled={saving || loading || !!error} style={{ padding: '9px 18px', borderRadius: 10, background: 'var(--o)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving || loading ? 'default' : 'pointer', fontFamily: "'Outfit',sans-serif", opacity: saving || loading || error ? 0.6 : 1 }}>{saving ? savingLabel : 'Save channels'}</button>
        </div>
      </div>
    </div>
  )
}
