'use client'

import React, { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'
import { fetchLeaderboard } from '@/lib/api/leaderboard'
import {
  DEFAULT_FILTERS,
  SCORE_THRESHOLDS,
  type LeaderboardFilters,
  type LeaderboardEntry,
  type PaginatedResult,
  type SortField,
  type ScoreThreshold,
  type ProgrammingLanguage,
} from '@/lib/api/types'
import {
  Trophy,
  Search,
  Filter,
  ArrowUpDown,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Info,
  Loader2,
  AlertTriangle,
  SlidersHorizontal,
  X,
  Eye,
} from 'lucide-react'

const LANGUAGES: (ProgrammingLanguage | 'All')[] = ['All', 'TypeScript', 'Python', 'Rust', 'Go', 'C++', 'Java']

// ── Skeleton row for loading state ───────────────────────────────────────

function LeaderboardSkeletonRow() {
  return (
    <TableRow className="border-slate-800/80">
      <TableCell><Skeleton className="h-5 w-10" /></TableCell>
      <TableCell>
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-5 w-10 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-3.5 w-10" /></TableCell>
      <TableCell><Skeleton className="h-3.5 w-10" /></TableCell>
      <TableCell><Skeleton className="h-3.5 w-10" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-4 w-14 ml-auto" /></TableCell>
      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-6 w-6 rounded mx-auto" /></TableCell>
    </TableRow>
  )
}

// ── "Grading in Progress" skeleton UI ────────────────────────────────────

function GradingInProgressRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <TableRow className="border-slate-800/80 bg-amber-500/[0.03]">
      <TableCell className="font-mono text-xs text-slate-600">—</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-slate-300 text-xs">{entry.name}</span>
          <span className="text-[10px] font-mono text-slate-500">{entry.id}</span>
        </div>
      </TableCell>
      <TableCell>{getLanguageBadge(entry.language)}</TableCell>
      <TableCell colSpan={4}>
        <div className="flex items-center space-x-2 text-xs font-mono">
          <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />
          <span className="text-amber-400">
            {entry.status === 'grading' ? 'LLM evaluation in progress...' : 'Queued for evaluation'}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-1">
          <Skeleton className="h-3 w-8 bg-amber-500/20" />
          <Skeleton className="h-3 w-4 bg-amber-500/10" />
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="warning" className="text-[10px] font-mono">
          {entry.status === 'grading' ? 'Grading' : 'Queued'}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <span className="text-[10px] text-slate-600 font-mono">N/A</span>
      </TableCell>
    </TableRow>
  )
}

// ── Error state row ──────────────────────────────────────────────────────

function ErrorStateRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <TableRow className="border-slate-800/80 bg-rose-500/[0.03]">
      <TableCell className="font-mono text-xs text-slate-600">—</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-slate-300 text-xs">{entry.name}</span>
          <span className="text-[10px] font-mono text-slate-500">{entry.id}</span>
        </div>
      </TableCell>
      <TableCell>{getLanguageBadge(entry.language)}</TableCell>
      <TableCell colSpan={4}>
        <div className="flex items-center space-x-2 text-xs font-mono">
          <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
          <span className="text-rose-400">Evaluation pipeline error — requires manual review</span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-xs font-mono text-rose-500">ERR</span>
      </TableCell>
      <TableCell>
        <Badge variant="destructive" className="text-[10px] font-mono">Error</Badge>
      </TableCell>
      <TableCell className="text-center">
        <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-400 hover:text-white hover:bg-slate-800">
          <Info className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

// ── Language badge helper ────────────────────────────────────────────────

function getLanguageBadge(lang: string) {
  const map: Record<string, { border: string; text: string; bg: string; short: string }> = {
    TypeScript: { border: 'border-blue-500/40', text: 'text-blue-400', bg: 'bg-blue-500/10', short: 'TS' },
    Python:     { border: 'border-amber-500/40', text: 'text-amber-400', bg: 'bg-amber-500/10', short: 'Py' },
    Rust:       { border: 'border-orange-500/40', text: 'text-orange-400', bg: 'bg-orange-500/10', short: 'Rust' },
    Go:         { border: 'border-cyan-500/40', text: 'text-cyan-400', bg: 'bg-cyan-500/10', short: 'Go' },
    'C++':      { border: 'border-indigo-500/40', text: 'text-indigo-400', bg: 'bg-indigo-500/10', short: 'C++' },
    Java:       { border: 'border-red-500/40', text: 'text-red-400', bg: 'bg-red-500/10', short: 'Java' },
  }
  const cfg = map[lang]
  if (!cfg) return <Badge variant="secondary" className="font-mono text-[10px]">{lang}</Badge>
  return <Badge variant="outline" className={`${cfg.border} ${cfg.text} ${cfg.bg} font-mono text-[10px]`}>{cfg.short}</Badge>
}

