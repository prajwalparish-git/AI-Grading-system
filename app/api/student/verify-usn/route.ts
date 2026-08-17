import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendVerificationCode } from '@/lib/email'
import { createHash } from 'crypto'

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function hashOTP(otp: string) {
  const pepper = process.env.OTP_PEPPER || 'default-pepper'
  return createHash('sha256').update(otp + pepper).digest('hex')
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { usn } = body

    if (!usn || typeof usn !== 'string') {
      return NextResponse.json({ error: 'USN is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Lookup USN in roster
    const { data: rosterData, error: rosterError } = await adminClient
      .from('roster')
      .select('*')
      .eq('usn', usn)
      .eq('is_active', true)
      .single()

    if (rosterError || !rosterData) {
      return NextResponse.json({ error: 'USN not found or inactive' }, { status: 404 })
    }

    const otp = generateOTP()
    const otpHash = hashOTP(otp)
    const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES || '10') * 60000)).toISOString()

    // Store in verification_codes
    const codeId = crypto.randomUUID()
    const { error: codeError } = await adminClient
      .from('verification_codes')
      .insert({
        id: codeId,
        usn: rosterData.usn,
        code_hash: otpHash,
        expires_at: expiresAt
      })

    if (codeError) {
      console.error('Error inserting verification code:', codeError)
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 })
    }

    // Email the code
    await sendVerificationCode(rosterData.email, otp)

    return NextResponse.json({ success: true, message: 'Verification code sent' })
  } catch (error: any) {
    console.error('Error in POST /api/student/verify-usn:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
