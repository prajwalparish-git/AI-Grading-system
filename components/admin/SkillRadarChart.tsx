'use client'

import React from 'react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CriterionScore } from '@/lib/mock-submissions'
import { Crosshair } from 'lucide-react'

interface SkillRadarChartProps {
  criteria: CriterionScore[]
  applicantName: string
  totalScore: number
}

// Custom Tooltip for radar chart
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono shadow-2xl">
        <p className="text-slate-300 font-semibold">{d.label}</p>
        <p className="text-blue-400 mt-0.5">
          Score: <strong className="text-white">{d.score}</strong>
          <span className="text-slate-500"> / {d.maxScore}</span>
        </p>
        <p className="text-slate-500 text-[10px]">Weight: {d.weight}%</p>
      </div>
    )
  }
  return null
}

export function SkillRadarChart({ criteria, applicantName, totalScore }: SkillRadarChartProps) {
  const chartData = criteria.map(c => ({
    label: c.label,
    score: c.score,
    maxScore: c.maxScore,
    weight: c.weight,
  }))

  const getScoreColor = (score: number) => {
    if (score >= 9.5) return 'text-emerald-400'
    if (score >= 8.5) return 'text-blue-400'
    if (score >= 7.0) return 'text-amber-400'
    return 'text-rose-400'
  }

  const getScoreGrade = (score: number) => {
    if (score >= 9.7) return 'S+'
    if (score >= 9.3) return 'S'
    if (score >= 8.8) return 'A+'
    if (score >= 8.2) return 'A'
    if (score >= 7.5) return 'B+'
    return 'B'
  }

  return (
    <Card className="border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-blue-400" />
            13-Skill Evaluation Radar
          </CardTitle>
          <div className="flex items-center space-x-2">
            <span className={`font-mono text-2xl font-black ${getScoreColor(totalScore)}`}>
              {totalScore.toFixed(1)}
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-mono leading-tight">/ 10</span>
              <Badge variant="success" className="text-[10px] font-mono px-1.5 py-0">
                {getScoreGrade(totalScore)} Grade
              </Badge>
            </div>
          </div>
        </div>
        <CardDescription>
          Multidimensional skill profile for <strong className="text-slate-300">{applicantName}</strong>
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {/* Radar Chart */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              data={chartData}
              margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
            >
              <PolarGrid
                stroke="rgba(255,255,255,0.08)"
                gridType="polygon"
              />
              <PolarAngleAxis
                dataKey="label"
                tick={{
                  fill: '#94a3b8',
                  fontSize: 10,
                  fontFamily: 'var(--font-geist-mono), monospace',
                }}
                tickLine={false}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 10]}
                tick={{ fill: '#475569', fontSize: 9 }}
                tickCount={5}
                axisLine={false}
              />
              <Radar
                name={applicantName}
                dataKey="score"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.18}
                strokeWidth={2}
                dot={{
                  r: 3,
                  fill: '#60a5fa',
                  stroke: '#1d4ed8',
                  strokeWidth: 1.5,
                }}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Mini Score Legend Grid */}
        <div className="grid grid-cols-4 md:grid-cols-5 gap-1 mt-3">
          {criteria.map(c => (
            <div key={c.key} className="text-center p-1.5 rounded bg-slate-900/60 border border-slate-800/60">
              <div className={`font-mono font-bold text-xs ${getScoreColor(c.score)}`}>
                {c.score}
              </div>
              <div className="text-[9px] text-slate-500 truncate font-mono leading-tight mt-0.5">
                {c.label}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
