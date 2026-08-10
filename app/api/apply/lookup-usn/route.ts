import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Upstash Redis ratelimit (fallback to mock if not configured)
let ratelimit: Ratelimit | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: true,
  })
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
    if (ratelimit) {
      const { success } = await ratelimit.limit(`lookup_usn_${ip}`)
      if (!success) {
        return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })
      }
    }

    const { usn } = await request.json()
    if (!usn) {
      return NextResponse.json({ error: 'USN is required' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    const { data: rosterData, error } = await supabaseAdmin
      .from('roster')
      .select('name, is_active')
      .eq('usn', usn)
      .single()

    if (error || !rosterData || !rosterData.is_active) {
      return NextResponse.json({ error: 'USN not found in active roster.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, name: rosterData.name })
  } catch (error) {
    console.error('USN lookup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
