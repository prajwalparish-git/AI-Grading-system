import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RosterClient from './RosterClient'

export const metadata = {
  title: 'Roster Management - Admin',
}

export default async function RosterPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'admin') {
    redirect('/login')
  }

  // Fetch initial data
  const { data: roster } = await supabase
    .from('roster')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Roster Management</h1>
        <p className="text-slate-400 text-sm mt-1">Manage the list of allowed applicants.</p>
      </div>
      <RosterClient initialData={roster || []} />
    </div>
  )
}
