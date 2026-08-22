#!/usr/bin/env node
/**
 * Local AI grader — run with: npm run grade
 *
 * 1. Fetches all applications with projects having fetch_status='pending'.
 * 2. For each application, delegates to gradeOneApplication() which:
 *    - Ensures an applicant record exists (auto-creates from roster if missing).
 *    - For each pending project, clones, parses, and evaluates.
 *    - Writes evaluation results back to Supabase.
 *    - Updates status tracking.
 * 3. Logs timestamp to .grader-last-run
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
import path from 'path';
import { createAdminClient } from '../lib/supabase/server';
import { gradeOneApplication } from './gradeOne';

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

  for (const appId of appIds) {
    console.log(`─── Grading Application: ${appId} ───`);
    try {
      const result = await gradeOneApplication(supabase, appId);
      console.log(`  Result: ${result.status} — ${result.gradedProjects} graded, ${result.failedProjects.length} failed\n`);
    } catch (err: any) {
      console.error(`  ✗ Failed Application Processing: ${err.message}\n`);
      // gradeOneApplication already handles status updates internally,
      // but if it throws entirely, mark the application as error
      await supabase.from('applications').update({ status: 'error' }).eq('id', appId);
    }
  }

  fs.writeFileSync(path.join(process.cwd(), '.grader-last-run'), new Date().toISOString());
  console.log('Done grading pending projects.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
