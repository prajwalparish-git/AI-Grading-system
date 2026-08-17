import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { applicationId } = await req.json()
    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 1. Fetch Application
    const { data: app, error: fetchError } = await adminClient
      .from('applications')
      .select(`
        id,
        user_id,
        roster_id,
        status,
        roster ( name, email ),
        projects ( id, repo_url, fetch_status )
      `)
      .eq('id', applicationId)
      .single()

    if (fetchError || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (app.status !== 'submitted') {
      return NextResponse.json({ error: 'Application is not in submitted state' }, { status: 400 })
    }

    const userName = (app.roster as any)?.name || 'Unknown Applicant'
    const userEmail = (app.roster as any)?.email || ''
    
    if (!app.user_id) {
       return NextResponse.json({ error: 'Application missing user_id' }, { status: 400 })
    }

    // Ensure legacy applicant record exists and set status to 'grading'
    let { data: applicant } = await adminClient
      .from('applicants')
      .select('id')
      .eq('user_id', app.user_id)
      .maybeSingle()

    if (!applicant?.id) {
      const { error: appErr } = await adminClient
        .from('applicants')
        .insert({
          user_id: app.user_id,
          name: userName,
          email: userEmail,
          github_url: 'https://github.com/unknown/unknown',
          language: 'TypeScript',
          status: 'grading',
        })
      
      if (appErr) throw appErr
    } else {
      await adminClient.from('applicants').update({ status: 'grading' }).eq('id', applicant.id)
    }

    const projects = (app.projects as any[]) || []
    
    // Set projects fetch_status to 'pending' to ensure the worker picks them up
    for (const project of projects) {
      await adminClient.from('projects').update({ fetch_status: 'pending' }).eq('id', project.id)
    }

    // Audit log
    await adminClient.from('audit_log').insert({
      id: crypto.randomUUID(),
      actor_user_id: user.id,
      application_id: app.id,
      action: 'queue_grade_application',
    })

    return NextResponse.json({ success: true, message: 'Grading queued' })
  } catch (error: any) {
    console.error('Error in POST /api/admin/grade-application:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
