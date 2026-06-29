import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// OAuth login callback (Google). Google sends the browser here with ?code=...
// We exchange that code for a session (which sets the auth cookies) and then
// send the user into the app. Used by "Sign in with Google" on the login page.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error_description') ?? searchParams.get('error')
  // Where to land after login (defaults to /pulse).
  const next = searchParams.get('next') ?? '/pulse'

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`)
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`)
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  // No code and no error: nothing to do, send back to login.
  return NextResponse.redirect(`${origin}/login`)
}
