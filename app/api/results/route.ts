import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/results
 *
 * Authenticated endpoint — returns evaluation results for the current user.
 * Queries the unified Model A schema: applicants → submissions → evaluations.
 * RLS ensures only the user's own data is returned.
 */

const HIDDEN_CRITERIA = new Set([
  'Prompt Engineering',
  'Token-Context Efficiency',
  'API Security',
  'Integrity & Honesty',
]);

export async function GET() {
  const supabase = await createServerClient();

  // Auth check (middleware also enforces this, but defence in depth)
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 });
  }

  // 1. Fetch the applicant record for the current user (RLS-scoped)
  const { data: applicant, error: applicantError } = await supabase
    .from('applicants')
    .select('id, name, status, github_url, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (applicantError || !applicant) {
    return Response.json({ error: 'No submission found for this account.' }, { status: 404 });
  }

  if (applicant.status !== 'completed') {
    return Response.json({ status: applicant.status, message: 'Evaluation is not yet complete.' }, { status: 200 });
  }

  // 2. Fetch the most recent submission for this applicant
  const { data: submission } = await supabase
    .from('submissions')
    .select('id, repo_url, submitted_at')
    .eq('applicant_id', applicant.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single();

  if (!submission) {
    return Response.json({ error: 'No submission found.' }, { status: 404 });
  }

  // 3. Fetch evaluation for this submission
  const { data: evaluation } = await supabase
    .from('evaluations')
    .select('overall_score, criteria_scores, ai_summary, vulnerabilities, evaluated_at')
    .eq('submission_id', submission.id)
    .order('evaluated_at', { ascending: false })
    .limit(1)
    .single();

  if (!evaluation) {
    return Response.json({ error: 'No evaluation found.' }, { status: 404 });
  }

  // 4. Filter out hidden criteria from the JSONB scores
  const criteriaScores = (evaluation.criteria_scores ?? {}) as Record<string, unknown>;
  const visibleCriteria: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(criteriaScores)) {
    if (!HIDDEN_CRITERIA.has(key)) {
      visibleCriteria[key] = value;
    }
  }

  return Response.json({
    status: 'completed',
    applicant: {
      id: applicant.id,
      name: applicant.name,
      github_url: applicant.github_url,
    },
    submission: {
      repo_url: submission.repo_url,
      submitted_at: submission.submitted_at,
    },
    evaluation: {
      overall_score: evaluation.overall_score,
      criteria_scores: visibleCriteria,
      ai_summary: evaluation.ai_summary,
      vulnerabilities: evaluation.vulnerabilities,
      evaluated_at: evaluation.evaluated_at,
    },
  });
}
