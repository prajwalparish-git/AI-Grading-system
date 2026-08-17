import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { hashOtp } from '../send-otp/route'
import * as jose from 'jose'
import { cookies } from 'next/headers'

let ratelimit: Ratelimit | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: true,
  })
}

const JWT_SECRET = new TextEncoder().encode(process.env.OTP_PEPPER || 'default-secret-fallback')

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
    if (ratelimit) {
      const { success } = await ratelimit.limit(`verify_otp_${ip}`)
      if (!success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })
    }

    const { usn, otp } = await request.json()
    if (!usn || !otp) return NextResponse.json({ error: 'USN and OTP required' }, { status: 400 })

    const supabaseAdmin = createAdminClient()
    const code_hash = await hashOtp(otp)

    const { data: codes, error } = await supabaseAdmin
      .from('verification_codes')
      .select('id, expires_at, used_at')
      .eq('usn', usn)
      .eq('code_hash', code_hash)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !codes || codes.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 })
    }

    const code = codes[0]

    if (code.used_at || new Date(code.expires_at) < new Date()) {
      return NextResponse.json({ error: 'OTP is expired or already used' }, { status: 400 })
    }

    // Mark used
    await supabaseAdmin
      .from('verification_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', code.id)

    // Get roster ID
    const { data: roster } = await supabaseAdmin.from('roster').select('id').eq('usn', usn).single()
    if (!roster) return NextResponse.json({ error: 'Roster error' }, { status: 500 })

    // Create or update application
    let appId: string
    let appStatus: string = 'verified'
    const { data: existingApp } = await supabaseAdmin
      .from('applications')
      .select('id, status')
      .eq('roster_id', roster.id)
      .single()

    if (existingApp) {
      appId = existingApp.id
      appStatus = existingApp.status
      if (appStatus === 'pending_otp' || appStatus === 'error') {
        appStatus = 'verified'
        await supabaseAdmin.from('applications').update({
          status: 'verified',
        }).eq('id', appId)
      }
    } else {
      appId = crypto.randomUUID()
      await supabaseAdmin.from('applications').insert({
        id: appId,
        roster_id: roster.id,
        status: 'verified',
      })
    }

    // Create secure session
    const jwt = await new jose.SignJWT({ usn, application_id: appId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(JWT_SECRET)

    const cookieStore = await cookies()
    cookieStore.set('apply_session', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7200, // 2 hours
    })

    await supabaseAdmin.from('audit_log').insert({
      id: crypto.randomUUID(),
      application_id: appId,
      actor_usn: usn,
      action: 'verify_otp',
    })

    return NextResponse.json({ success: true, application_id: appId, status: appStatus })
  } catch (err) {
    console.error('Verify OTP error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
