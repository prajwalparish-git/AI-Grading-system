import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

const HIDDEN_CRITERIA = new Set([
  'Prompt Engineering',
  'Token-Context Efficiency',
  'API Security',
  'Integrity & Honesty',
])

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: submission } = await supabase
    .from('submissions')
    .select('id, status, repo_url, submitted_at')
    .eq('user_id', user.id)
    .single()

  if (!submission) return Response.json({ error: 'No submission found.' }, { status: 404 })

  if (submission.status !== 'graded') {
    return Response.json({ status: submission.status }, { status: 200 })
  }

  const { data: grades } = await supabase
    .from('grades')
    .select('criterion, score, max, rationale')
    .eq('submission_id', submission.id)

  const visible = (grades ?? []).filter((g) => !HIDDEN_CRITERIA.has(g.criterion))

  return Response.json({
    status: 'graded',
    repo_url: submission.repo_url,
    submitted_at: submission.submitted_at,
    grades: visible,
    total: visible.reduce((s, g) => s + g.score, 0),
    max: visible.reduce((s, g) => s + g.max, 0),
  })
}
