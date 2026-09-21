'use client'
// The user's choice to let the agent speak up. Stored locally for instant reads and
// in the auth user's metadata (agent_popups) so it follows them across devices.
const KEY = 'agent:popups'
export function agentPopupsOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}
export function setAgentPopups(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* private mode */ }
  try { window.dispatchEvent(new CustomEvent('agent:prefs', { detail: { on } })) } catch { /* ignore */ }
}
