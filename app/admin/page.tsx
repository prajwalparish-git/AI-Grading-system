import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'

export default async function AdminDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { count: totalStudents },
    { count: totalSubmissions },
    { count: graded },
    { count: flagged },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
    supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'graded'),
    supabase.from('integrity_events').select('user_id', { count: 'exact', head: true }),
  ])

  const stats = [
    { label: 'Students registered', value: totalStudents ?? 0 },
    { label: 'Awaiting grading', value: totalSubmissions ?? 0 },
    { label: 'Graded', value: graded ?? 0 },
    { label: 'Integrity events', value: flagged ?? 0 },
  ]

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-3xl font-bold text-indigo-600">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/submissions"
            className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-indigo-300 transition-colors"
          >
            <h2 className="font-semibold text-gray-800 mb-1">Submissions</h2>
            <p className="text-sm text-gray-500">Browse all submitted projects and statuses.</p>
          </Link>

          <Link
            href="/admin/grades"
            className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-indigo-300 transition-colors"
          >
            <h2 className="font-semibold text-gray-800 mb-1">Grades</h2>
            <p className="text-sm text-gray-500">View all graded submissions with full breakdown.</p>
          </Link>

          <Link
            href="/admin/integrity"
            className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-indigo-300 transition-colors"
          >
            <h2 className="font-semibold text-gray-800 mb-1">Integrity flags</h2>
            <p className="text-sm text-gray-500">Review paste/blur events per applicant.</p>
          </Link>
        </div>

        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h2 className="font-semibold text-amber-800 mb-2">Running the AI grader</h2>
          <p className="text-sm text-amber-700 mb-3">
            Grading runs locally on your machine — it is never triggered from this UI.
          </p>
          <pre className="bg-amber-100 text-amber-900 text-xs rounded-lg px-4 py-3 overflow-x-auto">
{`# In the project directory on your machine:
npm run grade`}
          </pre>
        </div>
      </div>
    </main>
  )
}
