import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { cloneAndParseRepo } from '@/grader/github'
import { evaluateCodeWithGroq } from '@/grader/groq'

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

    // Ensure legacy applicant record exists
    let { data: applicant } = await adminClient
      .from('applicants')
      .select('id')
      .eq('user_id', app.user_id)
      .maybeSingle()

    let applicantId = applicant?.id

    if (!applicantId) {
      const { data: newApp, error: appErr } = await adminClient
        .from('applicants')
        .insert({
          user_id: app.user_id,
          name: userName,
          email: userEmail,
          github_url: 'https://github.com/unknown/unknown',
          language: 'TypeScript',
          status: 'grading',
        })
        .select('id')
        .single()
      
      if (appErr) throw appErr
      applicantId = newApp.id
    } else {
      await adminClient.from('applicants').update({ status: 'grading' }).eq('id', applicantId)
    }

    const projects = (app.projects as any[]) || []
    
    // Grade projects
    for (const project of projects) {
      if (project.fetch_status === 'ok') continue

      try {
        const rawCode = await cloneAndParseRepo(project.repo_url)
        const evaluation = await evaluateCodeWithGroq(rawCode, 'TypeScript')

        // Find or create submission
        const { data: submission } = await adminClient
          .from('submissions')
          .select('id')
          .eq('applicant_id', applicantId)
          .eq('repo_url', project.repo_url)
          .maybeSingle()

        let submissionId = submission?.id

        if (!submissionId) {
          const { data: newSub, error: subErr } = await adminClient
            .from('submissions')
            .insert({
              applicant_id: applicantId,
              repo_url: project.repo_url,
              raw_code_text: rawCode,
            })
            .select('id')
            .single()

          if (subErr) throw subErr
          submissionId = newSub.id
        } else {
          await adminClient.from('submissions').update({ raw_code_text: rawCode }).eq('id', submissionId)
        }

        // Insert or ignore evaluation
        const { data: existingEval } = await adminClient
          .from('evaluations')
          .select('id')
          .eq('submission_id', submissionId)
          .maybeSingle()

        if (!existingEval) {
          const { error: evalErr } = await adminClient.from('evaluations').insert({
            submission_id: submissionId,
            overall_score: evaluation.overall_score,
            criteria_scores: evaluation.criteria_scores as unknown as any,
            ai_summary: evaluation.summary,
            vulnerabilities: evaluation.vulnerabilities as unknown as any,
          })
          if (evalErr) throw evalErr
        }

        await adminClient.from('projects').update({ fetch_status: 'ok' }).eq('id', project.id)
      } catch (err: any) {
        console.error(`Error grading project ${project.repo_url}:`, err)
        await adminClient.from('projects').update({ fetch_status: 'failed', fetch_error: err.message }).eq('id', project.id)
      }
    }

    await adminClient.from('applicants').update({ status: 'completed' }).eq('id', applicantId)
    // Update original application
    await adminClient.from('applications').update({ status: 'graded' }).eq('id', app.id)

    // Audit log
    await adminClient.from('audit_log').insert({
      id: crypto.randomUUID(),
      actor_user_id: user.id,
      application_id: app.id,
      action: 'grade_application',
    })

    return NextResponse.json({ success: true, message: 'Application graded successfully' })
  } catch (error: any) {
    console.error('Error in POST /api/admin/grade-application:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
