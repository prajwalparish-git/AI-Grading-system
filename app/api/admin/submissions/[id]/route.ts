import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { fetchSubmissionByIdServer } from '@/lib/api/leaderboard-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Strict Admin verification via app_metadata.role
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Submission ID is required.' }, { status: 400 });
    }

    const submission = await fetchSubmissionByIdServer(id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
    }

    return NextResponse.json(submission);
  } catch (err) {
    console.error('[Admin Submission Detail API Error]:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
