import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'

export default async function GradesPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Query submissions joined with applicants and evaluations (not 'users'/'grades')
  const { data: submissions } = await supabase
    .from('submissions')
    .select(`
      id, repo_url,
      applicants ( name, email, status ),
      evaluations ( overall_score, criteria_scores )
    `)
    .order('submitted_at', { ascending: false })

  const rows = (submissions ?? [])
    .filter((s) => {
      const applicant = Array.isArray(s.applicants) ? s.applicants[0] : s.applicants
      return applicant?.status === 'completed'
    })
    .map((s) => {
      const applicant = Array.isArray(s.applicants) ? s.applicants[0] : s.applicants
      const evaluation = Array.isArray(s.evaluations) ? s.evaluations[0] : s.evaluations
      const overallScore = evaluation?.overall_score != null ? Number(evaluation.overall_score) : 0
      return { ...s, applicant, overallScore }
    })
    .sort((a, b) => b.overallScore - a.overallScore)

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Grades</h1>
            <p className="text-sm text-gray-500 mt-1">{rows.length} graded submissions</p>
          </div>
          <Link href="/admin" className="text-sm text-indigo-600 hover:underline">← Dashboard</Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rank</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Score</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Overall</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-400">#{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{row.applicant?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{row.applicant?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full">
                        <div
                          className="h-1.5 rounded-full bg-indigo-500"
                          style={{ width: `${row.overallScore}%` }}
                        />
                      </div>
                      <span className="font-semibold text-gray-700">{row.overallScore}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{row.overallScore.toFixed(1)} / 100</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/grades/${row.id}`} className="text-indigo-600 hover:underline text-xs">
                      Full breakdown
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No graded submissions yet.</div>
          )}
        </div>
      </div>
    </main>
  )
}
