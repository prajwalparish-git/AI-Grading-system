import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PublishClient from './PublishClient'

export const metadata = {
  title: 'Publish Results - Admin',
}

export default async function PublishPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'admin') {
    redirect('/login')
  }

  // Fetch applications that have valid status to be selected
  const { data: applications, error } = await supabase
    .from('applications')
    .select(`
      id,
      status,
      selection_status,
      published_questions,
      scores_published,
      roster:roster_id ( usn, name )
    `)
    .in('status', ['submitted', 'graded', 'verified'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching applications for publish:', error)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Publish Results</h1>
        <p className="text-slate-400 text-sm mt-1">Configure what the students see on their results page and select the winning candidates.</p>
      </div>
      <PublishClient initialData={applications || []} />
    </div>
  )
}
