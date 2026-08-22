import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { gradeOneApplication } from '@/grader/gradeOne'

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

    // Verify application exists and is in a gradable state
    const { data: app, error: fetchError } = await adminClient
      .from('applications')
      .select('id, status')
      .eq('id', applicationId)
      .single()

    if (fetchError || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (app.status !== 'submitted' && app.status !== 'error') {
      return NextResponse.json(
        { error: `Application is in '${app.status}' state — only 'submitted' or 'error' can be graded` },
        { status: 400 },
      )
    }

    // Reset all projects to 'pending' so they get re-graded
    await adminClient
      .from('projects')
      .update({ fetch_status: 'pending', fetch_error: null })
      .eq('application_id', applicationId)

    // Audit log (relies on DB default for id)
    await adminClient.from('audit_log').insert({
      actor_user_id: user.id,
      application_id: app.id,
      action: 'grade_application_started',
    })

    // Run grading synchronously
    const result = await gradeOneApplication(adminClient, applicationId)

    // Audit log for completion
    await adminClient.from('audit_log').insert({
      actor_user_id: user.id,
      application_id: app.id,
      action: 'grade_application_completed',
      payload: {
        status: result.status,
        graded: result.gradedProjects,
        failed: result.failedProjects,
        scores: result.scores,
      },
    })

    return NextResponse.json({
      success: true,
      message: result.status === 'graded'
        ? `Grading complete — ${result.gradedProjects} project(s) graded`
        : `Grading finished with errors — ${result.failedProjects.length} project(s) failed`,
      ...result,
    })
  } catch (error: any) {
    console.error('Error in POST /api/admin/grade-application:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
