import { NextResponse } from 'next/server'
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

export async function PATCH(request: Request) {
  try {
    const session = await getApplySession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { urls } = await request.json()
    if (!Array.isArray(urls) || urls.length < 2 || urls.length > 3) {
      return NextResponse.json({ error: 'Please provide 2 or 3 GitHub project URLs.' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()
    
    const { data: application, error: appError } = await supabaseAdmin
      .from('applications')
      .select('status, edit_deadline')
      .eq('id', session.application_id)
      .single()

    if (appError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (application.status === 'withdrawn') {
      return NextResponse.json({ error: 'Application is withdrawn' }, { status: 400 })
    }

    if (application.edit_deadline && new Date(application.edit_deadline) < new Date()) {
      return NextResponse.json({ error: 'Edit deadline has passed' }, { status: 400 })
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

    if (failedRepos.length > 0) {
      await supabaseAdmin.from('audit_log').insert({
        application_id: session.application_id,
        actor_usn: session.usn,
        action: 'edit_projects_failed',
        payload: { failedRepos }
      })
      return NextResponse.json({ 
        error: 'Some repositories are not publicly accessible or do not exist.',
        failedRepos 
      }, { status: 400 })
    }

    await supabaseAdmin.from('projects').delete().eq('application_id', session.application_id)
    
    for (let i = 0; i < repos.length; i++) {
      await supabaseAdmin.from('projects').upsert({
        id: crypto.randomUUID(),
        application_id: session.application_id,
        slot: i + 1,
        repo_url: repos[i].url,
        fetch_status: 'pending',
      }, { onConflict: 'application_id, slot' })
    }

    await supabaseAdmin.from('audit_log').insert({
      application_id: session.application_id,
      actor_usn: session.usn,
      action: 'edit_repo',
    })

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Edit error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
