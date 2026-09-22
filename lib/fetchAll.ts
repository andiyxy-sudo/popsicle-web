// Supabase returns at most 1,000 rows per request (and pages often asked for fewer), so figures computed
// from a single request were silently based on part of the data. fetchAll pages through everything.
type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>
export async function fetchAll<T>(make: (from: number, to: number) => Page<T>, opts: { page?: number; max?: number } = {}): Promise<T[]> {
  const page = opts.page ?? 1000, max = opts.max ?? 20000
  const out: T[] = []
  for (let from = 0; from < max; from += page) {
    const { data, error } = await make(from, Math.min(from + page, max) - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < page) break
  }
  return out
}
/** Same, shaped like a Supabase response, for pages that destructure { data }. */
export async function fetchAllData<T>(make: (from: number, to: number) => Page<T>, opts?: { page?: number; max?: number }): Promise<{ data: T[] }> {
  try { return { data: await fetchAll(make, opts) } } catch { return { data: [] } }
}
