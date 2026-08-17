import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csvContent = 'usn,name,email,dob,batch\n1RV21CS000,John Doe,john@example.com,2003-01-01,2021\n'
    
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="roster_template.csv"'
      }
    })
  } catch (error: any) {
    console.error('Error in GET /api/admin/roster/template:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
