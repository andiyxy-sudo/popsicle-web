'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEscape } from '@/components/ui/useEscape'
import { createClient } from '@/lib/supabase/client'

// Daily Slack briefing: pick a channel and a time, and Popsicle posts the day's top 5 risks there.
// Optionally, each linked deal channel gets its own update on days something changed on that deal.
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
type Settings = { enabled: boolean; channel_id: string | null; channel_name: string | null; send_hour: number; timezone: string; deal_updates: boolean }
type Channel = { id: string; name: string }
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString('en-US', { hour: 'numeric' })

// render Slack's markdown for the preview: *bold*, _italic_, <url|text>
function Mrkdwn({ text }: { text: string }) {
  return <>{text.split('\n').map((line, i) => {
    const parts = line.split(/(\*[^*]+\*|_[^_]+_|<[^>|]+\|[^>]+>)/g).filter(Boolean).map((p, k) => {
      if (/^\*[^*]+\*$/.test(p)) return <b key={k}>{p.slice(1, -1)}</b>
      if (/^_[^_]+_$/.test(p)) return <i key={k}>{p.slice(1, -1)}</i>
      const m = /^<([^>|]+)\|([^>]+)>$/.exec(p); if (m) return <a key={k} href={m[1]} target="_blank" rel="noreferrer">{m[2]}</a>
      return <span key={k}>{p}</span>
    })
    return <div key={i} className="sd-line" style={{ paddingLeft: /^\s{2,}/.test(line) ? 18 : 0 }}>{line.trim() ? parts : '\u00a0'}</div>
  })}</>
}

export function SlackDigest() {
  const [demo, setDemo] = useState(false)
  const [s, setS] = useState<Settings | null>(null)
  const [preview, setPreview] = useState('')
  const [channels, setChannels] = useState<Channel[]>([])
  const [note, setNote] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const tz = useMemo(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'UTC' } }, [])

  useEffect(() => {
    fetch('/api/slack/digest').then(r => r.ok ? r.json() : null).then(j => {
      if (!j) return
      let st: Settings = j.settings
      setDemo(!!j.demo)
      if (j.demo) setChannels([{ id: 'C-demo-1', name: 'sales-leadership' }, { id: 'C-demo-2', name: 'revenue-team' }, { id: 'C-demo-3', name: 'acme-renewal' }, { id: 'C-demo-4', name: 'meridian-renewal' }])
      if (j.demo) { try { const loc = JSON.parse(localStorage.getItem('demo:digest') || 'null'); if (loc) st = loc } catch { /* ignore */ } }
      setS({ ...st, timezone: st.timezone && st.timezone !== 'UTC' ? st.timezone : tz }); setPreview(j.preview); if (j.note) setNote(j.note)
    }).catch(() => {})
    ;(async () => {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        if (!session || session.user?.email === 'demo@popsicle-labs.app') return
        const r = await fetch(`${SUPA_URL}/functions/v1/slack-channels`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: 'list' }) })
        const d = await r.json()
        const list = (d?.channels ?? []) as Array<{ id?: string; channel_id?: string; name?: string; channel_name?: string }>
        setChannels(list.map(c => ({ id: String(c.id ?? c.channel_id), name: String(c.name ?? c.channel_name ?? '') })).filter(c => c.id && c.name))
      } catch { /* the list is optional; saving still works once one exists */ }
    })()
  }, [tz])

  if (!s) return null
  const set = (p: Partial<Settings>) => { setS({ ...s, ...p }); setMsg('') }
  const save = async () => {
    setBusy(true); setMsg('')
    if (demo) { try { localStorage.setItem('demo:digest', JSON.stringify(s)) } catch { /* ignore */ } setBusy(false); setMsg('Saved.'); return }
    const r = await fetch('/api/slack/digest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save', ...s }) })
    const j = await r.json().catch(() => ({})); setBusy(false); setMsg(r.ok ? 'Saved.' : j.error ?? 'Couldn\u2019t save.')
  }
  const test = async () => {
    setBusy(true); setMsg('')
    const r = await fetch('/api/slack/digest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'test' }) })
    const j = await r.json().catch(() => ({})); setBusy(false); setMsg(r.ok ? `Sent to #${s.channel_name}.` : j.error ?? 'Couldn\u2019t send.')
  }

  return (
    <section className="sd">
      <div className="sd-head"><h2>Daily Slack briefing</h2><span>{s.enabled && s.channel_name ? `on · #${s.channel_name} at ${hourLabel(s.send_hour)}` : 'off'}</span></div>
      <div className="sd-grid">
        <div className="sd-form">
          <p className="sd-intro">Each morning Popsicle posts the day&apos;s top 5 risks to one channel: the account, the money, the lead signal in the buyer&apos;s words, and a link back.</p>
          <label className="sd-toggle">
            <input type="checkbox" checked={s.enabled} onChange={e => set({ enabled: e.target.checked })} />
            <span className="sd-switch" aria-hidden /><span>Post the daily briefing</span>
          </label>
          <div className="sd-row">
            <label className="sd-field"><span>Channel</span>
              <select value={s.channel_id ?? ''} onChange={e => { const c = channels.find(x => x.id === e.target.value); set({ channel_id: c?.id ?? null, channel_name: c?.name ?? null }) }}>
                <option value="">Choose a channel</option>
                {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </label>
            <label className="sd-field sd-time"><span>Time</span>
              <select value={s.send_hour} onChange={e => set({ send_hour: Number(e.target.value) })}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
            </label>
          </div>
          <div className="sd-tz">Your time zone: {s.timezone}</div>
          <label className="sd-toggle">
            <input type="checkbox" checked={s.deal_updates} onChange={e => set({ deal_updates: e.target.checked })} />
            <span className="sd-switch" aria-hidden />
            <span>Also post a daily update in each linked deal channel<em>Only on days something changed on that deal, so the channel never gets noise.</em></span>
          </label>
          <div className="sd-actions">
            <button className="sd-save" onClick={save} disabled={busy || (s.enabled && !s.channel_id)}>Save</button>
            <button className="sd-test" onClick={test} disabled={busy || !s.channel_id}>Send a test now</button>
            {msg && <span className="sd-msg">{msg}</span>}
          </div>
          {note && <p className="sd-note">{note}</p>}
          {s.channel_name && <p className="sd-note">Make sure Popsicle is in #{s.channel_name}: in Slack, type /invite and pick Popsicle.</p>}
        </div>
        <div className="sd-preview" aria-label="Preview">
          <div className="sd-prev-k">Preview{s.channel_name ? ` · #${s.channel_name}` : ''}</div>
          <div className="sd-msg-card">
            <div className="sd-msg-from"><span className="sd-av">P</span><b>Popsicle</b><em>APP · {hourLabel(s.send_hour)}</em></div>
            <div className="sd-msg-body"><Mrkdwn text={preview} /></div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** The briefing settings in their own full window, opened from Slack's settings. */
export function BriefingWindow({ onClose }: { onClose: () => void }) {
  useEscape(true, onClose)
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="sdw" role="dialog" aria-label="Daily Slack briefing settings">
      <div className="sdw-bar">
        <span className="sdw-k">Slack · Daily briefing settings</span>
        <button className="sdw-x" onClick={onClose} aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="sdw-body"><SlackDigest /></div>
    </div>, document.body)
}

