import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const metadata = {
  title: 'Results - Coding Club',
}

export default async function ResultsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  if (user.app_metadata?.role === 'admin') {
    redirect('/admin')
  }

  // Find the application for this user
  const { data: application } = await supabase
    .from('applications')
    .select(`
      id,
      selection_status,
      published_questions,
      scores_published
    `)
    .eq('user_id', user.id)
    .single()

  if (!application) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">No Application Found</h1>
        <p className="text-slate-600">Please complete your application first.</p>
        <Link href="/dashboard" className="text-blue-600 hover:underline mt-4 inline-block">Go to Dashboard</Link>
      </div>
    )
  }

  if (application.selection_status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Results Not Yet Published</h1>
          <p className="text-slate-600 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            We are still reviewing applications. You will be notified when results are available.
          </p>
          <Link href="/dashboard" className="text-blue-600 hover:underline mt-6 inline-block">Return to Dashboard</Link>
        </div>
      </div>
    )
  }

  const isSelected = application.selection_status === 'selected'
  const questions: string[] = Array.isArray(application.published_questions) ? application.published_questions as string[] : []

  // If scores are published, fetch their highest evaluation score
  let scoreData = null
  if (application.scores_published) {
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id')
      .eq('applicant_id', application.id)
      
    if (submissions && submissions.length > 0) {
      const subIds = submissions.map((s: any) => s.id)
      const { data: evaluations } = await supabase
        .from('evaluations')
        .select('overall_score')
        .in('submission_id', subIds)
        .order('overall_score', { ascending: false })
        .limit(1)
      
      if (evaluations && evaluations.length > 0) {
        scoreData = evaluations[0].overall_score
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Application Results</h1>
          <Link href="/dashboard" className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors">
            Back to Dashboard
          </Link>
        </div>

        <div className={`p-8 rounded-xl border shadow-sm ${isSelected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <h2 className={`text-2xl font-bold mb-2 ${isSelected ? 'text-green-800' : 'text-red-800'}`}>
            {isSelected ? 'Congratulations! You have been selected.' : 'We regret to inform you that you have not been selected.'}
          </h2>
          <p className={`${isSelected ? 'text-green-700' : 'text-red-700'}`}>
            {isSelected 
              ? 'Welcome to the Coding Club. Please review any next steps or questions from the admin below.' 
              : 'Thank you for your effort in applying. We encourage you to try again next time!'}
          </p>
        </div>

        {scoreData !== null && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Your AI Evaluation Score</h3>
              <p className="text-slate-500 text-sm">Admins have chosen to publish your evaluation score.</p>
            </div>
            <div className="text-3xl font-bold text-blue-600">
              {scoreData} / 100
            </div>
          </div>
        )}

        {questions.length > 0 && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Feedback / Next Steps</h3>
            <ul className="space-y-3">
              {questions.map((q, i) => (
                <li key={i} className="flex gap-3 text-slate-700">
                  <span className="font-bold text-slate-400">{i + 1}.</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  )
}
