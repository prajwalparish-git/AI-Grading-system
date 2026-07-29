import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Route protection middleware.
 *
 * Public routes (no auth required):
 *   /login, /api/auth/login, /submit (page only), /results, /results/*
 *
 * Protected routes:
 *   /api/*       — require a valid authenticated session (except whitelisted /api/auth/login)
 *   /admin/*     — require authenticated session AND admin role
 *   All other routes — require a valid authenticated session
 */

// Routes that are fully public (no session required)
const PUBLIC_PATHS = ['/login', '/api/auth/login']

// Pages that are public but not API routes
const PUBLIC_PAGE_PATHS = ['/submit', '/results']

function isPublicRoute(pathname: string): boolean {
  // Exact match for fully public paths
  if (PUBLIC_PATHS.some((p) => pathname === p)) {
    return true
  }
  // Pages that students can view without auth (submit form, results viewer)
  if (PUBLIC_PAGE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true
  }
  return false
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const path = request.nextUrl.pathname

  // Allow public routes through without any auth check
  if (isPublicRoute(path)) return response

  // For all protected routes (including /api/*), verify session
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // API routes return 401 JSON; pages redirect to login
    if (path.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      )
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Admin routes require admin role — checked strictly via Supabase app_metadata.
  if (path.startsWith('/admin')) {
    const role = user.app_metadata?.role

    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/submit', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
