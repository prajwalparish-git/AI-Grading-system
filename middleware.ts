import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import * as jose from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.OTP_PEPPER || 'default-secret-fallback')

// Routes that are fully public (no session required)
const PUBLIC_PATHS = [
  '/login', 
  '/api/auth/login',
  '/api/student/verify-usn',
  '/api/student/verify-code'
]

// Pages that are public but not API routes
const PUBLIC_PAGE_PATHS = ['/apply', '/admin/login']

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p)) {
    return true
  }
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

  if (isPublicRoute(path)) return response

  // Check Supabase session
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.app_metadata?.role

  // Check custom apply_session
  let applySession = null
  const applyCookie = request.cookies.get('apply_session')?.value
  if (applyCookie) {
    try {
      const { payload } = await jose.jwtVerify(applyCookie, JWT_SECRET)
      applySession = payload
    } catch (err) {
      applySession = null
    }
  }

  // Admin routes strictly require Supabase user with role admin
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    if (!user || role !== 'admin') {
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // Student routes that accept either
  const isStudentRoute = 
    path.startsWith('/dashboard') || 
    path.startsWith('/submit') || 
    path.startsWith('/results') || 
    path.startsWith('/api/apply') || 
    path.startsWith('/api/student')

  if (isStudentRoute) {
    if (!user && !applySession) {
      if (path.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Authentication required.' },
          { status: 401 }
        )
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } else {
    // Other unknown protected routes fallback to basic check
    if (!user && !applySession) {
      if (path.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Authentication required.' },
          { status: 401 }
        )
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
