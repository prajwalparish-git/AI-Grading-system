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

  // Fetch applicants with status='grading'
  const { data: gradingApplicants, error: fetchError } = await supabase
    .from('applicants')
    .select('id, user_id, name, email')
    .eq('status', 'grading');

  if (fetchError) {
    console.error('Failed to fetch grading applicants:', fetchError);
    process.exit(1);
  }

  if (!gradingApplicants || gradingApplicants.length === 0) {
    console.log('No pending applications to grade. Done.');
    return;
  }

  console.log(`Found ${gradingApplicants.length} applicant(s) to grade.\n`);

  const userIds = gradingApplicants.map(a => a.user_id).filter(Boolean);
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
    .in('user_id', userIds);

  if (appFetchError) {
    console.error('Failed to fetch applications:', appFetchError);
    process.exit(1);
  }

  for (const applicant of gradingApplicants) {
    const userName = applicant.name || 'Unknown Applicant';
    const app = applications?.find(a => a.user_id === applicant.user_id);
    
    console.log(`─── Applicant: ${userName} ───`);

    try {
      if (!applicant.user_id) throw new Error('Missing user_id on applicant');
      const applicantId = applicant.id;
      
      const projects = app ? (app.projects as any[]) || [] : [];
      for (const project of projects) {
        if (project.fetch_status === 'ok') continue;

        console.log(`  Parsing repo: ${project.repo_url}`);
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

        await supabase.from('projects').update({ fetch_status: 'ok' }).eq('id', project.id);
        console.log(`  ✓ Graded: Overall Score ${evaluation.overall_score}/10\n`);
      }

      await supabase.from('applicants').update({ status: 'completed' }).eq('id', applicantId);
      if (app) {
        await supabase.from('applications').update({ status: 'graded' }).eq('id', app.id);
      }
    } catch (err: any) {
      console.error(`  ✗ Failed: ${err.message}\n`);
      await supabase.from('applicants').update({ status: 'error' }).eq('id', applicant.id);
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
