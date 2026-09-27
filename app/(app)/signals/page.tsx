import { redirect } from 'next/navigation'

// The page moved to /concerns when the product started calling them Concerns.
// This keeps old links, bookmarks and the mobile app's deep links working, query string and all.
export default async function SignalsRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') qs.set(k, v)
  redirect(qs.toString() ? `/concerns?${qs}` : '/concerns')
}
