import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createRatelimit } from '@/lib/ratelimit'

const sendOtpRatelimit = createRatelimit('send_otp', 3, '15 m', 15)

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
    const { success } = await sendOtpRatelimit.limit(ip)
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })
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
      actor_usn: usn,
      action: 'send_otp',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Send OTP error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
