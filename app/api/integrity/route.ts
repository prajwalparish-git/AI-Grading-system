import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { integrityRatelimit } from '@/lib/ratelimit'

const VALID_TYPES = new Set(['paste', 'copy', 'cut', 'blur', 'fast_paste'])

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(null, { status: 204 }) // silently drop unauthenticated

  // Rate limit to prevent flooding the integrity_events table
  const { success } = await integrityRatelimit.limit(user.id)
  if (!success) return new Response(null, { status: 204 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response(null, { status: 204 })
  }

  const { type, field, ...rest } = body

  if (!VALID_TYPES.has(type as string)) return new Response(null, { status: 204 })

  // Use session client — RLS policy allows insert when user_id = auth.uid()
  await supabase.from('integrity_events').insert({
    user_id: user.id,
    type: type as string,
    payload: { field, ...rest } as unknown as import('@/lib/database.types').Json,
  })

  return new Response(null, { status: 204 })
}
