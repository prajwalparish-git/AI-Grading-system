import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { selectedApplicationIds, questions, publishScores } = await req.json()

    if (!Array.isArray(selectedApplicationIds) || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Process all applications
    // First, set all to 'rejected', questions, and scores flag
    await adminClient
      .from('applications')
      .update({
        selection_status: 'rejected',
        published_questions: questions,
        scores_published: !!publishScores
      })
      .neq('status', 'withdrawn')

    // Then, for selected ones, set to 'selected'
    if (selectedApplicationIds.length > 0) {
      await adminClient
        .from('applications')
        .update({
          selection_status: 'selected'
        })
        .in('id', selectedApplicationIds)
    }

    // Audit log
    await adminClient.from('audit_log').insert({
      id: crypto.randomUUID(),
      actor_user_id: user.id,
      action: 'publish_results',
      payload: { 
        selected_count: selectedApplicationIds.length,
        publish_scores: publishScores,
        questions_count: questions.length
      }
    })

    return NextResponse.json({ success: true, message: 'Results published successfully' })
  } catch (error: any) {
    console.error('Error in POST /api/admin/publish:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
