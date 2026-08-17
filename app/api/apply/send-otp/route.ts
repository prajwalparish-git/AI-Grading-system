import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { sendVerificationCode } from '@/lib/email'

let ratelimit: Ratelimit | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(3, '15 m'),
    analytics: true,
  })
}

export async function hashOtp(otp: string): Promise<string> {
  const pepper = process.env.OTP_PEPPER || 'default-pepper'
  const encoder = new TextEncoder()
  const data = encoder.encode(otp + pepper)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
    if (ratelimit) {
      const { success } = await ratelimit.limit(`send_otp_${ip}`)
      if (!success) {
        return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })
      }
    }

    const { usn } = await request.json()
    if (!usn) return NextResponse.json({ error: 'USN required' }, { status: 400 })

    const supabaseAdmin = createAdminClient()
    
    // Check roster status and fetch existing applications to block withdrawn
    const { data: roster, error } = await supabaseAdmin
      .from('roster')
      .select('id, email, is_active, applications(status)')
      .eq('usn', usn)
      .single()

    if (error || !roster) {
      return NextResponse.json({ error: 'Invalid USN' }, { status: 404 })
    }

    if (!roster.is_active) {
      return NextResponse.json({ error: 'This USN is no longer active.' }, { status: 403 })
    }

    const appStatus = roster.applications?.[0]?.status
    if (appStatus === 'withdrawn') {
      return NextResponse.json({ error: 'Application has been withdrawn. You cannot re-submit.' }, { status: 403 })
    }

    // DB Rate Limiting Fallback
    if (!ratelimit) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { count } = await supabaseAdmin
        .from('verification_codes')
        .select('*', { count: 'exact', head: true })
        .eq('usn', usn)
        .gte('created_at', oneHourAgo)
      
      if (count !== null && count >= 3) {
        return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const code_hash = await hashOtp(otp)
    const expires_at = new Date(Date.now() + (Number(process.env.OTP_EXPIRY_MINUTES) || 10) * 60000).toISOString()
    const id = crypto.randomUUID()

    const { error: insertError } = await supabaseAdmin
      .from('verification_codes')
      .insert({ id, usn, code_hash, expires_at })

    if (insertError) throw insertError

    await sendVerificationCode(roster.email, otp)
    
    await supabaseAdmin.from('audit_log').insert({
      id: crypto.randomUUID(),
      actor_usn: usn,
      action: 'send_otp',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Send OTP error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
