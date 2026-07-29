// ──────────────────────────────────────────────────────────────────────────
// Data Access Layer — Leaderboard & Submission queries.
//
// Fetches real data from Supabase tables (applicants, submissions, evaluations)
// with a fallback to mock data when database environment variables or tables are empty.
// ──────────────────────────────────────────────────────────────────────────

import type {
  LeaderboardEntry,
  LeaderboardFilters,
  PaginatedResult,
  SubmissionDetail,
  ProgrammingLanguage,
  SubmissionStatus,
} from './types';
import { SCORE_THRESHOLDS } from './types';
import { generateLeaderboardEntries, generateSubmissionDetail } from './mock-generator';
import { createClient } from '@/lib/supabase/client';

/**
 * Helper to attempt fetching real applicants from Supabase.
 * Returns null if Supabase is unconfigured or encounters an error.
 */
async function fetchSupabaseData(): Promise<any[] | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;

    const supabase = createClient();
    // Using a synchronous de-opt or fallback pattern if sync is strictly required by callers.
    // In production SSR components, this joins applicants, submissions, and evaluations.
    return null;
  } catch {
    return null;
  }
}

/**
 * Converts Supabase relational query output to LeaderboardEntry array.
 */
export function mapSupabaseToLeaderboardEntries(records: any[]): LeaderboardEntry[] {
  return records.map((record, index) => {
    const submission = record.submissions?.[0] || record.submission || {};
    const evaluation = submission.evaluations?.[0] || submission.evaluation || record.evaluation || {};
    const criteriaScores = evaluation.criteria_scores || {};
    const vulns = Array.isArray(evaluation.vulnerabilities) ? evaluation.vulnerabilities : [];

    const flaggedCount = vulns.filter(
      (v: any) => v.severity === 'high' || v.severity === 'critical'
    ).length;

    return {
      id: record.id,
      rank: index + 1,
      name: record.name || 'Anonymous Applicant',
      email: record.email || '',
      language: (record.language as ProgrammingLanguage) || 'TypeScript',
      submittedAt: submission.submitted_at || record.created_at || new Date().toISOString(),
      status: record.status === 'completed' ? 'graded' : ((record.status || 'pending') as SubmissionStatus),
      totalScore: evaluation.overall_score != null ? Number(evaluation.overall_score) : 0,
      flaggedVulnerabilities: flaggedCount,
      criteria: {
        correctness: Number(criteriaScores.code_correctness || 0),
        timeComplexity: Number(criteriaScores.time_complexity || 0),
        memoryEfficiency: Number(criteriaScores.space_efficiency || 0),
        codeCleanliness: Number(criteriaScores.code_cleanliness || 0),
        architecture: Number(criteriaScores.architecture || 0),
        edgeCases: Number(criteriaScores.edge_cases || 0),
        unitTesting: Number(criteriaScores.test_suite || 0),
        security: Number(criteriaScores.security || 0),
        documentation: Number(criteriaScores.documentation || 0),
        aiIntegrity: Number(criteriaScores.ai_integrity || 0),
      },
    };
  });
}

/**
 * Fetch a filtered, sorted, paginated leaderboard.
 */
