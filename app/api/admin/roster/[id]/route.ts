import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const adminClient = createAdminClient()

    const { data, error } = await adminClient
      .from('roster')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating roster:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log
    await adminClient.from('audit_log').insert({
      id: crypto.randomUUID(),
      actor_user_id: user.id,
      action: 'roster_updated',
      payload: { roster_id: id, updates: body }
    })

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in PUT /api/admin/roster/[id]:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const adminClient = createAdminClient()

    // Soft delete
    const { data, error } = await adminClient
      .from('roster')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error deleting roster:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log
    await adminClient.from('audit_log').insert({
      id: crypto.randomUUID(),
      actor_user_id: user.id,
      action: 'roster_deleted',
      payload: { roster_id: id }
    })

    return NextResponse.json({ success: true, message: 'Student soft-deleted' })
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/roster/[id]:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
