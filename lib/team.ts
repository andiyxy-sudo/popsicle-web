// Reps are Popsicle users. An account belongs to the teammate who owns it in Popsicle (accounts.user_id),
// never to the name in its `owner` field, which holds the buyer's contact (for example "Sarah Chen").
import { createClient as createAdmin } from '@supabase/supabase-js'

const nameCache = new Map<string, { name: string; at: number }>()

/** Display names for Popsicle users: profile name, else the part of their email before the @. */
export async function teammateNames(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const todo = [...new Set(ids)].filter(Boolean).filter(id => {
    const c = nameCache.get(id); if (c && Date.now() - c.at < 10 * 60e3) { out[id] = c.name; return false } return true
  })
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (todo.length && key) {
    const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, key.trim(), { auth: { autoRefreshToken: false, persistSession: false } })
    await Promise.all(todo.map(async id => {
      try {
        const { data } = await admin.auth.admin.getUserById(id)
        const u = data?.user
        const name = (u?.user_metadata?.name as string | undefined)?.trim() || (u?.email ? u.email.split('@')[0] : 'Teammate')
        out[id] = name; nameCache.set(id, { name, at: Date.now() })
      } catch { out[id] = 'Teammate' }
    }))
  }
  for (const id of todo) if (!out[id]) out[id] = 'Teammate'
  return out
}

/** Accounts grouped by the teammate who owns them, with that teammate's name. */
export async function repsFromAccounts(accts: Array<{ name: string; user_id?: string | null }>): Promise<Array<{ id: string; name: string; accounts: string[] }>> {
  const byUser = new Map<string, string[]>()
  for (const a of accts) { const u = a.user_id || 'unassigned'; byUser.set(u, [...(byUser.get(u) ?? []), a.name]) }
  const names = await teammateNames([...byUser.keys()].filter(k => k !== 'unassigned'))
  return [...byUser.entries()].map(([id, accounts]) => ({ id, name: id === 'unassigned' ? 'Unassigned' : names[id] ?? 'Teammate', accounts }))
}
