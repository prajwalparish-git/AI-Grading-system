/**
 * Shared grading logic — used by both the CLI worker (grader/index.ts)
 * and the admin API route (POST /api/admin/grade-application).
 *
 * Given a Supabase admin client and an application ID, this function:
 *  1. Fetches the application + roster + projects
 *  2. Ensures a legacy applicant record exists (creates one from roster data if missing)
 *  3. For each pending project: clones, evaluates via Groq, writes submission + evaluation
 *  4. Updates project fetch_status, applicant status, and application status
 */
import { createAdminClient } from '../lib/supabase/server';
import { cloneAndParseRepo } from './github';
import { evaluateCodeWithGroq } from './groq';

/** The Supabase client type returned by createAdminClient (SupabaseClient<Database>) */
type AdminClient = ReturnType<typeof createAdminClient>;

export interface GradeResult {
  applicationId: string;
  applicantId: string;
  status: 'graded' | 'error';
  gradedProjects: number;
  failedProjects: string[];
  /** Per-project scores (repo_url → overall_score) */
  scores: Record<string, number>;
}

export async function gradeOneApplication(
  supabase: AdminClient,
  applicationId: string,
): Promise<GradeResult> {
  // 1. Fetch application with roster + projects
  const { data: app, error: appFetchError } = await supabase
    .from('applications')
    .select(`
      id,
      user_id,
      roster_id,
      status,
      roster ( name, email ),
      projects ( id, repo_url, fetch_status )
    `)
    .eq('id', applicationId)
    .single();

  if (appFetchError || !app) {
    throw new Error(`Application not found: ${appFetchError?.message || applicationId}`);
  }

  if (!app.user_id) {
    throw new Error('Application missing user_id');
  }

  const rosterData = Array.isArray(app.roster) ? app.roster[0] : app.roster;
  const userName = rosterData?.name || 'Unknown Applicant';
  const userEmail = rosterData?.email || '';

  // 2. Ensure legacy applicant record exists
  let { data: applicant } = await supabase
    .from('applicants')
    .select('id, user_id, name, email, status')
    .eq('user_id', app.user_id)
    .maybeSingle();

  let applicantId: string;

  if (!applicant) {
    // Auto-create from roster data
    const firstRepoUrl = ((app.projects as any[]) || []).find((p: any) => p.repo_url)?.repo_url
      || 'https://github.com/unknown/unknown';

    const { data: newApplicant, error: createErr } = await supabase
      .from('applicants')
      .insert({
        user_id: app.user_id,
        name: userName,
        email: userEmail,
        github_url: firstRepoUrl,
        language: 'TypeScript',
        status: 'grading',
      })
      .select('id')
      .single();

    if (createErr || !newApplicant) {
      throw new Error(`Failed to create legacy applicant: ${createErr?.message}`);
    }

    applicantId = newApplicant.id;
    console.log(`  → Auto-created legacy applicant: ${applicantId}`);
  } else {
    applicantId = applicant.id;
    await supabase.from('applicants').update({ status: 'grading' }).eq('id', applicantId);
  }

  // Set application status to grading
  await supabase.from('applications').update({ status: 'submitted' }).eq('id', app.id);

  // 3. Grade each pending project
  const projects = ((app.projects as any[]) || []).filter(
    (p: any) => p.fetch_status === 'pending',
  );

  let allPassed = true;
  const failedRepos: string[] = [];
  const scores: Record<string, number> = {};
  let gradedCount = 0;

  for (const project of projects) {
    console.log(`  Parsing repo: ${project.repo_url}`);

    try {
      const chunks = await cloneAndParseRepo(project.repo_url);
      console.log(`  Auditing code with Groq AI (${chunks.length} chunks)...`);
      const evaluation = await evaluateCodeWithGroq(chunks, 'TypeScript');

      // Upsert submission record
      const { data: existingSub } = await supabase
        .from('submissions')
        .select('id')
        .eq('applicant_id', applicantId)
        .eq('repo_url', project.repo_url)
        .maybeSingle();

      let submissionId = existingSub?.id;

      if (!submissionId) {
        const { data: newSub, error: subErr } = await supabase
          .from('submissions')
          .insert({
            applicant_id: applicantId,
            repo_url: project.repo_url,
            raw_code_text: `// Parsed in ${chunks.length} chunks. See evaluations.`,
          })
          .select('id')
          .single();

        if (subErr) throw subErr;
        submissionId = newSub.id;
      } else {
        await supabase
          .from('submissions')
          .update({ raw_code_text: `// Parsed in ${chunks.length} chunks. See evaluations.` })
          .eq('id', submissionId);
      }

      // Upsert evaluation record
      const { data: existingEval } = await supabase
        .from('evaluations')
        .select('id')
        .eq('submission_id', submissionId)
        .maybeSingle();

      if (!existingEval) {
        const { error: evalErr } = await supabase.from('evaluations').insert({
          submission_id: submissionId,
          overall_score: evaluation.overall_score,
          criteria_scores: evaluation.criteria_scores as unknown as any,
          ai_summary: evaluation.summary,
          vulnerabilities: evaluation.vulnerabilities as unknown as any,
        });

        if (evalErr) throw evalErr;
      } else {
        // Update existing evaluation with fresh scores
        await supabase
          .from('evaluations')
          .update({
            overall_score: evaluation.overall_score,
            criteria_scores: evaluation.criteria_scores as unknown as any,
            ai_summary: evaluation.summary,
            vulnerabilities: evaluation.vulnerabilities as unknown as any,
            evaluated_at: new Date().toISOString(),
          })
          .eq('id', existingEval.id);
      }

      // Mark project as successfully graded
      await supabase
        .from('projects')
        .update({ fetch_status: 'ok', fetch_error: null, last_checked_at: new Date().toISOString() })
        .eq('id', project.id);

      scores[project.repo_url] = evaluation.overall_score;
      gradedCount++;
      console.log(`  ✓ Graded: Overall Score ${evaluation.overall_score}/10\n`);
    } catch (repoErr: any) {
      console.error(`  ✗ Failed repo ${project.repo_url}: ${repoErr.message}`);
      await supabase
        .from('projects')
        .update({
          fetch_status: 'failed',
          fetch_error: repoErr.message?.slice(0, 500) || 'Unknown error',
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', project.id);
      failedRepos.push(project.repo_url);
      allPassed = false;
    }
  }

  // 4. Update final statuses
  if (allPassed && gradedCount > 0) {
    await supabase.from('applicants').update({ status: 'completed' }).eq('id', applicantId);
    await supabase.from('applications').update({ status: 'graded' }).eq('id', app.id);
  } else if (!allPassed) {
    await supabase.from('applicants').update({ status: 'error' }).eq('id', applicantId);
    await supabase.from('applications').update({ status: 'error' }).eq('id', app.id);
  }

  return {
    applicationId: app.id,
    applicantId,
    status: allPassed && gradedCount > 0 ? 'graded' : 'error',
    gradedProjects: gradedCount,
    failedProjects: failedRepos,
    scores,
  };
}
