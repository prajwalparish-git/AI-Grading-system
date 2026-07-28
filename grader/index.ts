#!/usr/bin/env node
/**
 * Local AI grader — run with: npm run grade
 *
 * 1. Fetches all 'submitted' & ungraded submissions from Supabase.
 * 2. For each: fetches GitHub repo context + runs gitleaks.
 * 3. Calls Groq (Llama 3.3 70B, JSON mode) to grade against the 13-criterion rubric.
 * 4. Writes grades back to Supabase and marks submission as 'graded'.
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY, GITHUB_PAT in .env
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { fetchRepoContext, runGitleaks } from './github'
import { gradeSubmission } from './groq'
import type { Database } from '../lib/database.types'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'

// Optional: only grade a specific submission by ID
const TARGET_ID = process.argv[2]

async function main() {
  console.log('🎓 AI Grader starting…\n')

  // 1. Fetch ungraded submissions
  let query = supabase
    .from('submissions')
    .select('id, user_id, repo_url, demo_url, answers')
    .eq('status', 'submitted')

  if (TARGET_ID) {
    query = query.eq('id', TARGET_ID)
    console.log(`Targeting single submission: ${TARGET_ID}\n`)
  }

  const { data: submissions, error: fetchError } = await query
  if (fetchError) { console.error('Failed to fetch submissions:', fetchError); process.exit(1) }
  if (!submissions?.length) { console.log('No submissions to grade. Done.'); return }

  console.log(`Found ${submissions.length} submission(s) to grade.\n`)

  let succeeded = 0
  let failed = 0

  for (const sub of submissions) {
    console.log(`─── ${sub.id} (${sub.repo_url}) ───`)

    try {
      // 2. Gather evidence
      process.stdout.write('  Fetching repo context…')
      const { tree, keyFiles, commits } = await fetchRepoContext(sub.repo_url)
      process.stdout.write(' done\n')

      process.stdout.write('  Running gitleaks…')
      const gitleaksFindings = await runGitleaks(sub.repo_url)
      process.stdout.write(` done (${JSON.parse(gitleaksFindings).length} findings)\n`)

      // 3. Grade with Groq
      process.stdout.write('  Calling Groq…')
      const grades = await gradeSubmission({
        repoTree: tree,
        keyFiles,
        commits,
        gitleaksFindings,
        answers: (sub.answers ?? {}) as Record<string, string>,
        demoUrl: sub.demo_url,
      })
      process.stdout.write(` done (${grades.length} criteria)\n`)

      // 4. Write grades to DB
      const gradeRows = grades.map((g) => ({
        submission_id: sub.id,
        criterion: g.criterion,
        score: g.score,
        max: g.max,
        rationale: g.rationale,
        model: MODEL,
      }))

      const { error: gradeError } = await supabase
        .from('grades')
        .upsert(gradeRows, { onConflict: 'submission_id,criterion' })

      if (gradeError) throw gradeError

      const { error: statusError } = await supabase
        .from('submissions')
        .update({ status: 'graded' })
        .eq('id', sub.id)

      if (statusError) throw statusError

      const total = grades.reduce((s, g) => s + g.score, 0)
      const max = grades.reduce((s, g) => s + g.max, 0)
      const pct = Math.round((total / max) * 100)
      console.log(`  ✓ Graded: ${total.toFixed(1)}/${max} (${pct}%)\n`)
      succeeded++

    } catch (err) {
      console.error(`  ✗ Failed: ${(err as Error).message}\n`)
      failed++
    }

    // Brief pause between submissions to respect Groq RPM limits
    if (submissions.indexOf(sub) < submissions.length - 1) {
      await new Promise((r) => setTimeout(r, 2_000))
    }
  }

  console.log(`\nDone — ${succeeded} graded, ${failed} failed.`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
