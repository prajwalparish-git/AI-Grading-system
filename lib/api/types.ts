// ──────────────────────────────────────────────────────────────────────────
// Shared types for the AI Grading System data layer.
// These types form the contract between the frontend UI and any data source
// (mock, Supabase, REST API). When swapping to real data, only the
// adapter in lib/api/adapters/ needs to change — these types stay fixed.
// ──────────────────────────────────────────────────────────────────────────

/** Supported programming languages for submissions */
export type ProgrammingLanguage = 'TypeScript' | 'Python' | 'Rust' | 'Go' | 'C++' | 'Java'

/** Submission lifecycle statuses */
export type SubmissionStatus = 'graded' | 'submitted' | 'grading' | 'draft' | 'error'

/** Vulnerability severity tiers */
export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

/** A single scored evaluation criterion */
export interface CriterionScore {
  key: string
  label: string
  score: number
  maxScore: number
  weight: number
}

/** A code vulnerability or style finding */
export interface VulnerabilityItem {
  severity: VulnerabilitySeverity
  category: string
  lineRef?: string
  title: string
  description: string
  suggestion: string
}

/** Compact leaderboard row — used for paginated listing */
export interface LeaderboardEntry {
  id: string
  rank: number
  name: string
  email: string
  language: ProgrammingLanguage
  submittedAt: string
  status: SubmissionStatus
  totalScore: number
  flaggedVulnerabilities: number     // count of critical+high findings
  criteria: {
    correctness: number
    timeComplexity: number
    memoryEfficiency: number
    codeCleanliness: number
    architecture: number
    edgeCases: number
    unitTesting: number
    security: number
    documentation: number
    aiIntegrity: number
  }
}

/** Full drill-down submission detail */
export interface SubmissionDetail {
  id: string
  applicantName: string
  applicantEmail: string
  applicantId: string
  cohort: string
  language: ProgrammingLanguage
  repoUrl: string
  demoUrl: string
  submittedAt: string
  gradedAt: string
  totalScore: number
  status: SubmissionStatus
  aiSummary: string
  criteria: CriterionScore[]
  vulnerabilities: VulnerabilityItem[]
  codeSnippet: string
}

// ──────────────────────────────────
// Query / filter / pagination types
// ──────────────────────────────────

export type SortField = 'rank' | 'totalScore' | 'name' | 'aiIntegrity' | 'correctness' | 'flaggedVulnerabilities'
export type SortOrder = 'asc' | 'desc'

/** Score threshold filter presets */
export type ScoreThreshold = 'all' | 'elite' | 'strong' | 'average' | 'needs-review'

/** Filters applied to leaderboard queries */
export interface LeaderboardFilters {
  search: string
  language: ProgrammingLanguage | 'All'
  scoreThreshold: ScoreThreshold
  onlyFlagged: boolean              // only show entries with flagged vulns
  onlyGrading: boolean              // only show entries still grading
  sortField: SortField
  sortOrder: SortOrder
  page: number
  pageSize: number
}

/** Paginated query result envelope */
export interface PaginatedResult<T> {
  data: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

/** Default filter values — single source of truth */
export const DEFAULT_FILTERS: LeaderboardFilters = {
  search: '',
  language: 'All',
  scoreThreshold: 'all',
  onlyFlagged: false,
  onlyGrading: false,
  sortField: 'totalScore',
  sortOrder: 'desc',
  page: 1,
  pageSize: 15,
}

/** Human labels and score ranges for threshold presets */
export const SCORE_THRESHOLDS: Record<ScoreThreshold, { label: string; min: number; max: number }> = {
  all:            { label: 'All Scores',     min: 0,   max: 100 },
  elite:          { label: 'Elite (≥ 95)',   min: 95,  max: 100 },
  strong:         { label: 'Strong (80–94)', min: 80,  max: 94.99 },
  average:        { label: 'Average (60–79)',min: 60,  max: 79.99 },
  'needs-review': { label: 'Needs Review (<60)', min: 0, max: 59.99 },
}
