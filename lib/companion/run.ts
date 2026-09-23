'use client'

import { createClient } from '@/lib/supabase/client'
import { applyTheme } from '@/lib/theme'
import { label, type Action } from './actions'

// Performs a companion action in the browser and reports, truthfully, what happened.
// Anything Popsicle cannot finish itself (an OAuth approval, a not-yet-built feature) says so.
export type RunResult = { ok: boolean; done: string; navigated?: string }

const saveMeta = async (data: Record<string, unknown>) => {
  const { error } = await createClient().auth.updateUser({ data })
  if (error) throw new Error(error.message)
  window.dispatchEvent(new Event('settings:changed'))
}
const meta = async () => ((await createClient().auth.getUser()).data.user?.user_metadata ?? {}) as Record<string, unknown>

// the draft the companion is holding, so "send it" knows what to send
export type HeldDraft = { to: string; subject: string; body: string; signal_id?: string; account?: string } | null
let held: HeldDraft = null
export const heldDraft = () => held
export const holdDraft = (d: HeldDraft) => { held = d }

export async function runAction(a: Action, go: (path: string) => void): Promise<RunResult> {
  switch (a.id) {
    case 'connect_source': {
      const p = String(a.params.provider)
      go(`/integrations?connect=${p}`)
      return { ok: true, done: `Opened ${label(p)} on the Integrations page. Press Connect there and approve it on ${label(p)}'s own screen.`, navigated: '/integrations' }
    }
    case 'slack_channels': go('/integrations?slack_channels=1'); return { ok: true, done: 'Opened your Slack channel picker.', navigated: '/integrations' }
    case 'slack_briefing': go('/integrations?slack_briefing=1'); return { ok: true, done: 'Opened the daily briefing settings.', navigated: '/integrations' }
    case 'set_role': await saveMeta({ role: a.params.title }); return { ok: true, done: `Your title is now ${a.params.title}. Pulse will open on that view.` }
    case 'set_industry': await saveMeta({ industry: a.params.industry }); return { ok: true, done: `Industry saved as ${a.params.industry}.` }
    case 'set_quiet_hours': await saveMeta({ quiet_hours: { From: a.params.from, To: a.params.to } }); return { ok: true, done: `Quiet hours are ${a.params.from} to ${a.params.to}.` }
    case 'set_working_hours': await saveMeta({ work_start: a.params.start, work_end: a.params.end }); return { ok: true, done: `Working hours are ${a.params.start} to ${a.params.end}.` }
    case 'set_morning_time': await saveMeta({ morning_digest: a.params.at }); return { ok: true, done: `The morning brief will appear at ${a.params.at}.` }
    case 'set_threshold': {
      const t = { ...(((await meta()).thresholds ?? {}) as Record<string, string>), [String(a.params.key)]: String(a.params.value) }
      await saveMeta({ thresholds: t }); return { ok: true, done: `${a.params.key} is now ${a.params.value}.` }
    }
    case 'toggle_alert': {
      const n = { ...(((await meta()).notif_prefs ?? {}) as Record<string, boolean>), [String(a.params.key)]: !!a.params.on }
      await saveMeta({ notif_prefs: n })
      return { ok: true, done: `${({ risk: 'Risk alerts', digest: 'Weekly summary', brief: 'Pre-meeting briefs', push: 'Push notifications' } as Record<string, string>)[String(a.params.key)]} ${a.params.on ? 'on' : 'off'}.` }
    }
    case 'set_theme': {
      const m = String(a.params.mode)
      const prefs = { ...(((await meta()).prefs ?? {}) as Record<string, string>), Appearance: m }
      await saveMeta({ prefs }); applyTheme(m); return { ok: true, done: `${m} mode.` }
    }
    case 'set_easy_read': {
      const on = !!a.params.on
      try { localStorage.setItem('easyread', on ? '1' : '0') } catch { /* ignore */ }
      await saveMeta({ easy_read: on }); return { ok: true, done: on ? 'Easy read is on.' : 'Easy read is off.' }
    }
    case 'set_currency': {
      const prefs = { ...(((await meta()).prefs ?? {}) as Record<string, string>), Currency: String(a.params.code) }
      await saveMeta({ prefs }); setTimeout(() => window.location.reload(), 500)
      return { ok: true, done: `Amounts now show in ${a.params.code}. Reloading so every figure redraws.` }
    }
    case 'set_send_mode': {
      if (a.params.mode === 'with') { await saveMeta({ send_mode: 'with' }); return { ok: true, done: 'Every draft will wait for your approval.' } }
      go('/settings?panel=Sending')
      return { ok: true, done: 'Opened the sending policy. Automatic sending stays off until email sending is connected, so drafts still wait for you.', navigated: '/settings' }
    }
    case 'invite_teammate': {
      const r = await fetch('/api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: a.params.email, role: 'member' }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return { ok: false, done: `Couldn't invite ${a.params.email}: ${j.error ?? 'the invite failed'}.` }
      return { ok: true, done: `Invitation sent to ${a.params.email}.` }
    }
    case 'record_decision': {
      const r = await fetch('/api/decisions', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ account_name: a.params.account, decision: a.params.text, owner: a.params.owner ?? null, due_at: a.params.due ?? null, source: 'ask' }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return { ok: false, done: `Couldn't record that decision: ${j.error ?? 'it failed to save'}.` }
      return { ok: true, done: `Recorded on ${a.params.account}, with today's evidence attached.` }
    }
    case 'draft_reply': {
      const account = String(a.params.account ?? '')
      if (!account) return { ok: false, done: 'Tell me which account and I will draft it.' }
      const sr = await fetch(`/api/companion/signal?account=${encodeURIComponent(account)}`)
      const sig = await sr.json().catch(() => ({}))
      if (!sr.ok || !sig?.id) return { ok: false, done: `I have no open signal for ${account} to base a reply on.` }
      const r = await fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ signal_id: sig.id }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j?.body) return { ok: false, done: `I could not draft that: ${j?.error ?? 'the draft failed'}.` }
      holdDraft({ to: j.to, subject: j.subject, body: j.body, signal_id: sig.id, account })
      const preview = `To: ${j.to}\nSubject: ${j.subject}\n\n${j.body}`
      const tail = a.params.send
        ? 'You asked me to send it as well: say "send it" and it goes from your Gmail. I will not send anything you have not seen.'
        : 'Say "send it" and I will send it from your Gmail, or edit it on the Signals page.'
      return { ok: true, done: `Here it is, from "${sig.title}":\n\n${preview}\n\n${tail}` }
    }
    case 'send_draft': {
      const d = held
      if (!d) return { ok: false, done: 'I have no draft in hand. Ask me to draft one first.' }
      const r = await fetch('/api/send', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: d.to, subject: d.subject, body: d.body, signal_id: d.signal_id, account_name: d.account, mode: 'manual' }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j?.ok) return { ok: false, done: j?.reason ?? 'The send failed.' }
      held = null
      if (j.demo) return { ok: true, done: `Nothing actually left the building: ${j.note}` }
      return { ok: true, done: `Sent to ${d.to}${j.threaded ? ', in the existing thread' : ''}. Recorded against ${d.account ?? 'the account'}.` }
    }
    case 'start_review': go('/review'); return { ok: true, done: 'Review started.', navigated: '/review' }
    case 'export_data': go('/settings?panel=Data%20%26%20privacy'); return { ok: true, done: 'Opened Data & privacy: press Export everything.', navigated: '/settings' }
    case 'goto': go(String(a.params.path)); return { ok: true, done: `Opened ${String(a.params.path).replace('/', '')}.`, navigated: String(a.params.path) }
    default: return { ok: false, done: 'That one is not something I can do yet.' }
  }
}
