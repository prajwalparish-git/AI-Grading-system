import { NextRequest } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'
import { submitRatelimit, getIp } from '@/lib/ratelimit'

export async function POST(request: NextRequest) {
  // Auth
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit (per user)
  const { success, reset } = await submitRatelimit.limit(user.id)
  if (!success) {
    return Response.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)) } }
    )
  }

  const body = await request.json()
  const { repo_url, demo_url, answers, action } = body

  if (!repo_url || typeof repo_url !== 'string') {
    return Response.json({ error: 'repo_url is required.' }, { status: 400 })
  }

  // Validate repo URL format
  const repoPattern = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/
  if (!repoPattern.test(repo_url.trim())) {
    return Response.json({ error: 'Invalid GitHub repository URL.' }, { status: 400 })
  }

  if (action !== 'draft' && action !== 'submit') {
    return Response.json({ error: 'Invalid action.' }, { status: 400 })
  }

  // Check for existing submitted/graded submission (cannot re-submit)
  const { data: existing } = await supabase
    .from('submissions')
    .select('id, status')
    .eq('user_id', user.id)
    .single()

  if (existing && (existing.status === 'submitted' || existing.status === 'graded')) {
    return Response.json({ error: 'Already submitted.' }, { status: 409 })
  }

  const service = createServiceClient()
  const now = new Date().toISOString()

  const status = (action === 'submit' ? 'submitted' : 'draft') as 'submitted' | 'draft'
  const payload = {
    user_id: user.id,
    repo_url: repo_url.trim(),
    demo_url: demo_url?.trim() || null,
    answers: answers ?? {},
    status,
    ...(action === 'submit' ? { submitted_at: now } : {}),
  }

  // Upsert: ON CONFLICT (user_id) the DB-level UNIQUE constraint handles races
  const { error } = await service
    .from('submissions')
    .upsert(payload, { onConflict: 'user_id', ignoreDuplicates: false })

  if (error) {
    // 23505 = unique_violation — concurrent double-submit, one already won
    if (error.code === '23505') {
      return Response.json({ error: 'Already submitted.' }, { status: 409 })
    }
    console.error('Submit error:', error)
    return Response.json({ error: 'Submission failed. Please try again.' }, { status: 500 })
  }

  return Response.json({ ok: true, action })
}
