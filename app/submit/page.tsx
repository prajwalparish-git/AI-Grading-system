import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import SubmitForm from './SubmitForm'

export default async function SubmitPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check if already submitted
  const { data: existing } = await supabase
    .from('submissions')
    .select('id, status, repo_url, demo_url, answers, submitted_at')
    .eq('user_id', user.id)
    .single()

  const { data: profile } = await supabase
    .from('users')
    .select('name, cohort')
    .eq('id', user.id)
    .single()

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Project Submission</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome, {profile?.name ?? user.email}. Submit your project below.
          </p>
        </div>

        {existing?.status === 'submitted' || existing?.status === 'graded' ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Submission received</h2>
            <p className="text-sm text-gray-500 mb-1">
              Submitted {existing.submitted_at ? new Date(existing.submitted_at).toLocaleString() : ''}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Repo: <a href={existing.repo_url} className="text-indigo-600 underline" target="_blank" rel="noopener noreferrer">{existing.repo_url}</a>
            </p>
            {existing.status === 'graded' && (
              <a
                href="/results"
                className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                View your results →
              </a>
            )}
            {existing.status === 'submitted' && (
              <p className="text-sm text-gray-400">Grading in progress — check back soon.</p>
            )}
          </div>
        ) : (
          <SubmitForm
            userId={user.id}
            draft={existing ? {
              id: existing.id,
              repo_url: existing.repo_url,
              demo_url: existing.demo_url,
              answers: (existing.answers ?? {}) as Record<string, string>,
            } : null}
          />
        )}
      </div>
    </main>
  )
}
