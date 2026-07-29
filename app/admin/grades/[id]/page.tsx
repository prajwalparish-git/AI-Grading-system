import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

interface CriterionEntry {
  name: string
  score: number
  max: number
}

export default async function GradeDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch submission with applicant and evaluation data (not 'users'/'grades')
  const { data: submission } = await supabase
    .from('submissions')
    .select(`
      id, repo_url, submitted_at,
      applicants ( name, email ),
      evaluations ( overall_score, criteria_scores, ai_summary, vulnerabilities, evaluated_at )
    `)
    .eq('id', id)
    .single()

  if (!submission) redirect('/admin/grades')

  const applicant = Array.isArray(submission.applicants) ? submission.applicants[0] : submission.applicants
  const evaluation = Array.isArray(submission.evaluations) ? submission.evaluations[0] : submission.evaluations

  // Parse criteria_scores JSONB into displayable rows
  const rawCriteria = (evaluation?.criteria_scores ?? {}) as Record<string, number>
  const criteria: CriterionEntry[] = Object.entries(rawCriteria).map(([key, score]) => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    score: Number(score),
    max: 100,
  }))

  const overallScore = evaluation?.overall_score != null ? Number(evaluation.overall_score) : 0

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{applicant?.name ?? 'Student'}</h1>
            <p className="text-sm text-gray-500">{applicant?.email}</p>
          </div>
          <Link href="/admin/grades" className="text-sm text-indigo-600 hover:underline">← Grades</Link>
        </div>

        {/* Score card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 flex gap-6 items-center">
          <div className="text-5xl font-bold text-indigo-600">
            {Math.round(overallScore)}%
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-800">{overallScore.toFixed(1)} / 100 pts</p>
            <a href={submission.repo_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-sm hover:underline">
              View repository →
            </a>
          </div>
        </div>

        {/* All criteria (admins see all, including hidden ones) */}
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 mb-6">
          {criteria.map((g) => (
            <div key={g.name} className="p-5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-800 text-sm">{g.name}</h3>
                <span className="text-sm font-semibold text-gray-700">{g.score} / {g.max}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full mb-3">
                <div
                  className="h-1.5 bg-indigo-500 rounded-full"
                  style={{ width: `${g.max > 0 ? (g.score / g.max) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* AI Summary */}
        {evaluation?.ai_summary && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="font-semibold text-gray-800 mb-4">AI Summary</h2>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 whitespace-pre-wrap">
              {evaluation.ai_summary}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
