import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { fetchLeaderboardFromSupabase } from '@/lib/api/leaderboard-server';
import type { LeaderboardFilters } from '@/lib/api/types';
import { DEFAULT_FILTERS } from '@/lib/api/types';

export async function GET(request: NextRequest) {
  try {
    // Admin check
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const filters: LeaderboardFilters = {
      search: searchParams.get('search') ?? DEFAULT_FILTERS.search,
      language: (searchParams.get('language') as any) ?? DEFAULT_FILTERS.language,
      scoreThreshold: (searchParams.get('scoreThreshold') as any) ?? DEFAULT_FILTERS.scoreThreshold,
      onlyFlagged: searchParams.get('onlyFlagged') === 'true',
      onlyGrading: searchParams.get('onlyGrading') === 'true',
      sortField: (searchParams.get('sortField') as any) ?? DEFAULT_FILTERS.sortField,
      sortOrder: (searchParams.get('sortOrder') as any) ?? DEFAULT_FILTERS.sortOrder,
      page: parseInt(searchParams.get('page') ?? '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') ?? '15', 10),
    };

    const result = await fetchLeaderboardFromSupabase(filters);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[Admin Leaderboard API Error]:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
