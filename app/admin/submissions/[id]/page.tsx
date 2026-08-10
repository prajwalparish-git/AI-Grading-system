import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchSubmissionByIdServer } from '@/lib/api/leaderboard-server'
import { CodeBlock } from '@/components/admin/CodeBlock'
import { SkillRadarChart } from '@/components/admin/SkillRadarChart'
import { AIReportCard } from '@/components/admin/AIReportCard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Calendar,
  Clock,
  User,
  Hash,
  CheckCircle2,
  Copy,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const submission = await fetchSubmissionByIdServer(id)
  if (!submission) {
    return { title: 'Submission Not Found // AI Grading System' }
  }
  return {
    title: `${submission.applicantName} — Drill-Down // AI Grading System`,
    description: `Detailed evaluation report for ${submission.applicantName}, applicant ${submission.applicantId}.`,
  }
}

// ── Grading-in-progress skeleton layout ──────────────────────────────────
function GradingInProgressUI({ id }: { id: string }) {
  return (
    <div className="space-y-6 py-12">
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Loader2 className="h-7 w-7 text-amber-400 animate-spin" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-white font-mono">Evaluation In Progress</h2>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Submission <span className="text-amber-400">{id}</span> is currently being evaluated by the LLM grading pipeline.
          </p>
        </div>
        <Badge variant="warning" className="text-xs font-mono">
          Estimated completion: 2–5 minutes
        </Badge>
      </div>

      {/* Skeleton preview */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 space-y-3">
            {Array.from({ length: 15 }).map((_, i) => (
              <Skeleton key={i} className="h-3.5 w-full" style={{ width: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Card className="border-slate-800 bg-slate-950/80">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-5 w-40" />
              <div className="h-64 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Loader2 className="h-8 w-8 text-slate-700 animate-spin mx-auto" />
                  <p className="text-xs font-mono text-slate-600">Building radar profile...</p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-950/80">
            <CardContent className="p-6 space-y-3">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── Error state UI ───────────────────────────────────────────────────────
function ErrorStateUI({ id }: { id: string }) {
  return (
    <div className="space-y-6 py-12">
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-rose-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white font-mono">Evaluation Pipeline Error</h2>
          <p className="text-xs font-mono text-slate-400 mt-1 max-w-md">
            Submission <span className="text-rose-400">{id}</span> encountered an error during LLM inference. 
            This may be due to a timeout, malformed input, or infrastructure issue.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant="destructive" className="text-xs font-mono">Pipeline Error</Badge>
          <Link
            href="/admin/submissions"
            className="text-xs font-mono text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Return to Submissions Queue
          </Link>
        </div>
      </div>

      {/* Partial data skeleton */}
      <Card className="border-rose-500/20 bg-rose-500/5">
        <CardContent className="p-5">
          <p className="text-xs text-slate-400 font-mono">
            <strong className="text-rose-400">Error details:</strong> The evaluation worker timed out after 120s while processing 
            the code analysis step. No partial scores were persisted. A retry has been automatically 
            queued and will execute within the next grading cycle.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═════════════════════════════════════════════════════════════════════════

export default async function SubmissionDrillDownPage({ params }: PageProps) {
  const { id } = await params

  // Fetch via the data access layer (swap-ready for real API)
  const submission = await fetchSubmissionByIdServer(id)

  // 404 — submission ID not found
  if (!submission) {
    notFound()
  }

  // Grading in progress — show skeleton UI
  if (submission.status === 'grading' || submission.status === 'submitted') {
    return (
      <div className="space-y-0">
        <div className="flex items-center space-x-3 mb-6 pb-5 border-b border-slate-800/80">
          <Link href="/admin/submissions" className="flex items-center space-x-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors group">
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Submissions Queue</span>
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-xs font-mono text-slate-300 font-semibold">{id}</span>
        </div>
        <GradingInProgressUI id={id} />
      </div>
    )
  }

  // Error state
  if (submission.status === 'error') {
    return (
      <div className="space-y-0">
        <div className="flex items-center space-x-3 mb-6 pb-5 border-b border-slate-800/80">
          <Link href="/admin/submissions" className="flex items-center space-x-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors group">
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Submissions Queue</span>
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-xs font-mono text-slate-300 font-semibold">{id}</span>
        </div>
        <ErrorStateUI id={id} />
      </div>
    )
  }

  // ── Normal graded view ──
  const scoreColor =
    submission.totalScore >= 9.5 ? 'text-emerald-400' :
    submission.totalScore >= 8.5 ? 'text-blue-400' :
    submission.totalScore >= 7.0 ? 'text-amber-400' : 'text-rose-400'

  return (
    <div className="space-y-0">
      {/* ── BREADCRUMB HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-5 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <Link
            href="/admin/submissions"
            className="flex items-center space-x-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Submissions Queue</span>
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-xs font-mono text-slate-400">Drill-Down</span>
          <span className="text-slate-700">/</span>
          <span className="text-xs font-mono text-slate-300 font-semibold">{submission.applicantId}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Badge
            variant={submission.status === 'graded' ? 'success' : 'warning'}
            className="font-mono text-[11px] flex items-center gap-1.5"
          >
            <CheckCircle2 className="h-3 w-3" />
            {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
          </Badge>
          <div className={`font-mono font-black text-sm px-3 py-1 rounded-full bg-slate-900 border border-slate-800 ${scoreColor}`}>
            {submission.totalScore.toFixed(1)} / 10
          </div>
        </div>
      </div>

      {/* ── APPLICANT META ROW ── */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20 shrink-0">
          {submission.applicantName.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-white leading-tight">{submission.applicantName}</h1>
          <p className="text-xs font-mono text-slate-400">{submission.applicantEmail}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 ml-auto text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5 text-slate-500" />
            {submission.applicantId}
          </span>
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-slate-500" />
            {submission.cohort}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            {new Date(submission.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            Graded {new Date(submission.gradedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <a
            href={submission.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <GitBranch className="h-3.5 w-3.5" />
            View Repository
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* ── SPLIT-SCREEN LAYOUT ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 min-h-[calc(100vh-320px)]">
        {/* LEFT: Code */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-semibold text-slate-300">Submission Source Code</span>
              <Badge variant="outline" className="text-[10px] font-mono border-slate-700 text-slate-400">
                {submission.language}
              </Badge>
            </div>
            <button className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors">
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </button>
          </div>
          <CodeBlock
            code={submission.codeSnippet}
            language={submission.language}
            className="flex-1 min-h-[600px]"
          />
        </div>

        {/* RIGHT: Radar + Report */}
        <div className="flex flex-col space-y-4">
          <SkillRadarChart
            criteria={submission.criteria}
            applicantName={submission.applicantName}
            totalScore={submission.totalScore}
          />
          <AIReportCard
            applicantName={submission.applicantName}
            aiSummary={submission.aiSummary}
            vulnerabilities={submission.vulnerabilities}
          />
        </div>
      </div>
    </div>
  )
}
