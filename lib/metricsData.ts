// Loads accounts and signals for the signed-in user (demo dataset, or the org's live rows).
import type { SupabaseClient } from '@supabase/supabase-js'
import { orgIdsServer } from '@/lib/org'
import type * as M from '@/lib/metrics'

export async function loadMetricsData(supabase: SupabaseClient, claims: Record<string, unknown>): Promise<{ accts: M.Acct[]; sigs: M.Sig[]; now: number; demo: boolean }> {
  if ((claims.email as string | undefined) === 'demo@popsicle-labs.app') {
    const d = await import('@/lib/demo-dataset')
    return { accts: d.DEMO_ACCOUNTS as unknown as M.Acct[], sigs: d.DEMO_SIGNALS as unknown as M.Sig[], now: d.DEMO_NOW, demo: true }
  }
  const ids = await orgIdsServer(supabase, claims.sub as string)
  const [{ data: a }, { data: s }] = await Promise.all([
    supabase.from('accounts').select('name, value, stage, risk_level, health_score, owner, close_date, user_id').in('user_id', ids).limit(500),
    supabase.from('signals').select('id, account_name, signal_type, severity, title, description, risk_amount, created_at, status, is_dismissed, source_integration, handled_at, handled_action, ai_analysis').in('user_id', ids).order('created_at', { ascending: false }).limit(1500),
  ])
  return { accts: (a ?? []) as M.Acct[], sigs: (s ?? []) as M.Sig[], now: Date.now(), demo: false }
}

// A rep's own book: in the demo, Andy G's accounts (from the team data); live, accounts they own.
export async function myBook(demo: boolean, userId: string, accts: M.Acct[]): Promise<string[]> {
  if (demo) { const d = await import('@/lib/demo-dataset'); return d.DEMO_TEAM.reps[0]?.accounts ?? [] }
  return accts.filter(a => (a as M.Acct & { user_id?: string }).user_id === userId).map(a => a.name)
}
export function scopeTo(names: string[], accts: M.Acct[], sigs: M.Sig[]) {
  const set = new Set(names)
  return { accts: accts.filter(a => set.has(a.name)), sigs: sigs.filter(s => set.has(s.account_name || '')) }
}
