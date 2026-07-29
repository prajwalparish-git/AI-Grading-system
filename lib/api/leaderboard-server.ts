// ──────────────────────────────────────────────────────────────────────────
// Server-Only Data Access Layer — Leaderboard & Submissions
// NEVER import this file from Client Components.
// ──────────────────────────────────────────────────────────────────────────

import type {
  LeaderboardEntry,
  LeaderboardFilters,
  PaginatedResult,
  SubmissionDetail,
  ProgrammingLanguage,
  SubmissionStatus,
  CriterionScore,
  VulnerabilityItem,
} from './types';
import { SCORE_THRESHOLDS } from './types';
import { generateLeaderboardEntries, generateSubmissionDetail } from './mock-generator';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Helper to determine if mock data generation is explicitly permitted.
 * Enabled only if ALLOW_MOCK_ADMIN_DATA is 'true' or in development mode.
 */
function isMockAllowed(): boolean {
  return process.env.ALLOW_MOCK_ADMIN_DATA === 'true' || process.env.NODE_ENV === 'development';
}

/**
 * Converts Supabase relational query output to LeaderboardEntry array.
 * Excludes raw_code_text for performance and security.
 */
export function mapSupabaseToLeaderboardEntries(records: any[]): LeaderboardEntry[] {
  return records.map((record, index) => {
    const submission = Array.isArray(record.submissions) ? record.submissions[0] : (record.submissions || {});
    const evaluation = Array.isArray(submission?.evaluations) ? submission.evaluations[0] : (submission?.evaluations || {});
    const criteriaScores = (evaluation?.criteria_scores || {}) as Record<string, any>;
    const vulns = Array.isArray(evaluation?.vulnerabilities) ? evaluation.vulnerabilities : [];

    const flaggedCount = vulns.filter(
      (v: any) => v.severity === 'high' || v.severity === 'critical'
    ).length;

    return {
      id: record.id,
      rank: index + 1,
      name: record.name || 'Anonymous Applicant',
      email: record.email || '',
      language: (record.language as ProgrammingLanguage) || 'TypeScript',
      submittedAt: submission?.submitted_at || record.created_at || new Date().toISOString(),
      status: record.status === 'completed' ? 'graded' : ((record.status || 'pending') as SubmissionStatus),
      totalScore: evaluation?.overall_score != null ? Number(evaluation.overall_score) : 0,
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
 * Server-only leaderboard fetch directly from Supabase tables.
 */
export async function fetchLeaderboardFromSupabase(filters: LeaderboardFilters): Promise<PaginatedResult<LeaderboardEntry>> {
  try {
    const supabase = createAdminClient();

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
      `)
      .order('created_at', { ascending: false });

    if (error || !applicants || applicants.length === 0) {
      if (error) {
        console.warn('[Leaderboard Server Error] DB query returned error:', error.message);
      } else {
        console.warn('[Leaderboard Server Notice] No applicants found in database.');
      }

      if (isMockAllowed()) {
        console.warn('[Leaderboard Server Warning] Falling back to mock generator (ALLOW_MOCK_ADMIN_DATA / dev mode).');
        return generateMockLeaderboardResult(filters);
      }

      return {
        data: [],
        totalCount: 0,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: 0,
      };
    }

    let entries = mapSupabaseToLeaderboardEntries(applicants);

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
        case 'aiIntegrity': va = a.criteria.aiIntegrity; vb = b.criteria.aiIntegrity; break;
        case 'correctness': va = a.criteria.correctness; vb = b.criteria.correctness; break;
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
  } catch (err) {
    console.warn('[Leaderboard Server Exception]:', err);
    if (isMockAllowed()) {
      return generateMockLeaderboardResult(filters);
    }
    return {
      data: [],
      totalCount: 0,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: 0,
    };
  }
}

/**
 * Server-only submission detail fetch by ID.
 */
export async function fetchSubmissionByIdServer(id: string): Promise<SubmissionDetail | null> {
  try {
    const supabase = createAdminClient();

    const { data: applicant, error } = await supabase
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
      `)
      .eq('id', id)
      .maybeSingle();

    if (error || !applicant) {
      if (error) {
        console.warn('[Submission Detail Server Error] Query error:', error.message);
      } else {
        console.warn(`[Submission Detail Server Notice] Applicant ID ${id} not found in DB.`);
      }

      if (isMockAllowed()) {
        console.warn(`[Submission Detail Server Warning] Searching mock entries for ID ${id}.`);
        const mockEntries = generateLeaderboardEntries();
        const mockEntry = mockEntries.find((e) => e.id === id);
        if (mockEntry) return generateSubmissionDetail(mockEntry);
      }
      return null;
    }

    const submission = Array.isArray(applicant.submissions) ? applicant.submissions[0] : applicant.submissions;
    const evaluation = Array.isArray(submission?.evaluations) ? submission.evaluations[0] : submission?.evaluations;
    const criteriaScores = (evaluation?.criteria_scores || {}) as Record<string, any>;
    const vulns = (Array.isArray(evaluation?.vulnerabilities) ? evaluation.vulnerabilities : []) as unknown as VulnerabilityItem[];

    const criteriaList: CriterionScore[] = [
      { key: 'code_correctness', label: 'Code Correctness', score: Number(criteriaScores.code_correctness || 0), maxScore: 10, weight: 1.5 },
      { key: 'time_complexity', label: 'Time Complexity', score: Number(criteriaScores.time_complexity || 0), maxScore: 10, weight: 1.0 },
      { key: 'space_efficiency', label: 'Memory Efficiency', score: Number(criteriaScores.space_efficiency || 0), maxScore: 10, weight: 1.0 },
      { key: 'code_cleanliness', label: 'Code Cleanliness', score: Number(criteriaScores.code_cleanliness || 0), maxScore: 10, weight: 1.0 },
      { key: 'architecture', label: 'Architecture & Design', score: Number(criteriaScores.architecture || 0), maxScore: 10, weight: 1.0 },
      { key: 'edge_cases', label: 'Edge Case Handling', score: Number(criteriaScores.edge_cases || 0), maxScore: 10, weight: 1.0 },
      { key: 'test_suite', label: 'Unit Testing Suite', score: Number(criteriaScores.test_suite || 0), maxScore: 10, weight: 1.0 },
      { key: 'security', label: 'Security & Vulnerability Audit', score: Number(criteriaScores.security || 0), maxScore: 10, weight: 1.5 },
      { key: 'documentation', label: 'Documentation & Readme', score: Number(criteriaScores.documentation || 0), maxScore: 10, weight: 0.5 },
      { key: 'ai_integrity', label: 'AI Code Integrity Check', score: Number(criteriaScores.ai_integrity || 0), maxScore: 10, weight: 1.0 },
    ];

    return {
      id: submission?.id || applicant.id,
      applicantName: applicant.name,
      applicantEmail: applicant.email,
      applicantId: applicant.id,
      cohort: '2026 Admissions',
      language: (applicant.language as ProgrammingLanguage) || 'TypeScript',
      repoUrl: submission?.repo_url || applicant.github_url,
      demoUrl: applicant.github_url,
      submittedAt: submission?.submitted_at || applicant.created_at,
      gradedAt: evaluation?.evaluated_at || applicant.created_at,
      totalScore: evaluation?.overall_score != null ? Number(evaluation.overall_score) : 0,
      status: applicant.status === 'completed' ? 'graded' : (applicant.status as SubmissionStatus),
      aiSummary: evaluation?.ai_summary || 'Evaluation details pending.',
      criteria: criteriaList,
      vulnerabilities: vulns,
      codeSnippet: submission?.raw_code_text || '// Source code snippet not ingested or truncated.',
    };
  } catch (err) {
    console.warn('[Submission Detail Server Exception]:', err);
    if (isMockAllowed()) {
      const mockEntries = generateLeaderboardEntries();
      const mockEntry = mockEntries.find((e) => e.id === id);
      if (mockEntry) return generateSubmissionDetail(mockEntry);
    }
    return null;
  }
}

/**
 * Server-only dashboard stats query.
 */
export async function fetchDashboardStatsServer() {
  try {
    const supabase = createAdminClient();

    const { data: applicants, error: appErr } = await supabase.from('applicants').select('status');
    const { data: evaluations, error: evalErr } = await supabase.from('evaluations').select('overall_score, vulnerabilities');

    if (appErr || evalErr || !applicants || applicants.length === 0 || !evaluations || evaluations.length === 0) {
      if (appErr || evalErr) {
        console.warn('[Dashboard Stats Server Error] DB query error:', appErr?.message || evalErr?.message);
      } else {
        console.warn('[Dashboard Stats Server Notice] No applicants or evaluations found in DB.');
      }

      if (isMockAllowed()) {
        console.warn('[Dashboard Stats Server Warning] Falling back to mock generator.');
        return generateMockDashboardStats();
      }

      return {
        totalCandidates: applicants?.length ?? 0,
        totalGraded: applicants?.filter((a) => a.status === 'completed').length ?? 0,
        totalInQueue: applicants?.filter((a) => a.status === 'pending' || a.status === 'grading').length ?? 0,
        totalFlagged: 0,
        avgScore: '0.0',
        topScore: '0.0',
      };
    }

    const totalCandidates = applicants.length;
    const totalGraded = applicants.filter((a) => a.status === 'completed').length;
    const totalInQueue = applicants.filter((a) => a.status === 'pending' || a.status === 'grading').length;

    let flaggedCount = 0;
    let scoresSum = 0;
    let maxScore = 0;

    evaluations.forEach((ev) => {
      const score = Number(ev.overall_score || 0);
      scoresSum += score;
      if (score > maxScore) maxScore = score;

      const vulns = Array.isArray(ev.vulnerabilities) ? ev.vulnerabilities : [];
      const hasCriticalOrHigh = vulns.some(
        (v: any) => v.severity === 'critical' || v.severity === 'high'
      );
      if (hasCriticalOrHigh) flaggedCount++;
    });

    const avgScore = evaluations.length > 0 ? (scoresSum / evaluations.length).toFixed(1) : '0.0';
    const topScore = evaluations.length > 0 ? maxScore.toFixed(1) : '0.0';

    return {
      totalCandidates,
      totalGraded,
      totalInQueue,
      totalFlagged: flaggedCount,
      avgScore,
      topScore,
    };
  } catch (err) {
    console.warn('[Dashboard Stats Server Exception]:', err);
    if (isMockAllowed()) {
      return generateMockDashboardStats();
    }
    return {
      totalCandidates: 0,
      totalGraded: 0,
      totalInQueue: 0,
      totalFlagged: 0,
      avgScore: '0.0',
      topScore: '0.0',
    };
  }
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
      case 'aiIntegrity': va = a.criteria.aiIntegrity; vb = b.criteria.aiIntegrity; break;
      case 'correctness': va = a.criteria.correctness; vb = b.criteria.correctness; break;
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
