import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

/**
 * /results/[id] — Public results page for applicants.
 * Queries the unified Model A schema: applicants → submissions → evaluations.
 * Uses the session/anon client (RLS-aware) instead of service-role admin client.
 * The applicant ID acts as a capability token — RLS SELECT policy allows
 * reading completed applicant records.
 */

const HIDDEN_CRITERIA = new Set([
  'Prompt Engineering',
  'Token-Context Efficiency',
  'API Security',
  'Integrity & Honesty',
])

interface CriterionScore {
  name?: string
  score?: number
  max?: number
  rationale?: string
}

export default async function ResultsByIdPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: applicantId } = await params

  // Use session client (anon key, RLS-aware) — NOT the admin/service-role client
  const supabase = await createServerClient()

  // 1. Fetch applicant
  const { data: applicant } = await supabase
    .from('applicants')
    .select('id, name, status, github_url, created_at')
    .eq('id', applicantId)
    .single()

  if (!applicant) notFound()

  if (applicant.status !== 'completed') {
    return (
      <main className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Evaluation In Progress</h1>
          <p className="text-sm text-gray-500">
            Your submission is currently being evaluated. Status:{' '}
            <span className="font-semibold text-indigo-600">{applicant.status}</span>
          </p>
          <p className="text-xs text-gray-400 mt-4">
            Please refresh this page in a few moments.
          </p>
        </div>
      </main>
    )
  }

  // 2. Fetch submission
  const { data: submission } = await supabase
    .from('submissions')
    .select('id, repo_url, submitted_at')
    .eq('applicant_id', applicantId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  if (!submission) notFound()

  // 3. Fetch evaluation
  const { data: evaluation } = await supabase
    .from('evaluations')
    .select('overall_score, criteria_scores, ai_summary, vulnerabilities, evaluated_at')
    .eq('submission_id', submission.id)
    .order('evaluated_at', { ascending: false })
    .limit(1)
    .single()

  if (!evaluation) notFound()

  // 4. Parse criteria_scores JSONB into displayable rows
  const rawCriteria = evaluation.criteria_scores as Record<string, CriterionScore> | CriterionScore[] | null
  let criteriaList: CriterionScore[] = []

  if (Array.isArray(rawCriteria)) {
    criteriaList = rawCriteria
  } else if (rawCriteria && typeof rawCriteria === 'object') {
    criteriaList = Object.entries(rawCriteria).map(([key, val]) => ({
      name: key,
      ...(typeof val === 'object' && val !== null ? val : { score: 0, max: 10 }),
    }))
  }

  const visible = criteriaList.filter((c) => !HIDDEN_CRITERIA.has(c.name ?? ''))
  const totalScore = visible.reduce((sum, c) => sum + (c.score ?? 0), 0)
  const totalMax = visible.reduce((sum, c) => sum + (c.max ?? 10), 0)
  const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Your Results</h1>
          <p className="text-sm text-gray-500 mt-1">
            Submission graded · Repo:{' '}
            <a href={submission.repo_url} className="text-indigo-600 underline" target="_blank" rel="noopener noreferrer">
              {submission.repo_url}
            </a>
          </p>
        </div>

        {/* Score summary */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 flex items-center gap-6">
          <div className="text-5xl font-bold text-indigo-600">{pct}%</div>
          <div>
            <p className="text-lg font-semibold text-gray-800">{totalScore.toFixed(1)} / {totalMax} points</p>
            <p className="text-sm text-gray-400">Across {visible.length} criteria</p>
          </div>
        </div>

        {/* AI Summary */}
        {evaluation.ai_summary && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">AI Summary</h2>
            <p className="text-xs text-gray-500 leading-relaxed">{evaluation.ai_summary}</p>
          </div>
        )}

        {/* Per-criterion breakdown */}
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
          {visible.map((criterion, idx) => {
            const critPct = (criterion.max ?? 10) > 0 ? Math.round(((criterion.score ?? 0) / (criterion.max ?? 10)) * 100) : 0
            return (
              <div key={criterion.name ?? idx} className="p-5">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="font-medium text-gray-800 text-sm">{criterion.name}</h3>
                  <span className="text-sm font-semibold text-gray-700 shrink-0">
                    {criterion.score ?? 0} / {criterion.max ?? 10}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-gray-100 rounded-full mb-3">
                  <div
                    className="h-1.5 rounded-full bg-indigo-500"
                    style={{ width: `${critPct}%` }}
                  />
                </div>

                {criterion.rationale && (
                  <p className="text-xs text-gray-500 leading-relaxed">{criterion.rationale}</p>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-xs text-center text-gray-400 mt-6">
          Results are final. Contact the admissions team for queries.
        </p>
      </div>
    </main>
  )
}
