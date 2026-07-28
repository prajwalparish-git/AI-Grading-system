import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'

export default async function GradesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: submissions } = await supabase
    .from('submissions')
    .select(`
      id, repo_url, status,
      users ( name, email ),
      grades ( criterion, score, max )
    `)
    .eq('status', 'graded')
    .order('id', { ascending: false })

  const rows = (submissions ?? []).map((s) => {
    const grades = Array.isArray(s.grades) ? s.grades : []
    const total = grades.reduce((sum, g) => sum + g.score, 0)
    const max = grades.reduce((sum, g) => sum + g.max, 0)
    const pct = max > 0 ? Math.round((total / max) * 100) : 0
    const profile = Array.isArray(s.users) ? s.users[0] : s.users
    return { ...s, profile, total, max, pct }
  }).sort((a, b) => b.pct - a.pct)

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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-400">#{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{row.profile?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{row.profile?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full">
                        <div
                          className="h-1.5 rounded-full bg-indigo-500"
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                      <span className="font-semibold text-gray-700">{row.pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{row.total.toFixed(1)} / {row.max}</td>
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
