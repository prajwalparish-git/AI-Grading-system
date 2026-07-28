import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Route protection middleware.
 *
 * Public routes (no auth required):
 *   /login, /submit, /results, /results/*, /api/submit, /api/results
 *
 * Protected routes:
 *   /admin/* — requires a valid authenticated session AND admin role
 *   All other routes — require a valid authenticated session
 */

// Routes that are fully public (no session required)
const PUBLIC_PATHS = ['/login', '/submit', '/results']
const PUBLIC_API_PATHS = ['/api/submit', '/api/results']

function isPublicRoute(pathname: string): boolean {
  // Exact match or starts-with for public pages
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true
  }
  // Exact match for public API endpoints
  if (PUBLIC_API_PATHS.some((p) => pathname === p)) {
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

  // For all protected routes, verify session
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Admin routes require admin role — checked via applicants or a
  // dedicated admin flag. For now, we check Supabase auth metadata.
  if (path.startsWith('/admin')) {
    const { data: { user: adminUser } } = await supabase.auth.getUser()
    const role = adminUser?.app_metadata?.role ?? adminUser?.user_metadata?.role

    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/submit', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
