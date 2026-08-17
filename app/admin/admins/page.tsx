import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminsClient from './AdminsClient'

export const metadata = {
  title: 'Admin Management - Admin',
}

export default async function AdminsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'admin') {
    redirect('/login')
  }

  const adminClient = createAdminClient()
  const { data: users, error } = await adminClient.auth.admin.listUsers()
  
  if (error) {
    console.error('Failed to list users:', error)
  }

  const admins = users?.users
    .filter(u => u.app_metadata?.role === 'admin')
    .map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      is_current_user: u.id === user.id
    })) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Admin Management</h1>
        <p className="text-slate-400 text-sm mt-1">Invite new administrators and manage existing access.</p>
      </div>
      <AdminsClient initialAdmins={admins} />
    </div>
  )
}
