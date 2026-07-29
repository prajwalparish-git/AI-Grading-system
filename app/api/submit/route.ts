import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cloneAndParseRepo } from '@/grader/github';
import { evaluateCodeWithGroq } from '@/grader/groq';
import { submitRatelimit } from '@/lib/ratelimit';

// ── Security Constants ──────────────────────────────────────────────────────
const ALLOWED_GITHUB_HOSTNAME = 'github.com';
const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254; // RFC 5321

/**
 * Validates and parses a GitHub URL, ensuring the hostname is strictly github.com.
 * Prevents SSRF by rejecting internal/private hostnames.
 */
function parseAndValidateGithubUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid URL format.');
  }

  if (url.hostname !== ALLOWED_GITHUB_HOSTNAME) {
    throw new Error(`URL hostname must be ${ALLOWED_GITHUB_HOSTNAME}.`);
  }

  if (url.protocol !== 'https:') {
    throw new Error('Only HTTPS GitHub URLs are accepted.');
  }

  // Must have at least /owner/repo in the path
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new Error('URL must point to a specific repository (e.g. https://github.com/owner/repo).');
  }

  return url;
}

export async function POST(request: NextRequest) {
  try {
    // ── 1. Authentication ─────────────────────────────────────────────────
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    // ── 2. Rate limiting (per user ID) ────────────────────────────────────
    const { success: withinLimit } = await submitRatelimit.limit(user.id);

    if (!withinLimit) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      );
    }

    // ── 3. Parse & validate input ─────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const {
      applicantName,
      name,
      email,
      githubUrl,
      github_url,
      language = 'TypeScript',
    } = body as Record<string, string | undefined>;

    const finalName = (applicantName || name || '').trim();
    const finalEmail = (email || '').trim().toLowerCase();
    const rawGithubUrl = (githubUrl || github_url || '').trim();

    // Required field validation
    if (!finalName) {
      return NextResponse.json({ error: 'applicantName is required.' }, { status: 400 });
    }
    if (finalName.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: `applicantName exceeds ${MAX_NAME_LENGTH} characters.` }, { status: 400 });
    }
    if (!finalEmail) {
      return NextResponse.json({ error: 'email is required.' }, { status: 400 });
    }
    if (finalEmail.length > MAX_EMAIL_LENGTH || !finalEmail.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }
    if (!rawGithubUrl) {
      return NextResponse.json({ error: 'githubUrl is required.' }, { status: 400 });
    }

    // Strict hostname validation — prevents SSRF
    let validatedUrl: URL;
    try {
      validatedUrl = parseAndValidateGithubUrl(rawGithubUrl);
    } catch (urlErr) {
      const message = urlErr instanceof Error ? urlErr.message : 'Invalid GitHub URL.';
      return NextResponse.json(
        { error: `GitHub URL validation failed: ${message}` },
        { status: 400 }
      );
    }

    const finalGithubUrl = validatedUrl.toString();

    // ── 4. Database writes (session client — RLS enforced) ────────────────
    // RLS policy allows insert when user_id = auth.uid()

    // 4a. Insert applicant
    const { data: applicant, error: applicantError } = await supabase
      .from('applicants')
      .insert({
        user_id: user.id,
        name: finalName,
        email: finalEmail,
        github_url: finalGithubUrl,
        language: language || 'TypeScript',
        status: 'grading' as const,
      })
      .select('id')
      .single();

    if (applicantError || !applicant) {
      console.error('[Submit API Error] Failed to create applicant record:', applicantError);
      return NextResponse.json(
        { error: 'Failed to record submission.' },
        { status: 500 }
      );
    }

    // 4b. Clone & parse repository
    let rawCodeText = '';
    try {
      rawCodeText = await cloneAndParseRepo(finalGithubUrl);
    } catch (gitErr) {
      console.error('[Submit API Error] Repository scraping failed:', gitErr);
      await supabase.from('applicants').update({ status: 'error' as const }).eq('id', applicant.id);
      return NextResponse.json(
        { error: 'Failed to fetch repository. Please check the URL is public and try again.' },
        { status: 400 }
      );
    }

    // 4c. Insert submission
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .insert({
        applicant_id: applicant.id,
        repo_url: finalGithubUrl,
        raw_code_text: rawCodeText,
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (submissionError || !submission) {
      console.error('[Submit API Error] Failed to store raw submission code:', submissionError);
      await supabase.from('applicants').update({ status: 'error' as const }).eq('id', applicant.id);
      return NextResponse.json(
        { error: 'Failed to save submission.' },
        { status: 500 }
      );
    }

    // 4d. Run Groq AI Evaluation
    let evaluationResult;
    try {
      evaluationResult = await evaluateCodeWithGroq(rawCodeText, language || 'TypeScript');
    } catch (evalErr) {
      console.error('[Submit API Error] Groq AI evaluation failed:', evalErr);
      await supabase.from('applicants').update({ status: 'error' as const }).eq('id', applicant.id);
      return NextResponse.json(
        { error: 'AI evaluation failed. Please try again later.' },
        { status: 500 }
      );
    }

    // 4e. Save evaluation
    const { error: evalSaveError } = await supabase
      .from('evaluations')
      .insert({
        submission_id: submission.id,
        overall_score: evaluationResult.overall_score,
        criteria_scores: evaluationResult.criteria_scores as unknown as import('@/lib/database.types').Json,
        ai_summary: evaluationResult.summary,
        vulnerabilities: evaluationResult.vulnerabilities as unknown as import('@/lib/database.types').Json,
        evaluated_at: new Date().toISOString(),
      });

    if (evalSaveError) {
      console.error('[Submit API Error] Failed to save evaluation scores:', evalSaveError);
      await supabase.from('applicants').update({ status: 'error' as const }).eq('id', applicant.id);
      return NextResponse.json(
        { error: 'Failed to record evaluation.' },
        { status: 500 }
      );
    }

    // 4f. Mark applicant as completed
    await supabase
      .from('applicants')
      .update({ status: 'completed' as const })
      .eq('id', applicant.id);

    return NextResponse.json({
      success: true,
      applicantId: applicant.id,
      evaluation: evaluationResult,
    });
  } catch (err) {
    console.error('[Submit API Unexpected Error]:', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
