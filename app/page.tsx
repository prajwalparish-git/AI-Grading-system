import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/apply')

  const role = user.app_metadata?.role ?? user.user_metadata?.role
  redirect(role === 'admin' ? '/admin' : '/apply')
}
