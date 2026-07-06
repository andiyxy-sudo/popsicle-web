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

// The Slack channel picker. Self-contained: fetches the workspace channels,
// pre-checks the ones already tracked, lets the user toggle, and saves the
// selection back to slack_tracked_channels. Owns its own action buttons so the
// selection state stays co-located (the modal passes footer:null for this body).
export function SlackChannelPicker({ onCancel, onSaved }: { onCancel: () => void; onSaved: (count: number) => void }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
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
        setSelected(new Set<string>(data.tracked || []))
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

  async function save() {
    setSaving(true); setError(null)
    try {
      const t = await token()
      if (!t) { window.location.href = '/login'; return }
      const chosen = channels.filter(c => selected.has(c.channel_id))
        .map(c => ({ channel_id: c.channel_id, channel_name: c.name, is_external: c.is_external }))
      const res = await fetch(`${SUPA_URL}/functions/v1/slack-channels`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
        body: JSON.stringify({ action: 'set-tracked', channels: chosen }),
      })
      const data = await res.json()
      if (!res.ok || data?.error) { setError(data?.detail || data?.error || 'Could not save.'); setSaving(false); return }
      onSaved(chosen.length)
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
        Choose the channels Popsicle should read. Only these are scanned for revenue signals. You can change this any time.
      </div>

      {!loading && !error && channels.length > 6 && (
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search channels"
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--inset)', color: 'var(--t1)', fontSize: 13, fontFamily: "'Outfit',sans-serif", marginBottom: 10, outline: 'none' }}
        />
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
          return (
            <div
              key={c.channel_id}
              onClick={() => toggle(c.channel_id)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 10px', borderRadius: 10, cursor: 'pointer', background: on ? 'rgba(255,107,53,.06)' : 'transparent', marginBottom: 2 }}
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
          )
        })}

        {!loading && !error && q.trim() && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--t3)', fontSize: 12 }}>No channels match "{q}".</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>{selected.size} selected</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} disabled={saving} style={{ padding: '9px 16px', borderRadius: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--t2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
          <button onClick={save} disabled={saving || loading || !!error} style={{ padding: '9px 18px', borderRadius: 10, background: 'var(--o)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving || loading ? 'default' : 'pointer', fontFamily: "'Outfit',sans-serif", opacity: saving || loading || error ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save channels'}</button>
        </div>
      </div>
    </div>
  )
}
