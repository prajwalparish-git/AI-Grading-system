import React from 'react'
import Link from 'next/link'
import { SystemLoadMonitor } from '@/components/admin/SystemLoadMonitor'
import { SystemStatusPanel } from '@/components/admin/SystemStatusPanel'
import { GlobalLeaderboard } from '@/components/admin/GlobalLeaderboard'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fetchDashboardStatsServer } from '@/lib/api/leaderboard-server'
import { 
  Users, 
  FileCode2, 
  CheckCheck, 
  ShieldAlert, 
  Terminal, 
  ExternalLink,
  Cpu,
  Layers,
  ArrowUpRight,
  Loader2,
} from 'lucide-react'

export const metadata = {
  title: 'Admin Dashboard // AI Grading System',
  description: 'System Load Telemetry and Global Leaderboard across 13 evaluation criteria.',
}

export default async function AdminDashboardPage() {
  const dashStats = await fetchDashboardStatsServer()

  const stats = [
    { 
      label: 'Registered Candidates', 
      value: String(dashStats.totalCandidates), 
      change: `${dashStats.totalInQueue} in queue`,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20'
    },
    { 
      label: 'Evaluations Graded', 
      value: String(dashStats.totalGraded), 
      change: '100% automated',
      icon: FileCode2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20'
    },
    { 
      label: 'Average Score', 
      value: `${dashStats.avgScore}%`, 
      change: `Top tier ${dashStats.topScore}%`,
      icon: CheckCheck,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20'
    },
    { 
      label: 'Integrity Audit Flags', 
      value: String(dashStats.totalFlagged), 
      change: 'Critical + High vulns',
      icon: ShieldAlert,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20'
    },
  ]

  return (
    <div className="space-y-8 pb-12">
      
      {/* Admin Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight font-mono">
              Admin Evaluation Control Center
            </h1>
            <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400 bg-blue-500/10 font-mono">
              Live Telemetry
            </Badge>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time inference queue telemetry, worker load monitoring, and applicant ranking.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/admin/submissions"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-mono bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-600/20 transition-all"
          >
            <span>Submissions Queue</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/admin/integrity"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-mono bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 transition-all"
          >
            <span>Integrity Audit</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-mono text-slate-400">{s.label}</p>
                  <p className="text-2xl font-bold text-white font-mono mt-0.5">{s.value}</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-1">{s.change}</p>
                </div>
                <div className={`p-2.5 rounded-lg border ${s.bg}`}>
                  <Icon className={`h-5 w-5 ${s.color}`} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* System Load Monitor Section */}
      <section>
        <SystemLoadMonitor />
      </section>

      {/* System Status Panel Section */}
      <section>
        <SystemStatusPanel />
      </section>

      {/* Global Leaderboard Section */}
      <section>
        <GlobalLeaderboard />
      </section>

      {/* Grader CLI Runner Card */}
      <Card className="border-amber-500/30 bg-amber-500/5 backdrop-blur-xl">
        <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-amber-300 font-mono flex items-center gap-2">
              <Terminal className="h-4 w-4 text-amber-400" />
              CLI Evaluation Pipeline Instructions
            </h3>
            <p className="text-xs text-slate-400">
              Evaluation jobs run securely in isolated worker processes. Trigger single or batch grading jobs via terminal:
            </p>
          </div>
          <div className="w-full md:w-auto">
            <pre className="bg-slate-950 border border-slate-800 text-amber-400 font-mono text-xs rounded-md px-4 py-2 overflow-x-auto shadow-inner">
              <code>npm run grade</code>
            </pre>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
