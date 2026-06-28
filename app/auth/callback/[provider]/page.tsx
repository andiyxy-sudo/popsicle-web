import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ provider: string }>
  searchParams: Promise<{ code?: string; state?: string; error?: string; error_description?: string }>
}

export default async function OAuthCallback({ params, searchParams }: Props) {
  const { provider } = await params
  const sp = await searchParams

  if (sp.error) {
    redirect(`/integrations?error=${encodeURIComponent(sp.error_description ?? sp.error)}`)
  }

  // Exchange code for session (Supabase handles this for Google OAuth)
  if (sp.code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(sp.code)
    if (error) {
      redirect(`/integrations?error=${encodeURIComponent(error.message)}`)
    }
  }

  // For provider-specific OAuth (non-Supabase auth), the EF handles token storage
  // and redirects here with a state param. We just redirect to integrations.
  redirect('/integrations?connected=' + provider)
}
