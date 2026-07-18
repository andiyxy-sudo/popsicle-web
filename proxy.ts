import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/auth')

  if (!user && !isPublic && pathname !== '/') {
    // Preserve the full destination (path + query) through the login flow, so
    // deep links like /signals?signal=<id> land on the signal after auth.
    const url = request.nextUrl.clone()
    const dest = pathname + (request.nextUrl.search || '')
    url.pathname = '/login'
    url.search = ''
    if (dest && dest !== '/dashboard') url.searchParams.set('next', dest)
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    // Already signed in: honor a pending deep link, else go home. Only allow
    // same-site relative paths (must start with a single "/").
    const next = request.nextUrl.searchParams.get('next') || ''
    const safe = next.startsWith('/') && !next.startsWith('//')
    const url = request.nextUrl.clone()
    url.search = ''
    if (safe) {
      const [p, q] = next.split('?')
      url.pathname = p
      if (q) url.search = '?' + q
    } else {
      url.pathname = '/dashboard'
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
