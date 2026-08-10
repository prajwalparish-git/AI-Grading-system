import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getApplySession } from '@/lib/apply-session'

export async function POST(request: Request) {
  try {
    const session = await getApplySession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = createAdminClient()

    await supabaseAdmin.from('applications').update({
      status: 'withdrawn',
      withdrawn_at: new Date().toISOString()
    }).eq('id', session.application_id)

    await supabaseAdmin.from('audit_log').insert({
      id: crypto.randomUUID(),
      application_id: session.application_id,
      actor_usn: session.usn,
      action: 'withdraw',
    })

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Withdraw error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
