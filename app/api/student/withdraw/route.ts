import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.app_metadata?.role === 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: application } = await supabase
      .from('applications')
      .select('id, status')
      .eq('user_id', user.id)
      .single()

    if (!application) {
      return NextResponse.json({ error: 'No application found' }, { status: 404 })
    }

    if (application.status === 'withdrawn') {
      return NextResponse.json({ error: 'Application already withdrawn' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    
    // Update to withdrawn
    const { error: updateError } = await adminClient
      .from('applications')
      .update({
        status: 'withdrawn',
        withdrawn_at: new Date().toISOString()
      })
      .eq('id', application.id)

    if (updateError) {
      console.error('Withdraw error:', updateError)
      return NextResponse.json({ error: 'Failed to withdraw application' }, { status: 500 })
    }

    await adminClient.from('audit_log').insert({
      id: crypto.randomUUID(),
      application_id: application.id,
      action: 'withdraw_application',
    })

    return NextResponse.json({ success: true, message: 'Application withdrawn successfully.' })

  } catch (err: any) {
    console.error('Withdraw route error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
