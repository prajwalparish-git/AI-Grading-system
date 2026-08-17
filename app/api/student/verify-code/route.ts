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

    // Create auth user
    const tempPassword = generateRandomPassword()
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: rosterData.email,
      password: tempPassword,
      email_confirm: true,
      app_metadata: { role: 'student' }
    })

    let userId: string
    if (authError) {
      if (authError.message.includes('User already registered') || authError.status === 422) {
        // Find user id by email
        const { data: existingUsers } = await adminClient.auth.admin.listUsers()
        const userMatch = existingUsers.users.find(u => u.email === rosterData.email)
        if (userMatch) {
          userId = userMatch.id
          // We can optionally update their password here, or just tell them to reset it.
          // Since the prompt asks to email credentials, let's just generate and update it.
          await adminClient.auth.admin.updateUserById(userId, { password: tempPassword })
        } else {
          return NextResponse.json({ error: 'Failed to retrieve existing user.' }, { status: 500 })
        }
      } else {
        console.error('Error creating auth user:', authError)
        return NextResponse.json({ error: authError.message }, { status: 500 })
      }
    } else {
      userId = authData.user.id
    }

    // Create or update application
    const { error: appError } = await adminClient
      .from('applications')
      .upsert({
        roster_id: rosterData.id,
        user_id: userId,
        status: 'verified'
      }, { onConflict: 'roster_id' })

    if (appError) {
      console.error('Error creating application:', appError)
      return NextResponse.json({ error: 'Failed to create application' }, { status: 500 })
    }

    // Email credentials
    await sendStudentCredentials(rosterData.email, rosterData.email, tempPassword)

    return NextResponse.json({ success: true, message: 'Verification successful. Credentials sent.' })
  } catch (error: any) {
    console.error('Error in POST /api/student/verify-code:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
