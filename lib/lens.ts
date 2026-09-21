// Which view a person gets, from who they are: their job title (profile), else their org role.
export type LensId = 'rep' | 'manager' | 'cro' | 'cfo'
export const LENS_LABEL: Record<LensId, string> = { rep: 'Sales rep view', manager: 'Manager view', cro: 'Leadership view', cfo: 'Finance view' }

export function resolveLens(title: string | null | undefined, orgRole: string | null | undefined): LensId {
  const t = (title ?? '').toLowerCase()
  if (/\b(cfo|finance|financial|controller|treasur|fp&a|accounting)\b/.test(t)) return 'cfo'
  if (/\b(cro|chief|vp|vice president|svp|evp|head of|director|president|ceo|founder|co-founder|cofounder|gm|general manager)\b/.test(t)) return 'cro'
  if (/\b(manager|lead|supervisor|team lead)\b/.test(t)) return 'manager'
  if (t.trim()) return 'rep'
  return orgRole === 'owner' || orgRole === 'admin' ? 'manager' : 'rep'
}
