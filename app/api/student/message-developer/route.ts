import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { sendMessageToDeveloper } from '@/lib/email'
import { getApplySession } from '@/lib/apply-session'

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    const applySession = await getApplySession()

    if (!user && !applySession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { message } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    
    // We need to get the user's USN from their application or roster
    let application = null;
    if (applySession) {
      const { data } = await adminClient
        .from('applications')
        .select('roster_id')
        .eq('id', applySession.application_id)
        .single()
      application = data
    } else if (user) {
      const { data } = await adminClient
        .from('applications')
        .select('roster_id')
        .eq('user_id', user.id)
        .single()
      application = data
    }
      
    if (!application) {
       return NextResponse.json({ error: 'Student application not found' }, { status: 404 })
    }
    
    const { data: roster, error: rosterError } = await adminClient
      .from('roster')
      .select('usn, email')
      .eq('id', application.roster_id as string)
      .single()

    if (rosterError || !roster || !roster.email || !roster.usn) {
       return NextResponse.json({ error: 'Student roster entry not found or missing details' }, { status: 404 })
    }

    // Send the email
    await sendMessageToDeveloper(roster.email as string, roster.usn as string, message)

    return NextResponse.json({ success: true, message: 'Message sent successfully' })
  } catch (error: any) {
    console.error('Error in POST /api/student/message-developer:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
