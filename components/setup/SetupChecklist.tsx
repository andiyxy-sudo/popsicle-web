'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// What a new workspace still needs, shown on Pulse until it is done. Five steps in the order they pay
// off: email first (little works without it), then accounts, then calendar and CRM, then where alerts
// land. It disappears for good once every step is met, and can be dismissed before that.
type Step = { key: string; label: string; why: string; done: boolean; go: string; cta: string }

export function SetupChecklist() {
  const router = useRouter()
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let dead = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      if ((user.user_metadata as Record<string, unknown>)?.setup_dismissed) { if (!dead) setHidden(true); return }

      const [{ data: integ }, { count: accounts }] = await Promise.all([
        supabase.from('integrations').select('provider, is_active').eq('user_id', user.id),
        supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ])
      const live = new Set((integ ?? []).filter((i: { is_active?: boolean }) => i.is_active !== false).map((i: { provider: string }) => String(i.provider)))
      const notif = (user.user_metadata as { notif_prefs?: Record<string, boolean> })?.notif_prefs ?? {}

      const next: Step[] = [
        { key: 'email', label: 'Connect your email', why: 'Where most Concerns come from', done: live.has('gmail') || live.has('outlook'), go: '/integrations', cta: 'Connect' },
        { key: 'accounts', label: 'Choose your accounts', why: 'Who Popsicle watches for you', done: (accounts ?? 0) > 0, go: '/welcome', cta: 'Choose' },
        { key: 'calendar', label: 'Add your calendar', why: 'Catches meetings that move or vanish', done: live.has('gcal'), go: '/integrations', cta: 'Add' },
        { key: 'crm', label: 'Connect your CRM', why: 'Deal values, stages and close dates', done: live.has('hubspot') || live.has('salesforce'), go: '/integrations', cta: 'Connect' },
        { key: 'alerts', label: 'Decide what interrupts you', why: 'Quiet hours, and what is worth a nudge', done: Object.keys(notif).length > 0, go: '/settings', cta: 'Set up' },
      ]
      if (!dead) setSteps(next)
    })()
    return () => { dead = true }
  }, [])

  async function dismiss() {
    setHidden(true)
    const supabase = createClient()
    await supabase.auth.updateUser({ data: { setup_dismissed: true } }).catch(() => {})
  }

  if (hidden || !steps) return null
  const done = steps.filter(s => s.done).length
  if (done === steps.length) return null              // finished: it never comes back

  const left = steps.filter(s => !s.done)
  const nextUp = left[0]

  return (
    <section className="pk-rise" style={{ marginBottom: 'var(--gap-l, 40px)' }}>
      {/* the same shape as every other section on this page: eyebrow, a sentence that says something,
          then rows under a rule. No tick circles, no strikethrough, no progress widget. */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.8px', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          Setting up · {done} of {steps.length} done
        </span>
        <button onClick={dismiss}
          style={{ font: 'inherit', fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '1.4px', textTransform: 'uppercase', background: 'none', border: 0, color: 'var(--ink-faint)', cursor: 'pointer' }}>
          dismiss
        </button>
      </div>

      <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 'clamp(21px,2vw,26px)', letterSpacing: '-.035em', lineHeight: 1.22, margin: '12px 0 0', maxWidth: '34ch', color: 'var(--ink)' }}>
        {left.length === 1
          ? <>One thing left: <span style={{ color: 'var(--accent)' }}>{nextUp.label.toLowerCase()}</span>.</>
          : <>{left.length} things left before Popsicle watches properly. <span style={{ color: 'var(--ink-muted)' }}>{nextUp.label} first.</span></>}
      </h2>

      {/* how far along, as a rule rather than a widget */}
      <div style={{ display: 'flex', gap: 4, margin: '18px 0 2px' }}>
        {steps.map(s => (
          <span key={s.key} style={{ height: 2, flex: 1, background: s.done ? 'var(--accent)' : 'var(--hairline, #EFEAE1)', transition: 'background .4s cubic-bezier(.16,1,.3,1)' }} />
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--rule-strong, #0E0D0B)', marginTop: 14 }}>
        {steps.map((s, i) => (
          <div key={s.key} className={s.done ? '' : 'tbl-row askable'} onClick={() => !s.done && router.push(s.go)}
            style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) auto', gap: 16, alignItems: 'center',
              padding: '14px 0', borderBottom: '1px solid var(--hairline, #EFEAE1)', cursor: s.done ? 'default' : 'pointer' }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '1.2px', color: s.done ? 'var(--accent)' : 'var(--ink-faint)' }}>
              {s.done ? 'done' : String(i + 1).padStart(2, '0')}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15.5, fontWeight: s.done ? 400 : 600, letterSpacing: '-.01em', color: s.done ? 'var(--ink-faint)' : 'var(--ink)' }}>{s.label}</span>
              {!s.done && <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-muted)', marginTop: 3 }}>{s.why}</span>}
            </span>
            {!s.done && (
              // square, like every other button in this product: the next step is filled, the rest outlined
              <button onClick={e => { e.stopPropagation(); router.push(s.go) }}
                style={{ font: 'inherit', fontSize: 13, fontWeight: 600, padding: '9px 20px', minWidth: 104, borderRadius: 0, cursor: 'pointer', whiteSpace: 'nowrap',
                  border: s.key === nextUp?.key ? 0 : '1px solid rgba(232,90,37,.28)',
                  background: s.key === nextUp?.key ? 'linear-gradient(135deg,#FF8A50,#E85A25)' : 'transparent',
                  color: s.key === nextUp?.key ? '#fff' : 'var(--accent)' }}>
                {s.cta}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
