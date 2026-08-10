#!/usr/bin/env node
/**
 * Local AI grader — run with: npm run grade
 *
 * 1. Fetches all 'submitted' applications and their projects from Supabase.
 * 2. Ensures an applicant record exists.
 * 3. For each project, clones, parses, and evaluates.
 * 4. Writes evaluation results back to Supabase.
 */

import 'dotenv/config';
import { createAdminClient } from '../lib/supabase/server';
import { cloneAndParseRepo } from './github';
import { evaluateCodeWithGroq } from './groq';

async function main() {
  console.log('🎓 AI Grader starting...\n');
  const supabase = createAdminClient();

  // Fetch applications with status='submitted'
  const { data: applications, error: fetchError } = await supabase
    .from('applications')
    .select(`
      id,
      user_id,
      roster_id,
      status,
      roster ( name, email ),
      projects ( id, repo_url, fetch_status )
    `)
    .eq('status', 'submitted');

  if (fetchError) {
    console.error('Failed to fetch applications:', fetchError);
    process.exit(1);
  }

  if (!applications || applications.length === 0) {
    console.log('No pending applications to grade. Done.');
    return;
  }

  console.log(`Found ${applications.length} application(s) to grade.\n`);

  for (const app of applications) {
    const userName = (app.roster as any)?.name || 'Unknown Applicant';
    const userEmail = (app.roster as any)?.email || '';
    
    console.log(`─── Applicant: ${userName} ───`);

    try {
      if (!app.user_id) throw new Error('Missing user_id on application');

      // Ensure applicant record exists in legacy table
      let { data: applicant } = await supabase
        .from('applicants')
        .select('id')
        .eq('user_id', app.user_id)
        .maybeSingle();

      let applicantId = applicant?.id;

      if (!applicantId) {
        const { data: newApp, error: appErr } = await supabase
          .from('applicants')
          .insert({
            user_id: app.user_id,
            name: userName,
            email: userEmail,
            github_url: 'https://github.com/unknown/unknown', // Default for legacy compatibility
            language: 'TypeScript',
            status: 'grading',
          })
          .select('id')
          .single();
        
        if (appErr) throw appErr;
        applicantId = newApp.id;
      } else {
        await supabase.from('applicants').update({ status: 'grading' }).eq('id', applicantId);
      }

      // Grade projects
      const projects = (app.projects as any[]) || [];
      for (const project of projects) {
        if (project.fetch_status === 'ok') continue;

        console.log(`  Parsing repo: ${project.repo_url}`);
        const rawCode = await cloneAndParseRepo(project.repo_url);

        console.log('  Auditing code with Groq AI...');
        const evaluation = await evaluateCodeWithGroq(rawCode, 'TypeScript');

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
              raw_code_text: rawCode,
            })
            .select('id')
            .single();

          if (subErr) throw subErr;
          submissionId = newSub.id;
        } else {
          await supabase.from('submissions').update({ raw_code_text: rawCode }).eq('id', submissionId);
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

        await supabase.from('projects').update({ fetch_status: 'ok' }).eq('id', project.id);
        console.log(`  ✓ Graded: Overall Score ${evaluation.overall_score}/10\n`);
      }

      await supabase.from('applicants').update({ status: 'completed' }).eq('id', applicantId);
      await supabase.from('applications').update({ status: 'graded' }).eq('id', app.id);
    } catch (err: any) {
      console.error(`  ✗ Failed: ${err.message}\n`);
      // Optionally update status to error
      if (app.user_id) {
         await supabase.from('applicants').update({ status: 'error' }).eq('user_id', app.user_id);
      }
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
