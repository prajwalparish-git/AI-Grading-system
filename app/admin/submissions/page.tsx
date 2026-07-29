import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'

export default async function SubmissionsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch submissions joined with applicants (not 'users' — that table doesn't exist)
  const { data: submissions } = await supabase
    .from('submissions')
    .select(`
      id, repo_url, submitted_at,
      applicants ( name, email, status )
    `)
    .order('submitted_at', { ascending: false })

  const statusColor: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    grading: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
            <p className="text-sm text-gray-500 mt-1">{submissions?.length ?? 0} total</p>
          </div>
          <Link href="/admin" className="text-sm text-indigo-600 hover:underline">← Dashboard</Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Repo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Submitted</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(submissions ?? []).map((s) => {
                const applicant = Array.isArray(s.applicants) ? s.applicants[0] : s.applicants
                const status = applicant?.status ?? 'pending'
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{applicant?.name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{applicant?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={s.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline truncate max-w-xs block"
                      >
                        {s.repo_url.replace('https://github.com/', '')}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[status] ?? statusColor.pending}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {status === 'completed' && (
                        <Link href={`/admin/grades/${s.id}`} className="text-indigo-600 hover:underline text-xs">
                          View grades
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {(!submissions || submissions.length === 0) && (
            <div className="text-center py-12 text-gray-400 text-sm">No submissions yet.</div>
          )}
        </div>
      </div>
    </main>
  )
}
