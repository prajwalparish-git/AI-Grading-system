'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { VulnerabilityItem } from '@/lib/mock-submissions'
import {
  Bot,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileCode,
  Lightbulb,
} from 'lucide-react'

interface AIReportCardProps {
  applicantName: string
  aiSummary: string
  vulnerabilities: VulnerabilityItem[]
}

const SEVERITY_CONFIG = {
  critical: {
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/30',
    badgeVariant: 'destructive' as const,
    icon: ShieldAlert,
    label: 'Critical',
    ringColor: 'ring-rose-500/30',
    barColor: 'bg-rose-500',
  },
  high: {
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/30',
    badgeVariant: 'warning' as const,
    icon: AlertTriangle,
    label: 'High',
    ringColor: 'ring-orange-500/30',
    barColor: 'bg-orange-500',
  },
  medium: {
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    badgeVariant: 'warning' as const,
    icon: AlertCircle,
    label: 'Medium',
    ringColor: 'ring-amber-500/30',
    barColor: 'bg-amber-500',
  },
  low: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
    badgeVariant: 'default' as const,
    icon: Info,
    label: 'Low',
    ringColor: 'ring-blue-500/30',
    barColor: 'bg-blue-500',
  },
  info: {
    color: 'text-slate-400',
    bg: 'bg-slate-800/60 border-slate-700/60',
    badgeVariant: 'secondary' as const,
    icon: Info,
    label: 'Info',
    ringColor: 'ring-slate-600/30',
    barColor: 'bg-slate-600',
  },
}

function VulnerabilityCard({ vuln, index }: { vuln: VulnerabilityItem; index: number }) {
  const [expanded, setExpanded] = useState(index === 0) // First one open by default
  const cfg = SEVERITY_CONFIG[vuln.severity]
  const Icon = cfg.icon

  return (
    <div className={`rounded-lg border ${cfg.bg} overflow-hidden transition-all`}>
      {/* Vuln Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between p-3 text-left group hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-start space-x-3">
          {/* Severity Icon */}
          <div className={`mt-0.5 p-1.5 rounded-md ${cfg.bg} ring-1 ${cfg.ringColor} shrink-0`}>
            <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <Badge
                variant={cfg.badgeVariant}
                className="text-[10px] font-mono px-1.5 py-0 h-4"
              >
                {cfg.label}
              </Badge>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800">
                {vuln.category}
              </span>
              {vuln.lineRef && (
                <span className="text-[10px] font-mono text-blue-400 flex items-center gap-1">
                  <FileCode className="h-2.5 w-2.5" />
                  {vuln.lineRef}
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-200 leading-snug">{vuln.title}</p>
          </div>
        </div>
        <span className="ml-2 shrink-0 text-slate-500 group-hover:text-slate-300 transition-colors mt-0.5">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800/60 pt-3">
          {/* Description */}
          <div>
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">Analysis</p>
            <p className="text-xs text-slate-300 leading-relaxed">{vuln.description}</p>
          </div>

          {/* Suggestion */}
          <div className="p-3 rounded-md bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex items-center space-x-1.5 mb-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-[11px] font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                Suggested Fix
              </p>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{vuln.suggestion}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function AIReportCard({ applicantName, aiSummary, vulnerabilities }: AIReportCardProps) {
  // Severity counts
  const counts = vulnerabilities.reduce((acc, v) => {
    acc[v.severity] = (acc[v.severity] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const hasCritical = (counts['critical'] ?? 0) > 0
  const hasHigh = (counts['high'] ?? 0) > 0

  return (
    <div className="space-y-4">
      {/* AI Summary Card */}
      <Card className="border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Bot className="h-4 w-4 text-purple-400" />
            AI Evaluation Summary
          </CardTitle>
          <CardDescription>
            LLM-generated holistic analysis — powered by Groq Llama-3.3 70B
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="relative p-4 rounded-lg bg-gradient-to-br from-purple-500/5 to-blue-500/5 border border-purple-500/20">
            {/* Decorative AI indicator */}
            <div className="absolute top-3 right-3 flex items-center space-x-1.5 text-[10px] font-mono text-purple-400">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span>AI Analysis</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pr-20">{aiSummary}</p>
          </div>
        </CardContent>
      </Card>

      {/* Vulnerability Report Card */}
      <Card className="border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              {hasCritical || hasHigh ? (
                <ShieldAlert className="h-4 w-4 text-rose-400" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              )}
              Code Vulnerability Report
            </CardTitle>
            <Badge
              variant={hasCritical ? 'destructive' : hasHigh ? 'warning' : 'success'}
              className="text-[10px] font-mono"
            >
              {vulnerabilities.length} {vulnerabilities.length === 1 ? 'Issue' : 'Issues'} Detected
            </Badge>
          </div>
          <CardDescription>
            Static analysis, memory safety, type safety, and style heuristics.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {/* Severity Summary Bar */}
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800/60">
            {(['critical', 'high', 'medium', 'low', 'info'] as const).map(sev => {
              const cfg = SEVERITY_CONFIG[sev]
              const n = counts[sev] ?? 0
              return (
                <div key={sev} className="flex items-center space-x-1.5 text-[11px] font-mono">
                  <span className={`h-2 w-2 rounded-full ${cfg.barColor}`} />
                  <span className={`font-semibold ${n > 0 ? cfg.color : 'text-slate-600'}`}>{n}</span>
                  <span className="text-slate-500 hidden sm:inline">{cfg.label}</span>
                </div>
              )
            })}
          </div>

          {/* Vulnerability Cards */}
          <div className="space-y-2">
            {vulnerabilities.length === 0 ? (
              <div className="flex items-center space-x-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-emerald-400">All checks passed</p>
                  <p className="text-[10px] text-slate-400 font-mono">No vulnerabilities or style issues detected.</p>
                </div>
              </div>
            ) : (
              vulnerabilities.map((vuln, i) => (
                <VulnerabilityCard key={i} vuln={vuln} index={i} />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
