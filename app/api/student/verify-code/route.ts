import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendStudentCredentials } from '@/lib/email'
import { createHash } from 'crypto'

function hashOTP(otp: string) {
  const pepper = process.env.OTP_PEPPER || 'default-pepper'
  return createHash('sha256').update(otp + pepper).digest('hex')
}

function generateRandomPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()'
  let pass = ''
  for (let i = 0; i < 16; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pass
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { usn, code } = body

    if (!usn || !code) {
      return NextResponse.json({ error: 'USN and code are required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Find the code
    const otpHash = hashOTP(code)
    
    // We get the most recent unused code for this USN
    const { data: codes, error: codeError } = await adminClient
      .from('verification_codes')
      .select('*')
      .eq('usn', usn)
      .is('used_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (codeError || !codes || codes.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
    }

    const codeRecord = codes[0]

    // Check attempt count
    const attemptCount = codeRecord.attempt_count || 0;
    if (attemptCount >= 5) {
      return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 400 })
    }

    // Increment attempt count
    await adminClient.from('verification_codes').update({ attempt_count: attemptCount + 1 }).eq('id', codeRecord.id)

    if (codeRecord.code_hash !== otpHash) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    // Mark code as used
    await adminClient.from('verification_codes').update({ used_at: new Date().toISOString() }).eq('id', codeRecord.id)

    // Lookup roster
    const { data: rosterData, error: rosterError } = await adminClient
      .from('roster')
      .select('*, applications(status)')
      .eq('usn', usn)
      .single()

    if (rosterError || !rosterData) {
      return NextResponse.json({ error: 'Student not found in roster' }, { status: 404 })
    }

    if (rosterData.applications?.[0]?.status === 'withdrawn') {
      return NextResponse.json({ error: 'Application has been withdrawn. You cannot proceed.' }, { status: 403 })
    }

    let appId: string
    let appStatus: string = 'verified'
    
    // Check if application exists
    if (rosterData.applications && rosterData.applications.length > 0) {
      // It exists
      const existingApp = await adminClient.from('applications').select('id, status').eq('roster_id', rosterData.id).single()
      if (existingApp.data) {
        appId = existingApp.data.id
        appStatus = existingApp.data.status
        if (appStatus === 'pending_otp' || appStatus === 'error') {
          appStatus = 'verified'
          await adminClient.from('applications').update({ status: 'verified' }).eq('id', appId)
        }
      } else {
        // Fallback
        appId = crypto.randomUUID()
        await adminClient.from('applications').insert({ id: appId, roster_id: rosterData.id, status: 'verified' })
      }
    } else {
      appId = crypto.randomUUID()
      await adminClient.from('applications').insert({ id: appId, roster_id: rosterData.id, status: 'verified' })
    }

    // Create apply_session
    const jose = await import('jose')
    const JWT_SECRET = new TextEncoder().encode(process.env.OTP_PEPPER || 'default-secret-fallback')
    const jwt = await new jose.SignJWT({ usn, application_id: appId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h') // Give them 24 hours
      .sign(JWT_SECRET)

    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    cookieStore.set('apply_session', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400, // 24 hours
    })

    return NextResponse.json({ success: true, application_id: appId, status: appStatus })
  } catch (error: any) {
    console.error('Error in POST /api/student/verify-code:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
