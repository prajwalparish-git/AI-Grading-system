import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const isActive = searchParams.get('is_active')
    
    // We can use the admin client since we already verified the role
    const adminClient = createAdminClient()
    let query = adminClient.from('roster').select('*')

    if (search) {
      query = query.or(`usn.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%`)
    }
    
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({ roster: data })
  } catch (error: any) {
    console.error('Error in GET /api/admin/roster:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    // Support either single object or array
    const records = Array.isArray(body) ? body : [body]

    const adminClient = createAdminClient()

    const { data, error } = await adminClient
      .from('roster')
      .insert(records)
      .select()

    if (error) {
      console.error('Error inserting into roster:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log
    await adminClient.from('audit_log').insert({
      actor_user_id: user.id,
      action: 'roster_created',
      payload: { count: records.length, records: records.map(r => r.usn) }
    })

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in POST /api/admin/roster:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
