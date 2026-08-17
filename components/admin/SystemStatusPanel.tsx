'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Server, Cpu, Database, Activity, RefreshCw, Layers } from 'lucide-react'

type SystemStatus = {
  serverTime: string
  nodeVersion: string
  memoryUsageMb: number
  rssMb: number
  totalMemoryMb: number
  cpuLoadAvg: number[]
  dbPing: boolean
  groqModel: string
  applicationsByStatus: Record<string, number>
  pendingProjects: number
  lastGraderRun: string
}

export function SystemStatusPanel() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/system-status')
      if (!res.ok) throw new Error('Failed to fetch system status')
      const data = await res.json()
      setStatus(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // Auto refresh every 30s
    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <CardHeader className="pb-3 border-b border-slate-800/50 flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold text-slate-100 flex items-center space-x-2">
            <Server className="h-5 w-5 text-blue-400" />
            <span>System Status</span>
          </CardTitle>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors disabled:opacity-50"
          title="Refresh Status"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
        </button>
      </CardHeader>
      <CardContent className="pt-4 text-sm font-mono text-slate-300 space-y-4">
        {error ? (
          <div className="text-red-400 p-3 bg-red-500/10 rounded-md border border-red-500/20">
            {error}
          </div>
        ) : !status ? (
          <div className="flex items-center justify-center p-6 space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin text-slate-500" />
            <span className="text-slate-400">Loading system telemetry...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Server Node Details */}
            <div className="space-y-3 p-4 bg-slate-900/50 rounded-lg border border-slate-800/50">
              <h4 className="flex items-center text-slate-400 font-semibold mb-2">
                <Cpu className="h-4 w-4 mr-2" /> Server Metrics
              </h4>
              <div className="flex justify-between">
                <span className="text-slate-500">Time:</span>
                <span>{new Date(status.serverTime).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Memory (Heap):</span>
                <span>{status.memoryUsageMb} MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Memory (RSS):</span>
                <span>{status.rssMb} MB</span>
              </div>
            </div>

            {/* Application Queue */}
            <div className="space-y-3 p-4 bg-slate-900/50 rounded-lg border border-slate-800/50">
              <h4 className="flex items-center text-slate-400 font-semibold mb-2">
                <Layers className="h-4 w-4 mr-2" /> Queue Status
              </h4>
              <div className="flex justify-between">
                <span className="text-slate-500">Pending Projects:</span>
                <span className={status.pendingProjects > 0 ? "text-yellow-400 font-bold" : "text-emerald-400"}>
                  {status.pendingProjects}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Submitted Apps:</span>
                <span>{status.applicationsByStatus['submitted'] || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Graded Apps:</span>
                <span>{status.applicationsByStatus['graded'] || 0}</span>
              </div>
            </div>

            {/* Grader / Model Context */}
            <div className="space-y-3 p-4 bg-slate-900/50 rounded-lg border border-slate-800/50">
              <h4 className="flex items-center text-slate-400 font-semibold mb-2">
                <Activity className="h-4 w-4 mr-2" /> Inference Worker
              </h4>
              <div className="flex justify-between">
                <span className="text-slate-500">GROQ Model:</span>
                <span className="truncate ml-2 text-indigo-300">{status.groqModel}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Last Run:</span>
                <span className="text-right ml-2 text-xs">
                  {status.lastGraderRun !== 'Never' 
                    ? new Date(status.lastGraderRun).toLocaleString() 
                    : 'Never'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">DB Ping:</span>
                <span className={status.dbPing ? "text-emerald-400" : "text-red-400"}>
                  {status.dbPing ? 'OK' : 'FAIL'}
                </span>
              </div>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  )
}
