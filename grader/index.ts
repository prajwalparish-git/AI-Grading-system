#!/usr/bin/env node
/**
 * Local AI grader — run with: npm run grade
 *
 * 1. Fetches all applications with projects having fetch_status='pending'.
 * 2. Ensures an applicant record exists.
 * 3. For each pending project, clones, parses, and evaluates.
 * 4. Writes evaluation results back to Supabase.
 * 5. Updates status tracking and logs timestamp to .grader-last-run
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
import path from 'path';
import { createAdminClient } from '../lib/supabase/server';
import { cloneAndParseRepo } from './github';
import { evaluateCodeWithGroq } from './groq';

async function main() {
  console.log('🎓 AI Grader starting...\n');
  const supabase = createAdminClient();

  // Find all projects that need to be graded
  const { data: pendingProjects, error: projError } = await supabase
    .from('projects')
    .select('id, application_id, repo_url')
    .eq('fetch_status', 'pending');

  if (projError) {
    console.error('Failed to fetch pending projects:', projError);
    process.exit(1);
  }

  if (!pendingProjects || pendingProjects.length === 0) {
    console.log('No pending projects to grade. Done.');
    fs.writeFileSync(path.join(process.cwd(), '.grader-last-run'), new Date().toISOString());
    return;
  }

  const appIds = [...new Set(pendingProjects.map(p => p.application_id).filter(Boolean))] as string[];
  console.log(`Found ${pendingProjects.length} pending project(s) across ${appIds.length} application(s).\n`);

  const { data: applications, error: appFetchError } = await supabase
    .from('applications')
    .select(`
      id,
      user_id,
      roster_id,
      status,
      roster ( name, email ),
      projects ( id, repo_url, fetch_status )
    `)
    .in('id', appIds);

  if (appFetchError || !applications) {
    console.error('Failed to fetch applications:', appFetchError);
    process.exit(1);
  }

  const userIds = applications.map(a => a.user_id).filter(Boolean);
  const { data: applicants } = await supabase
    .from('applicants')
    .select('id, user_id, name, email, status')
    .in('user_id', userIds);

  for (const app of applications) {
    const applicant = applicants?.find(a => a.user_id === app.user_id);
    const rosterData = Array.isArray(app.roster) ? app.roster[0] : app.roster;
    const userName = rosterData?.name || applicant?.name || 'Unknown Applicant';

    console.log(`─── Applicant: ${userName} ───`);

    try {
      if (!applicant) throw new Error('Missing old applicant record for user');
      const applicantId = applicant.id;

      const projects = (app.projects as any[]) || [];
      const pendingAppProjects = projects.filter(p => p.fetch_status === 'pending');

      let allPassed = true;
      let failedRepos: string[] = [];

      for (const project of pendingAppProjects) {
        console.log(`  Parsing repo: ${project.repo_url}`);

        try {
          const chunks = await cloneAndParseRepo(project.repo_url);
          console.log(`  Auditing code with Groq AI (${chunks.length} chunks)...`);
          const evaluation = await evaluateCodeWithGroq(chunks, 'TypeScript');

          // Check for existing submission record for this project
          const { data: submission } = await supabase
            .from('submissions')
            .select('id')
            .eq('applicant_id', applicantId)
            .eq('repo_url', project.repo_url)
            .maybeSingle();

          let submissionId = submission?.id;

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
            await supabase.from('submissions').update({ raw_code_text: `// Parsed in ${chunks.length} chunks. See evaluations.` }).eq('id', submissionId);
          }

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
          }

          await supabase.from('projects').update({ fetch_status: 'ok', fetch_error: null }).eq('id', project.id);
          console.log(`  ✓ Graded: Overall Score ${evaluation.overall_score}/10\n`);
        } catch (repoErr: any) {
          console.error(`  ✗ Failed repo ${project.repo_url}: ${repoErr.message}`);
          await supabase.from('projects').update({ fetch_status: 'failed', fetch_error: repoErr.message }).eq('id', project.id);
          failedRepos.push(project.repo_url);
          allPassed = false;
        }
      }

      if (allPassed) {
        await supabase.from('applicants').update({ status: 'completed' }).eq('id', applicant.id);
        await supabase.from('applications').update({ status: 'graded' }).eq('id', app.id);
      } else {
        await supabase.from('applicants').update({ status: 'error' }).eq('id', applicant.id);
        await supabase.from('applications').update({ status: 'error' }).eq('id', app.id);
      }
    } catch (err: any) {
      console.error(`  ✗ Failed Application Processing: ${err.message}\n`);
      if (applicant) {
        await supabase.from('applicants').update({ status: 'error' }).eq('id', applicant.id);
      }
      await supabase.from('applications').update({ status: 'error' }).eq('id', app.id);
    }
  }

  fs.writeFileSync(path.join(process.cwd(), '.grader-last-run'), new Date().toISOString());
  console.log('Done grading pending projects.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
