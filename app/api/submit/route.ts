import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cloneAndParseRepo } from '@/grader/github';
import { evaluateCodeWithGroq } from '@/grader/groq';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      applicantName,
      name,
      email,
      githubUrl,
      github_url,
      language = 'TypeScript',
    } = body;

    const finalName = applicantName || name;
    const finalGithubUrl = githubUrl || github_url;

    if (!finalName || !email || !finalGithubUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: applicantName, email, and githubUrl are required.' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // 1. Insert applicant into applicants table
    const { data: applicant, error: applicantError } = await supabase
      .from('applicants')
      .insert({
        name: finalName,
        email,
        github_url: finalGithubUrl,
        language,
        status: 'grading',
      })
      .select('id')
      .single();

    if (applicantError || !applicant) {
      console.error('[Submit API Error] Failed to create applicant record:', applicantError);
      return NextResponse.json(
        { error: 'Failed to record applicant submission details.' },
        { status: 500 }
      );
    }

    let rawCodeText = '';
    try {
      // 2. Clone and parse GitHub repository code
      rawCodeText = await cloneAndParseRepo(finalGithubUrl);
    } catch (gitErr: any) {
      console.error('[Submit API Error] Repository scraping failed:', gitErr);
      await supabase.from('applicants').update({ status: 'error' }).eq('id', applicant.id);
      return NextResponse.json(
        { error: `GitHub Ingestion Error: ${gitErr.message}` },
        { status: 400 }
      );
    }

    // 3. Insert submission record into submissions table
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
      await supabase.from('applicants').update({ status: 'error' }).eq('id', applicant.id);
      return NextResponse.json(
        { error: 'Failed to save submission source code.' },
        { status: 500 }
      );
    }

    // 4. Run Groq AI Evaluation
    let evaluationResult;
    try {
      evaluationResult = await evaluateCodeWithGroq(rawCodeText, language);
    } catch (evalErr: any) {
      console.error('[Submit API Error] Groq AI evaluation failed:', evalErr);
      await supabase.from('applicants').update({ status: 'error' }).eq('id', applicant.id);
      return NextResponse.json(
        { error: `AI Grading Error: ${evalErr.message}` },
        { status: 500 }
      );
    }

    // 5. Save evaluation into evaluations table
    const { error: evalSaveError } = await supabase
      .from('evaluations')
      .insert({
        submission_id: submission.id,
        overall_score: evaluationResult.overall_score,
        criteria_scores: evaluationResult.criteria_scores,
        ai_summary: evaluationResult.summary,
        vulnerabilities: evaluationResult.vulnerabilities,
        evaluated_at: new Date().toISOString(),
      });

    if (evalSaveError) {
      console.error('[Submit API Error] Failed to save evaluation scores:', evalSaveError);
      await supabase.from('applicants').update({ status: 'error' }).eq('id', applicant.id);
      return NextResponse.json(
        { error: 'Failed to record AI evaluation metrics.' },
        { status: 500 }
      );
    }

    // 6. Update applicant status to completed
    await supabase
      .from('applicants')
      .update({ status: 'completed' })
      .eq('id', applicant.id);

    return NextResponse.json({
      success: true,
      applicantId: applicant.id,
      evaluation: evaluationResult,
    });
  } catch (err: any) {
    console.error('[Submit API Unexpected Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
