// ──────────────────────────────────────────────────────────────────────────
// Data Access Layer — Leaderboard & Submission queries.
//
// This module is the ONLY place the UI touches data. To swap from mock
// data to real Supabase/REST calls, replace the function bodies below
// while keeping the signatures identical.
//
// Architecture:
//   UI Component → lib/api/leaderboard.ts → (mock-generator | supabase)
// ──────────────────────────────────────────────────────────────────────────

import type {
  LeaderboardEntry,
  LeaderboardFilters,
  PaginatedResult,
  SubmissionDetail,
  ScoreThreshold,
} from './types'
import { SCORE_THRESHOLDS } from './types'
import { generateLeaderboardEntries, generateSubmissionDetail } from './mock-generator'

/**
 * Fetch a filtered, sorted, paginated leaderboard.
 *
 * In production, replace the body with a Supabase RPC or REST call:
 *   const { data, count } = await supabase.rpc('get_leaderboard', filters)
 */
export function fetchLeaderboard(filters: LeaderboardFilters): PaginatedResult<LeaderboardEntry> {
  let entries = generateLeaderboardEntries()

  // ── Language filter ──
  if (filters.language !== 'All') {
    entries = entries.filter(e => e.language === filters.language)
  }

  // ── Score threshold filter ──
  if (filters.scoreThreshold !== 'all') {
    const range = SCORE_THRESHOLDS[filters.scoreThreshold]
    entries = entries.filter(e => e.totalScore >= range.min && e.totalScore <= range.max)
  }

  // ── Flagged vulnerabilities filter ──
  if (filters.onlyFlagged) {
    entries = entries.filter(e => e.flaggedVulnerabilities > 0)
  }

  // ── Grading-in-progress filter ──
  if (filters.onlyGrading) {
    entries = entries.filter(e => e.status === 'grading' || e.status === 'submitted')
  }

  // ── Search filter ──
  if (filters.search.trim()) {
    const q = filters.search.toLowerCase()
    entries = entries.filter(
      e =>
        e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
    )
  }

  // ── Sorting ──
  entries = [...entries].sort((a, b) => {
    let va: number | string = 0
    let vb: number | string = 0

    switch (filters.sortField) {
      case 'totalScore':
        va = a.totalScore; vb = b.totalScore; break
      case 'name':
        va = a.name; vb = b.name; break
      case 'aiIntegrity':
        va = a.criteria.aiIntegrity; vb = b.criteria.aiIntegrity; break
      case 'correctness':
        va = a.criteria.correctness; vb = b.criteria.correctness; break
      case 'flaggedVulnerabilities':
        va = a.flaggedVulnerabilities; vb = b.flaggedVulnerabilities; break
      default:
        va = a.totalScore; vb = b.totalScore
    }

    if (va < vb) return filters.sortOrder === 'asc' ? -1 : 1
    if (va > vb) return filters.sortOrder === 'asc' ? 1 : -1
    return 0
  })

  // Re-rank after filtering/sorting
  entries.forEach((e, i) => { e.rank = i + 1 })

  // ── Pagination ──
  const totalCount = entries.length
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize))
  const page = Math.min(filters.page, totalPages)
  const start = (page - 1) * filters.pageSize
  const data = entries.slice(start, start + filters.pageSize)

  return { data, totalCount, page, pageSize: filters.pageSize, totalPages }
}

/**
 * Fetch a single submission detail by ID.
 *
 * In production, replace with:
 *   const { data } = await supabase.from('submissions').select('*').eq('id', id).single()
 */
export function fetchSubmissionById(id: string): SubmissionDetail | null {
  const entries = generateLeaderboardEntries()
  const entry = entries.find(e => e.id === id)
  if (!entry) return null
  return generateSubmissionDetail(entry)
}

/**
 * Get aggregate statistics for the dashboard header cards.
 *
 * In production, replace with a Supabase RPC or count queries.
 */
export function fetchDashboardStats() {
  const entries = generateLeaderboardEntries()
  const graded = entries.filter(e => e.status === 'graded')
  const flagged = entries.filter(e => e.flaggedVulnerabilities > 0)
  const grading = entries.filter(e => e.status === 'grading' || e.status === 'submitted')
  const avgScore = graded.length > 0
    ? (graded.reduce((sum, e) => sum + e.totalScore, 0) / graded.length).toFixed(1)
    : '0.0'
  const topScore = graded.length > 0
    ? Math.max(...graded.map(e => e.totalScore)).toFixed(1)
    : '0.0'

  return {
    totalCandidates: entries.length,
    totalGraded: graded.length,
    totalInQueue: grading.length,
    totalFlagged: flagged.length,
    avgScore,
    topScore,
  }
}
