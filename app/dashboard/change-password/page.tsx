import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChangePasswordClient from './ChangePasswordClient'

export const metadata = {
  title: 'Change Password - Coding Club',
}

export default async function ChangePasswordPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  if (user.app_metadata?.role === 'admin') {
    redirect('/admin')
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <ChangePasswordClient email={user.email!} />
      </div>
    </div>
  )
}
