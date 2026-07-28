import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GradeDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: submission } = await supabase
    .from('submissions')
    .select(`
      id, repo_url, demo_url, status, submitted_at, answers,
      users ( name, email, cohort ),
      grades ( criterion, score, max, rationale, model, graded_at )
    `)
    .eq('id', id)
    .single()

  if (!submission) redirect('/admin/grades')

  const grades = Array.isArray(submission.grades) ? submission.grades : []
  const profile = Array.isArray(submission.users) ? submission.users[0] : submission.users
  const answers = submission.answers as Record<string, string>

  const total = grades.reduce((sum, g) => sum + g.score, 0)
  const max = grades.reduce((sum, g) => sum + g.max, 0)

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profile?.name ?? 'Student'}</h1>
            <p className="text-sm text-gray-500">{profile?.email} · Cohort: {profile?.cohort ?? '—'}</p>
          </div>
          <Link href="/admin/grades" className="text-sm text-indigo-600 hover:underline">← Grades</Link>
        </div>

        {/* Score card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 flex gap-6 items-center">
          <div className="text-5xl font-bold text-indigo-600">
            {max > 0 ? Math.round((total / max) * 100) : 0}%
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-800">{total.toFixed(1)} / {max} pts</p>
            <a href={submission.repo_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-sm hover:underline">
              View repository →
            </a>
          </div>
        </div>

        {/* All criteria (admins see hidden ones too) */}
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 mb-6">
          {grades.map((g) => (
            <div key={g.criterion} className="p-5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-800 text-sm">{g.criterion}</h3>
                <span className="text-sm font-semibold text-gray-700">{g.score} / {g.max}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full mb-3">
                <div
                  className="h-1.5 bg-indigo-500 rounded-full"
                  style={{ width: `${g.max > 0 ? (g.score / g.max) * 100 : 0}%` }}
                />
              </div>
              {g.rationale && <p className="text-xs text-gray-500 leading-relaxed">{g.rationale}</p>}
            </div>
          ))}
        </div>

        {/* Written answers */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Written answers</h2>
          <div className="space-y-4">
            {Object.entries(answers).map(([key, val]) => (
              <div key={key}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{key.replace(/_/g, ' ')}</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 whitespace-pre-wrap">{val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
