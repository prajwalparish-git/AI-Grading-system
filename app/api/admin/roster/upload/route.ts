import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const text = await file.text()
    
    // Simple CSV parser
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or missing data rows' }, { status: 400 })
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    
    // Validate headers
    const requiredHeaders = ['usn', 'name', 'email', 'dob', 'batch']
    const hasAllHeaders = requiredHeaders.every(h => headers.includes(h))
    
    if (!hasAllHeaders) {
      return NextResponse.json({ error: 'Invalid CSV headers. Expected: usn,name,email,dob,batch' }, { status: 400 })
    }

    const usnIdx = headers.indexOf('usn')
    const nameIdx = headers.indexOf('name')
    const emailIdx = headers.indexOf('email')
    const dobIdx = headers.indexOf('dob')
    const batchIdx = headers.indexOf('batch')

    const records = []
    for (let i = 1; i < lines.length; i++) {
      // Very simple split (does not handle commas inside quotes)
      const values = lines[i].split(',').map(v => v.trim())
      
      // Basic validation
      if (values[usnIdx] && values[nameIdx] && values[emailIdx]) {
        records.push({
          usn: values[usnIdx],
          name: values[nameIdx],
          email: values[emailIdx],
          dob: values[dobIdx] || null,
          batch: values[batchIdx] || null
        })
      }
    }

    if (records.length === 0) {
      return NextResponse.json({ error: 'No valid records found in CSV' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Using upsert based on usn
    const { data, error } = await adminClient
      .from('roster')
      .upsert(records, { onConflict: 'usn' })
      .select()

    if (error) {
      console.error('Error upserting roster from CSV:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log
    await adminClient.from('audit_log').insert({
      id: crypto.randomUUID(),
      actor_user_id: user.id,
      action: 'roster_uploaded',
      payload: { count: records.length }
    })

    return NextResponse.json({ success: true, inserted: records.length })
  } catch (error: any) {
    console.error('Error in POST /api/admin/roster/upload:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
