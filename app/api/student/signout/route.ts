import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete('apply_session')
  
  // Clear Supabase session cookies (if SSR)
  cookieStore.delete('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1].split('.')[0] + '-auth-token')

  return NextResponse.json({ success: true })
}
