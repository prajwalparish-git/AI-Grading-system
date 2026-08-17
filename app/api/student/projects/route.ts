import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getApplySession } from '@/lib/apply-session'

function parseGithubUrl(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'github.com') return null
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    return { owner: parts[0], repo: parts[1] }
  } catch {
    return null
  }
}

async function checkGithubRepo(owner: string, repo: string) {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Coding-Club-Admissions',
  }
  if (process.env.GITHUB_PAT) {
    headers['Authorization'] = `token ${process.env.GITHUB_PAT}`
  }
  
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers })
    return res.ok
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    const applySession = await getApplySession()

    if ((!user && !applySession) || user?.app_metadata?.role === 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let application = null;
    if (applySession) {
      const { data } = await supabase
        .from('applications')
        .select('id, status, roster_id, edit_deadline')
        .eq('id', applySession.application_id)
        .single()
      application = data
    } else if (user) {
      const { data } = await supabase
        .from('applications')
        .select('id, status, roster_id, edit_deadline')
        .eq('user_id', user.id)
        .single()
      application = data
    }

    if (!application) {
      return NextResponse.json({ error: 'No application found' }, { status: 404 })
    }

    if (application.status === 'withdrawn') {
      return NextResponse.json({ error: 'Application withdrawn' }, { status: 400 })
    }

    if (application.edit_deadline && new Date() > new Date(application.edit_deadline)) {
      return NextResponse.json({ error: 'The 48-hour edit window has expired.' }, { status: 403 })
    }

    const { urls } = await request.json()
    if (!Array.isArray(urls) || urls.length < 2 || urls.length > 3) {
      return NextResponse.json({ error: 'Please provide 2 or 3 GitHub project URLs.' }, { status: 400 })
    }

    const repos = urls.map(url => {
      const parsed = parseGithubUrl(url)
      return { url, parsed }
    })

    if (repos.some(r => !r.parsed)) {
      return NextResponse.json({ error: 'Invalid GitHub URL provided.' }, { status: 400 })
    }

    const failedRepos = []
    for (const r of repos) {
      const ok = await checkGithubRepo(r.parsed!.owner, r.parsed!.repo)
      if (!ok) failedRepos.push(r.url)
    }

    const supabaseAdmin = createAdminClient() // need admin rights for audit_log and potentially bypassing RLS on projects depending on policies

    if (failedRepos.length > 0) {
      await supabaseAdmin.from('audit_log').insert({
        id: crypto.randomUUID(),
        application_id: application.id,
        action: 'submit_projects_failed',
        payload: { failedRepos }
      })
      return NextResponse.json({ 
        error: 'Some repositories are not publicly accessible or do not exist.',
        failedRepos 
      }, { status: 400 })
    }

    for (let i = 0; i < repos.length; i++) {
      await supabaseAdmin.from('projects').upsert({
        application_id: application.id,
        slot: i + 1,
        repo_url: repos[i].url,
        fetch_status: 'pending',
      }, { onConflict: 'application_id, slot' })
    }

    const edit_deadline = new Date(Date.now() + (Number(process.env.APPLICATION_EDIT_WINDOW_HOURS) || 48) * 3600000).toISOString()
    
    // Update application to submitted
    if (application.status === 'verified' || application.status === 'pending_otp') {
      await supabaseAdmin.from('applications').update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        edit_deadline
      }).eq('id', application.id)
    }

    await supabaseAdmin.from('audit_log').insert({
      id: crypto.randomUUID(),
      application_id: application.id,
      action: 'submit_projects',
    })

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('Submit error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
