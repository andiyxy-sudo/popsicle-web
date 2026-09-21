// ─────────────────────────────────────────────────────────────────────────────
// The agent: Popsicle's outbound briefing layer.
//
// REVERT: set AGENT_ENABLED to false (or set NEXT_PUBLIC_AGENT=off in Vercel).
// With it off, the pop-up never mounts and the Ask page renders exactly as before.
// Nothing else in the portal depends on anything in lib/agent or components/agent.
// ─────────────────────────────────────────────────────────────────────────────
export const AGENT_ENABLED = process.env.NEXT_PUBLIC_AGENT !== 'off' && true
export const AGENT_NAME = 'Popsicle'          // rename here, once, when the name is decided

// pacing
export const AGENT_MAX_POPUPS_PER_DAY = 3
export const AGENT_BRIEF_DELAY_MS = 2600      // after the page settles
export const AGENT_CRITICAL_USD = 250_000     // interrupt threshold

// The Ask bar on every page opens the conversation in place, as a sheet that pulls up
// from the bar. Set to false to go back to the bar sending you to the Ask page.
export const ASK_DOCK = true
