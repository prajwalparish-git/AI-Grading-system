import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApplicationsClient from './ApplicationsClient'

export const metadata = {
  title: 'Applications - Admin',
}

export default async function ApplicationsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'admin') {
    redirect('/login')
  }

  // Fetch applications with their roster and project details
  const { data: applications, error } = await supabase
    .from('applications')
    .select(`
      id,
      status,
      selection_status,
      submitted_at,
      withdrawn_at,
      roster:roster_id (
        usn,
        name,
        email,
        batch
      ),
      projects (
        id,
        repo_url,
        fetch_status,
        slot
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching applications:', error)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Applications Overview</h1>
        <p className="text-slate-400 text-sm mt-1">Review applicant status and trigger evaluation pipelines.</p>
      </div>
      <ApplicationsClient initialData={applications || []} />
    </div>
  )
}
