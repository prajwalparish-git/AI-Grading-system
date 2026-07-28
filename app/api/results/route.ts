import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/results?applicantId=<uuid>
 *
 * Public endpoint — returns evaluation results for a given applicant.
 * Queries the unified Model A schema: applicants → submissions → evaluations.
 */

const HIDDEN_CRITERIA = new Set([
  'Prompt Engineering',
  'Token-Context Efficiency',
  'API Security',
  'Integrity & Honesty',
]);

export async function GET(request: NextRequest) {
  const applicantId = request.nextUrl.searchParams.get('applicantId');

  if (!applicantId) {
    return Response.json({ error: 'Missing required query parameter: applicantId' }, { status: 400 });
  }

  const supabase = createServerClient();

  // 1. Fetch the applicant record
  const { data: applicant, error: applicantError } = await supabase
    .from('applicants')
    .select('id, name, status, github_url, created_at')
    .eq('id', applicantId)
    .single();

  if (applicantError || !applicant) {
    return Response.json({ error: 'Applicant not found.' }, { status: 404 });
  }

  if (applicant.status !== 'completed') {
    return Response.json({ status: applicant.status, message: 'Evaluation is not yet complete.' }, { status: 200 });
  }

  // 2. Fetch the most recent submission for this applicant
  const { data: submission } = await supabase
    .from('submissions')
    .select('id, repo_url, submitted_at')
    .eq('applicant_id', applicantId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single();

  if (!submission) {
    return Response.json({ error: 'No submission found for this applicant.' }, { status: 404 });
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
