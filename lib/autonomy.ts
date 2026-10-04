// What Popsicle may do without being asked.
//
// One rule holds everywhere: anything that LEAVES THE COMPANY (an email, a Slack message to a customer
// channel) is a high-consequence act and stays behind the existing send rules. Anything that only
// tidies Popsicle's own state (snoozing noise, closing a Concern the evidence already answered,
// reminding your own teammate) is low-consequence and can be switched on by itself.
//
// The guardrails are shared: never an executive, never a critical account, never above the deal cap,
// never outside working hours. They apply to every autonomous action, not just email.

export type ActionKey =
  | 'send_followup'      // writes to the customer: the existing send_mode path
  | 'chase_invoice'      // writes to the customer, but a narrow, factual kind
  | 'close_resolved'     // marks a Concern handled once the reply that answers it arrives
  | 'snooze_noise'       // parks low-confidence Concerns on accounts that are plainly fine
  | 'nudge_teammate'     // reminds the owner, inside the company only
  | 'post_resolution'    // posts the outcome to your own Slack channel

export type Consequence = 'leaves_company' | 'internal_only'

export const ACTIONS: Record<ActionKey, {
  label: string; what: string; consequence: Consequence; defaultOn: boolean; ready: boolean
}> = {
  send_followup: {
    label: 'Send the follow-up it drafted',
    what: 'Only the message kinds you allow, and never to an executive or a critical account',
    consequence: 'leaves_company', defaultOn: false, ready: true,
  },
  chase_invoice: {
    label: 'Chase an overdue invoice',
    what: 'One factual reminder with the invoice attached, to the billing contact',
    consequence: 'leaves_company', defaultOn: false, ready: true,
  },
  close_resolved: {
    label: 'Close a Concern the reply already answered',
    what: 'When the thing it was worried about visibly happens, it closes it instead of asking you',
    consequence: 'internal_only', defaultOn: true, ready: true,
  },
  snooze_noise: {
    label: 'Park low-confidence Concerns on healthy accounts',
    what: 'Parked, never deleted, and they come back if the account turns',
    consequence: 'internal_only', defaultOn: true, ready: true,
  },
  nudge_teammate: {
    label: 'Remind whoever owns the account',
    what: 'A message to your own teammate when a Concern has sat past its window',
    consequence: 'internal_only', defaultOn: false, ready: false,   // needs the nudge-member path wired
  },
  post_resolution: {
    label: 'Post the outcome to your Slack',
    what: 'Your own channel, after something is handled. Never a customer channel',
    consequence: 'internal_only', defaultOn: false, ready: true,
  },
}

export type AutonomyPolicy = Partial<Record<ActionKey, boolean>>

export function readAutonomy(meta: Record<string, unknown> | null | undefined): AutonomyPolicy {
  const raw = (meta?.auto_actions ?? {}) as Record<string, unknown>
  const out: AutonomyPolicy = {}
  for (const key of Object.keys(ACTIONS) as ActionKey[]) {
    out[key] = typeof raw[key] === 'boolean' ? (raw[key] as boolean) : ACTIONS[key].defaultOn
  }
  return out
}

/**
 * May Popsicle do this on its own right now?
 * Anything that leaves the company ALSO needs send_mode to be 'without', so turning a message kind on
 * here can never bypass the sending decision a person already made.
 */
export function mayAct(
  key: ActionKey,
  policy: AutonomyPolicy,
  ctx: { sendMode?: string | null; ready?: boolean } = {},
): { ok: boolean; reason?: string } {
  const def = ACTIONS[key]
  if (!def) return { ok: false, reason: 'unknown_action' }
  if (!def.ready) return { ok: false, reason: 'not_built_yet' }
  if (!policy[key]) return { ok: false, reason: 'switched_off' }
  if (def.consequence === 'leaves_company' && ctx.sendMode !== 'without') {
    return { ok: false, reason: 'sending_still_waits_for_you' }
  }
  return { ok: true }
}

/** For the Settings screen: what is on, in a sentence. */
export function autonomySummary(policy: AutonomyPolicy, sendMode?: string | null): string {
  const on = (Object.keys(ACTIONS) as ActionKey[]).filter(k => policy[k] && ACTIONS[k].ready)
  if (!on.length) return 'Nothing. Everything waits for you'
  const leaves = on.filter(k => ACTIONS[k].consequence === 'leaves_company').length
  const internal = on.length - leaves
  if (leaves && sendMode !== 'without') return `${internal} internal action${internal === 1 ? '' : 's'} · sending still waits for you`
  return [leaves ? `${leaves} that reach the customer` : '', internal ? `${internal} internal` : ''].filter(Boolean).join(' · ')
}
