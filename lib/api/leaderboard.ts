// ──────────────────────────────────────────────────────────────────────────
// Client-Safe Data Access Layer — Leaderboard & Submissions
// Safe for Client Components ('use client') — zero imports of server modules.
// ──────────────────────────────────────────────────────────────────────────

import type {
  LeaderboardEntry,
  LeaderboardFilters,
  PaginatedResult,
  SubmissionDetail,
} from './types';
import { SCORE_THRESHOLDS } from './types';
import { generateLeaderboardEntries, generateSubmissionDetail } from './mock-generator';

/**
 * Client-safe leaderboard fetch function.
 * Fetches real filtered data from /api/admin/leaderboard endpoint.
 */
export async function fetchLeaderboard(filters: LeaderboardFilters): Promise<PaginatedResult<LeaderboardEntry>> {
  try {
    const params = new URLSearchParams({
      search: filters.search,
      language: filters.language,
      scoreThreshold: filters.scoreThreshold,
      onlyFlagged: String(filters.onlyFlagged),
      onlyGrading: String(filters.onlyGrading),
      sortField: filters.sortField,
      sortOrder: filters.sortOrder,
      page: String(filters.page),
      pageSize: String(filters.pageSize),
    });

    const res = await fetch(`/api/admin/leaderboard?${params.toString()}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[Client Leaderboard Fetch Warning] Falling back to mock generator:', err);
  }
  return generateMockLeaderboardResult(filters);
}

/**
 * Client-safe submission detail fetch function.
 * Fetches real submission data from /api/admin/submissions/[id] endpoint.
 */
export async function fetchSubmissionById(id: string): Promise<SubmissionDetail | null> {
  try {
    const res = await fetch(`/api/admin/submissions/${encodeURIComponent(id)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[Client Submission Detail Fetch Warning]:', err);
  }
  return null;
}

/**
 * Client-safe fallback for dashboard stats.
 */
export async function fetchDashboardStats() {
  return generateMockDashboardStats();
}

function generateMockLeaderboardResult(filters: LeaderboardFilters): PaginatedResult<LeaderboardEntry> {
  let entries = generateLeaderboardEntries();

  if (filters.language !== 'All') {
    entries = entries.filter((e) => e.language === filters.language);
  }

  if (filters.scoreThreshold !== 'all') {
    const range = SCORE_THRESHOLDS[filters.scoreThreshold];
    entries = entries.filter((e) => e.totalScore >= range.min && e.totalScore <= range.max);
  }

  if (filters.onlyFlagged) {
    entries = entries.filter((e) => e.flaggedVulnerabilities > 0);
  }

  if (filters.onlyGrading) {
    entries = entries.filter((e) => e.status === 'grading' || e.status === 'submitted');
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

  entries = [...entries].sort((a, b) => {
    let va: number | string = 0;
    let vb: number | string = 0;

    switch (filters.sortField) {
      case 'totalScore': va = a.totalScore; vb = b.totalScore; break;
      case 'name': va = a.name; vb = b.name; break;
      case 'integrityHonesty': va = a.criteria.integrityHonesty; vb = b.criteria.integrityHonesty; break;
      case 'completion': va = a.criteria.completion; vb = b.criteria.completion; break;
      case 'flaggedVulnerabilities': va = a.flaggedVulnerabilities; vb = b.flaggedVulnerabilities; break;
      default: va = a.totalScore; vb = b.totalScore;
    }

    if (va < vb) return filters.sortOrder === 'asc' ? -1 : 1;
    if (va > vb) return filters.sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  entries.forEach((e, i) => { e.rank = i + 1; });

  const totalCount = entries.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;
  const data = entries.slice(start, start + filters.pageSize);

  return { data, totalCount, page, pageSize: filters.pageSize, totalPages };
}

function generateMockDashboardStats() {
  const entries = generateLeaderboardEntries();
  const graded = entries.filter((e) => e.status === 'graded');
  const flagged = entries.filter((e) => e.flaggedVulnerabilities > 0);
  const grading = entries.filter((e) => e.status === 'grading' || e.status === 'submitted');
  const avgScore = graded.length > 0 ? (graded.reduce((sum, e) => sum + e.totalScore, 0) / graded.length).toFixed(1) : '0.0';
  const topScore = graded.length > 0 ? Math.max(...graded.map((e) => e.totalScore)).toFixed(1) : '0.0';

  return {
    totalCandidates: entries.length,
    totalGraded: graded.length,
    totalInQueue: grading.length,
    totalFlagged: flagged.length,
    avgScore,
    topScore,
  };
}
