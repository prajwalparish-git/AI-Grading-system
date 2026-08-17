import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export const metadata = {
  title: 'Dashboard - Coding Club',
}

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Find the application for this user
  const { data: application } = await supabase
    .from('applications')
    .select(`
      id,
      status,
      selection_status,
      withdrawn_at,
      roster:roster_id (
        usn,
        name,
        email
      )
    `)
    .eq('user_id', user.id)
    .single()

  if (!application) {
    // If no application exists, they might not have gone through the verification flow properly.
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">No Application Found</h1>
        <p className="text-slate-600">Please contact the admin if you believe this is an error.</p>
      </div>
    )
  }

  // Find their projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('application_id', application.id)
    .order('slot', { ascending: true })

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Applicant Dashboard</h1>
            <p className="text-slate-500 mt-1">Welcome back, {application.roster?.name} ({application.roster?.usn})</p>
          </div>
          <div className="text-right">
            <span className="text-sm text-slate-500 block mb-1">Status</span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize
              ${application.status === 'verified' ? 'bg-blue-50 text-blue-700' : ''}
              ${application.status === 'submitted' ? 'bg-green-50 text-green-700' : ''}
              ${application.status === 'withdrawn' ? 'bg-red-50 text-red-700' : ''}
              ${application.status === 'pending_otp' ? 'bg-yellow-50 text-yellow-700' : ''}
            `}>
              {application.status}
            </span>
          </div>
        </div>

        <DashboardClient application={application} projects={projects || []} />
      </div>
    </div>
  )
}
