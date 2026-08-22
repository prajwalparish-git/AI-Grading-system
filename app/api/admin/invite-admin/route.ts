import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { sendAdminInvite } from '@/lib/email'

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
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const tempPassword = generateRandomPassword()

    // Create the user in auth.users
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      app_metadata: { role: 'admin' }
    })

    if (createError) {
      console.error('Error creating admin user:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    // Send the invite email
    await sendAdminInvite(email, tempPassword)

    // Log the action
    await adminClient.from('audit_log').insert({
      actor_user_id: user.id,
      action: 'admin_invited',
      payload: { invited_email: email }
    })

    return NextResponse.json({ success: true, message: 'Admin invited successfully' })
  } catch (error: any) {
    console.error('Unexpected error in invite-admin:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
