import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createRatelimit } from '@/lib/ratelimit'

const lookupUsnRatelimit = createRatelimit('lookup_usn', 5, '15 m', 15)

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
    const { success } = await lookupUsnRatelimit.limit(ip)
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })
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
