'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// The plan, the allowance and the unlock. Everything the database already decides; this file only
// asks. Three calls: entitlements() to know where you stand, unlockConcern() to spend one, and a
// realtime subscription so the counter here and on the phone stay in step.

export type Entitlements = {
  plan: string
  paid: boolean
  unlocks_per_month: number | null
  unlocks_left: number | null
  period_start: string | null
  resets_on: string | null
  max_sources: number | null
  sources_used: number | null
  max_accounts: number | null
  accounts_used: number | null
  band: number | null
  concerns_this_period: number | null
  over_band: boolean | null
}

export type UnlockResult =
  | { ok: true; unlocks_left?: number; already?: boolean }
  | { ok: false; reason: string; resets_on?: string }

/** Where this workspace stands. Calling it also grants the three bonus unlocks a new org gets. */
export async function fetchEntitlements(): Promise<Entitlements | null> {
  const { data, error } = await createClient().rpc('entitlements')
  if (error || !data) return null
  return data as Entitlements
}

/** Spend one unlock on a Concern. The database decides; this never writes to concern_unlocks itself. */
export async function unlockConcern(signalId: string): Promise<UnlockResult> {
  const { data, error } = await createClient().rpc('unlock_concern', { p_signal: signalId })
  if (error) return { ok: false, reason: error.message }
  return data as UnlockResult
}

/**
 * The plan, kept current. Re-reads when this tab unlocks something and when the phone does, so the
 * counter never drifts between the two.
 */
export function useEntitlements() {
  const [ent, setEnt] = useState<Entitlements | null>(null)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const e = await fetchEntitlements()
    setEnt(e); setLoaded(true)
  }, [])

  useEffect(() => {
    let dead = false
    ;(async () => { const e = await fetchEntitlements(); if (!dead) { setEnt(e); setLoaded(true) } })()

    const supabase = createClient()
    const channel = supabase
      .channel('concern-unlocks')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'concern_unlocks' }, () => { void refresh() })
      .subscribe()

    return () => { dead = true; void supabase.removeChannel(channel) }
  }, [refresh])

  return { ent, loaded, refresh }
}

/** Free is the only plan that locks anything, and the demo is always treated as paid. */
export function showsLocks(ent: Entitlements | null, isDemo = false): boolean {
  if (isDemo || !ent) return false
  return !ent.paid
}

/** "Resets 20 Oct" */
export function resetsOn(ent: Entitlements | null): string {
  if (!ent?.resets_on) return ''
  return new Date(ent.resets_on).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
