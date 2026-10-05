# Making the detector respect the Concern Engine settings

The portal now filters what it shows, but `detect-signal` still raises every type, which means a
switched-off type is detected, stored and **billed**. Since your plans are priced per Concern, this is the
one remaining gap worth closing. The change belongs in the Supabase function, so here it is for review.

## 1. Read the person's settings once per run

```ts
const CE_DEFAULTS = {
  ce_exec: true, ce_price: true, ce_comp: true, ce_time: true, ce_legal: true,
  ce_champ: true, ce_usage: true, ce_sent: false, ce_expand: true,
}

const CE_COVERS: Record<string, string[]> = {
  ce_exec:   ['silent_stall', 'meeting_declined'],
  ce_price:  ['price_flinch'],
  ce_comp:   ['competitor_mention'],
  ce_time:   ['timeline_slip', 'meeting_cancelled', 'deal_stage_backward'],
  ce_legal:  ['legal_loopin'],
  ce_champ:  ['champion_change'],
  ce_usage:  [],
  ce_sent:   ['call_sentiment_drop'],
  ce_expand: ['call_buying_signal', 'reengaged'],
}

// user_metadata.concern_engine, written by the portal and the phone
const { data: u } = await supabase.auth.admin.getUserById(userId)
const ce = (u?.user?.user_metadata?.concern_engine ?? {}) as Record<string, unknown>
const types = { ...CE_DEFAULTS, ...Object.fromEntries(Object.entries(ce).filter(([k]) => k.startsWith('ce_'))) }
const sens = typeof ce.sens === 'string' ? ce.sens : 'Balanced'
```

## 2. Decide before you spend anything

Put this check **before** the model call, not after. That is where the saving is.

```ts
function typeEnabled(signalType: string): boolean {
  for (const [key, covers] of Object.entries(CE_COVERS)) if (covers.includes(signalType)) return types[key] !== false
  return true   // types no switch covers stay on
}
```

Detection usually finds the type as part of the reasoning, so there are two places to apply it:

- **Cheap and immediate:** after classification, drop the Concern before writing the row. Saves the
  storage and the billing, not the model call.
- **Better:** tell the model which types this person cares about, in the system prompt, and let it skip
  the rest: `Only raise these kinds: silent_stall, price_flinch, …`. Shorter output, fewer tokens.

## 3. Sensitivity decides the bar

```ts
const floor = sens === 'Early warning' ? 0 : sens === 'High confidence only' ? 90 : 70
if (severity !== 'high' && confidence < floor) return   // critical always passes, whatever the setting
```

The portal uses exactly these numbers (`lib/settings.ts`), so the two must stay in step. Best to move
both into one shared constant rather than keeping a copy in each.

## 4. What to watch after shipping

- **Count what you skip.** A `skipped_by_settings` tally per user tells you whether people are quietly
  switching off half the product, which would show up as low engagement rather than as a complaint.
- **Never skip a critical.** The severity check above is what stops a person muting a type and missing
  the one that mattered.
- **Say so in the portal.** The Concerns page already shows "N held back by your Concern Engine
  settings". Once the detector honours it, that line should say "not raised" rather than "held back",
  because the Concern will genuinely not exist.
