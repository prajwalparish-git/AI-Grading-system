#!/usr/bin/env node
/**
 * Local AI grader — run with: npm run grade
 *
 * 1. Fetches all 'pending' or 'grading' submissions from Supabase.
 * 2. For each: parses repo via cloneAndParseRepo.
 * 3. Calls Groq (Meta Llama 3) via evaluateCodeWithGroq.
 * 4. Writes evaluation results back to Supabase evaluations table.
 */

import 'dotenv/config';
import { createAdminClient } from '../lib/supabase/server';
import { cloneAndParseRepo } from './github';
import { evaluateCodeWithGroq } from './groq';

async function main() {
  console.log('🎓 AI Grader starting...\n');
  const supabase = createAdminClient();

  const { data: applicants, error: fetchError } = await supabase
    .from('applicants')
    .select('id, name, email, github_url, language, status')
    .in('status', ['pending', 'grading']);

  if (fetchError) {
    console.error('Failed to fetch applicants:', fetchError);
    process.exit(1);
  }

  if (!applicants || applicants.length === 0) {
    console.log('No pending applicants to grade. Done.');
    return;
  }

  console.log(`Found ${applicants.length} applicant(s) to grade.\n`);

  for (const app of applicants) {
    console.log(`─── Applicant: ${app.name} (${app.github_url}) ───`);

    try {
      console.log('  Parsing repo source code...');
      const rawCode = await cloneAndParseRepo(app.github_url);

      console.log('  Auditing code with Groq AI...');
      const evaluation = await evaluateCodeWithGroq(rawCode, app.language || 'TypeScript');

      // Check for existing submission record
      const { data: submission } = await supabase
        .from('submissions')
        .select('id')
        .eq('applicant_id', app.id)
        .single();

      let submissionId = submission?.id;

      if (!submissionId) {
        const { data: newSub, error: subErr } = await supabase
          .from('submissions')
          .insert({
            applicant_id: app.id,
            repo_url: app.github_url,
            raw_code_text: rawCode,
          })
          .select('id')
          .single();

        if (subErr) throw subErr;
        submissionId = newSub.id;
      }

      const { error: evalErr } = await supabase.from('evaluations').insert({
        submission_id: submissionId,
        overall_score: evaluation.overall_score,
        criteria_scores: evaluation.criteria_scores,
        ai_summary: evaluation.summary,
        vulnerabilities: evaluation.vulnerabilities,
      });

      if (evalErr) throw evalErr;

      await supabase.from('applicants').update({ status: 'completed' }).eq('id', app.id);
      console.log(`  ✓ Graded: Overall Score ${evaluation.overall_score}/100\n`);
    } catch (err: any) {
      console.error(`  ✗ Failed: ${err.message}\n`);
      await supabase.from('applicants').update({ status: 'error' }).eq('id', app.id);
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