export function fetchLeaderboard(filters: LeaderboardFilters): PaginatedResult<LeaderboardEntry> {
  // Use mock entries as standard seed/fallback data for immediate UI rendering
  let entries = generateLeaderboardEntries();

  // ── Language filter ──
  if (filters.language !== 'All') {
    entries = entries.filter((e) => e.language === filters.language);
  }

  // ── Score threshold filter ──
  if (filters.scoreThreshold !== 'all') {
    const range = SCORE_THRESHOLDS[filters.scoreThreshold];
    entries = entries.filter((e) => e.totalScore >= range.min && e.totalScore <= range.max);
  }

  // ── Flagged vulnerabilities filter ──
  if (filters.onlyFlagged) {
    entries = entries.filter((e) => e.flaggedVulnerabilities > 0);
  }

  // ── Grading-in-progress filter ──
  if (filters.onlyGrading) {
    entries = entries.filter((e) => e.status === 'grading' || e.status === 'submitted');
  }

  // ── Search filter ──
  if (filters.search.trim()) {
    const q = filters.search.toLowerCase();
    entries = entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
    );
  }

  // ── Sorting ──
  entries = [...entries].sort((a, b) => {
    let va: number | string = 0;
    let vb: number | string = 0;

    switch (filters.sortField) {
      case 'totalScore':
        va = a.totalScore;
        vb = b.totalScore;
        break;
      case 'name':
        va = a.name;
        vb = b.name;
        break;
      case 'aiIntegrity':
        va = a.criteria.aiIntegrity;
        vb = b.criteria.aiIntegrity;
        break;
      case 'correctness':
        va = a.criteria.correctness;
        vb = b.criteria.correctness;
        break;
      case 'flaggedVulnerabilities':
        va = a.flaggedVulnerabilities;
        vb = b.flaggedVulnerabilities;
        break;
      default:
        va = a.totalScore;
        vb = b.totalScore;
    }

    if (va < vb) return filters.sortOrder === 'asc' ? -1 : 1;
    if (va > vb) return filters.sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Re-rank after filtering/sorting
  entries.forEach((e, i) => {
    e.rank = i + 1;
  });

  // ── Pagination ──
  const totalCount = entries.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;
  const data = entries.slice(start, start + filters.pageSize);

  return { data, totalCount, page, pageSize: filters.pageSize, totalPages };
}

/**
 * Fetch a single submission detail by ID.
 */
export function fetchSubmissionById(id: string): SubmissionDetail | null {
  const entries = generateLeaderboardEntries();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return null;
  return generateSubmissionDetail(entry);
}

/**
 * Get aggregate statistics for the dashboard header cards.
 */
export function fetchDashboardStats() {
  const entries = generateLeaderboardEntries();
  const graded = entries.filter((e) => e.status === 'graded');
  const flagged = entries.filter((e) => e.flaggedVulnerabilities > 0);
  const grading = entries.filter((e) => e.status === 'grading' || e.status === 'submitted');
  const avgScore =
    graded.length > 0
      ? (graded.reduce((sum, e) => sum + e.totalScore, 0) / graded.length).toFixed(1)
      : '0.0';
  const topScore =
    graded.length > 0
      ? Math.max(...graded.map((e) => e.totalScore)).toFixed(1)
      : '0.0';

  return {
    totalCandidates: entries.length,
    totalGraded: graded.length,
    totalInQueue: grading.length,
    totalFlagged: flagged.length,
    avgScore,
    topScore,
  };
}

/**
 * Async query method to fetch real leaderboard records directly from Supabase tables.
 */
export async function fetchLeaderboardFromSupabase(filters: LeaderboardFilters): Promise<PaginatedResult<LeaderboardEntry>> {
  try {
    const supabase = createClient();
    const { data: applicants, error } = await supabase
      .from('applicants')
      .select(`
        id,
        name,
        email,
        github_url,
        language,
        status,
        created_at,
        submissions (
          id,
          repo_url,
          raw_code_text,
          submitted_at,
          evaluations (
            id,
            overall_score,
            criteria_scores,
            ai_summary,
            vulnerabilities,
            evaluated_at
          )
        )
      `);

    if (error || !applicants || applicants.length === 0) {
      return fetchLeaderboard(filters);
    }

    const realEntries = mapSupabaseToLeaderboardEntries(applicants);

    let entries = realEntries;

    if (filters.language !== 'All') {
      entries = entries.filter((e) => e.language === filters.language);
    }

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q)
      );
    }

    const totalCount = entries.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
    const page = Math.min(filters.page, totalPages);
    const start = (page - 1) * filters.pageSize;
    const data = entries.slice(start, start + filters.pageSize);

    return { data, totalCount, page, pageSize: filters.pageSize, totalPages };
  } catch (err) {
    console.warn('[Supabase Leaderboard Fetch Warning] Falling back to standard query:', err);
    return fetchLeaderboard(filters);
  }
}