// ── Rank badge helper ────────────────────────────────────────────────────

function getRankBadge(rank: number) {
  if (rank === 1) return (
    <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono font-bold text-xs">
      <Trophy className="h-3.5 w-3.5 text-amber-400 fill-amber-400" /><span>#1</span>
    </div>
  )
  if (rank === 2) return (
    <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-300/20 border border-slate-300/50 text-slate-200 font-mono font-bold text-xs">
      <Trophy className="h-3.5 w-3.5 text-slate-300 fill-slate-300" /><span>#2</span>
    </div>
  )
  if (rank === 3) return (
    <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-700/20 border border-amber-700/50 text-amber-500 font-mono font-bold text-xs">
      <Trophy className="h-3.5 w-3.5 text-amber-600 fill-amber-600" /><span>#3</span>
    </div>
  )
  return <span className="font-mono text-xs text-slate-500 pl-2">#{rank}</span>
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════

export function GlobalLeaderboard() {
  const [filters, setFilters] = useState<LeaderboardFilters>({ ...DEFAULT_FILTERS })
  const [isLoading, setIsLoading] = useState(true)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedApplicant, setSelectedApplicant] = useState<LeaderboardEntry | null>(null)
  const [result, setResult] = useState<PaginatedResult<LeaderboardEntry>>({
    data: [],
    totalCount: 0,
    page: 1,
    pageSize: 15,
    totalPages: 1,
  })

  // ── Async Data fetch ──
  React.useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    fetchLeaderboard(filters)
      .then((res) => {
        if (isMounted) {
          setResult(res)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        console.error('[Leaderboard fetch error]:', err)
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [filters])

  // ── Filter updaters (reset page to 1 on filter change) ──
  const updateFilter = useCallback(<K extends keyof LeaderboardFilters>(key: K, value: LeaderboardFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value, page: key === 'page' ? (value as number) : 1 }))
  }, [])

  const handleSort = useCallback((field: SortField) => {
    setFilters(prev => ({
      ...prev,
      sortField: field,
      sortOrder: prev.sortField === field ? (prev.sortOrder === 'asc' ? 'desc' : 'asc') : 'desc',
      page: 1,
    }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS })
    setShowAdvancedFilters(false)
  }, [])

  const hasActiveFilters =
    filters.language !== 'All' ||
    filters.scoreThreshold !== 'all' ||
    filters.onlyFlagged ||
    filters.onlyGrading ||
    filters.search.trim() !== ''

  return (
    <Card className="border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
              Global Applicant Evaluation Leaderboard
            </CardTitle>
            <CardDescription>
              {result.totalCount} candidates across 10 evaluation criteria • Page {result.page}/{result.totalPages}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="purple" className="font-mono text-xs">
              {result.totalCount} Applicants
            </Badge>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] font-mono text-slate-400 hover:text-rose-400"
                onClick={resetFilters}
              >
                <X className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* ── Primary Filter Bar ── */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2">

          {/* Language Tabs */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <span className="text-xs font-mono text-slate-400 mr-2 flex items-center gap-1 shrink-0">
              <Filter className="h-3 w-3" /> Lang:
            </span>
            {LANGUAGES.map(lang => (
              <button
                key={lang}
                onClick={() => updateFilter('language', lang)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors whitespace-nowrap ${
                  filters.language === lang
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800/80'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            {/* Advanced Filters Toggle */}
            <Button
              variant="outline"
              size="sm"
              className={`h-8 text-xs font-mono border-slate-800 ${showAdvancedFilters ? 'bg-blue-600/20 text-blue-400 border-blue-500/40' : 'text-slate-400'}`}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
              Advanced
              {hasActiveFilters && (
                <span className="ml-1.5 h-4 w-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">!</span>
              )}
            </Button>

            {/* Search */}
            <div className="relative w-full lg:w-56">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
              <Input
                placeholder="Search name or ID..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="pl-8 h-8 bg-slate-900/90 border-slate-800 text-xs"
              />
            </div>
          </div>
        </div>

        {/* ── Advanced Filters Panel (Collapsible) ── */}
        {showAdvancedFilters && (
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">

              {/* Score Threshold Tabs */}
              <div className="flex items-center space-x-1 flex-wrap gap-y-1">
                <span className="text-[11px] font-mono text-slate-500 mr-1.5 shrink-0">Score Range:</span>
                {(Object.keys(SCORE_THRESHOLDS) as ScoreThreshold[]).map(threshold => (
                  <button
                    key={threshold}
                    onClick={() => updateFilter('scoreThreshold', threshold)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors whitespace-nowrap ${
                      filters.scoreThreshold === threshold
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {SCORE_THRESHOLDS[threshold].label}
                  </button>
                ))}
              </div>

              {/* Toggle Filters */}
              <div className="flex items-center space-x-3 sm:ml-auto">
                <label className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filters.onlyFlagged}
                    onChange={(e) => updateFilter('onlyFlagged', e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500/30"
                  />
                  <ShieldAlert className="h-3 w-3 text-rose-400" />
                  <span>Flagged Only</span>
                </label>

                <label className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filters.onlyGrading}
                    onChange={(e) => updateFilter('onlyGrading', e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30"
                  />
                  <Loader2 className="h-3 w-3 text-amber-400" />
                  <span>In-Progress Only</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 overflow-hidden">

        {/* ── Data Table ── */}
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>
                <button onClick={() => handleSort('name')} className="flex items-center space-x-1 hover:text-white transition-colors cursor-pointer">
                  <span>Applicant</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-500" />
                </button>
              </TableHead>
              <TableHead>Lang</TableHead>
              <TableHead>
                <button onClick={() => handleSort('completion')} className="flex items-center space-x-1 hover:text-white transition-colors cursor-pointer">
                  <span>Completion</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-500" />
                </button>
              </TableHead>
              <TableHead>Innovation</TableHead>
              <TableHead>Functionality</TableHead>
              <TableHead>
                <button onClick={() => handleSort('integrityHonesty')} className="flex items-center space-x-1 hover:text-white transition-colors cursor-pointer">
                  <span>Integrity</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-500" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button onClick={() => handleSort('totalScore')} className="flex items-center space-x-1 justify-end hover:text-white transition-colors cursor-pointer w-full">
                  <span>Overall</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-500" />
                </button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-14 text-center">View</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {/* Loading skeletons */}
            {isLoading && Array.from({ length: filters.pageSize }).map((_, i) => (
              <LeaderboardSkeletonRow key={`skel-${i}`} />
            ))}

            {/* Empty state */}
            {!isLoading && result.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-3 rounded-full bg-slate-900 border border-slate-800">
                      <Search className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-400">No applicants match filters</p>
                      <p className="text-xs font-mono text-slate-500 mt-1">
                        Try adjusting your search query, language, or score threshold.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs font-mono" onClick={resetFilters}>
                      Reset All Filters
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Data rows */}
            {!isLoading && result.data.map((entry: LeaderboardEntry) => {
              // Grading-in-progress skeleton row
              if (entry.status === 'grading' || entry.status === 'submitted') {
                return <GradingInProgressRow key={entry.id} entry={entry} />
              }

              // Error state row
              if (entry.status === 'error') {
                return <ErrorStateRow key={entry.id} entry={entry} />
              }

              // Normal graded row
              return (
                <TableRow key={entry.id} className="group hover:bg-slate-900/70 border-slate-800/80 transition-colors">
                  <TableCell className="font-mono">{getRankBadge(entry.rank)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-100 group-hover:text-blue-400 transition-colors text-xs">
                        {entry.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                        <span>{entry.id}</span>
                        <span>•</span>
                        <span>{entry.submittedAt}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getLanguageBadge(entry.language)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <span className="text-emerald-400 font-semibold">{entry.criteria.completion}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <span className="text-blue-400">{entry.criteria.innovation}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {entry.criteria.functionality}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.flaggedVulnerabilities > 0 ? (
                      <Badge variant="destructive" className="text-[10px] font-mono bg-rose-500/10 text-rose-400 border-rose-500/30 gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        {entry.criteria.integrityHonesty} · {entry.flaggedVulnerabilities} flag{entry.flaggedVulnerabilities > 1 ? 's' : ''}
                      </Badge>
                    ) : (
                      <Badge variant="success" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {entry.criteria.integrityHonesty} Clean
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className="text-sm font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                      {entry.totalScore.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-slate-500"> /10</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="success" className="text-[10px] font-mono">Graded</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Link href={`/admin/submissions/${entry.id}`}>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {/* ── Pagination ── */}
        {result.totalPages > 1 && (
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            totalCount={result.totalCount}
            pageSize={result.pageSize}
            onPageChange={(p) => updateFilter('page', p)}
          />
        )}
      </CardContent>
    </Card>
  )
}
