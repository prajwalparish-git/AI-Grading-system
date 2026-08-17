'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Activity, 
  Cpu, 
  Database, 
  Layers, 
  Zap, 
  Server, 
  RefreshCw, 
  HardDrive, 
  Clock, 
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'

type SystemStatus = {
  serverTime: string;
  nodeVersion: string;
  nextVersion: string;
  memoryUsageMb: number;
  totalMemoryMb: number;
  cpuLoadAvg: number[];
  dbPing: boolean;
  groqModel: string;
  queue: {
    pending: number;
    grading: number;
    completed: number;
    error: number;
  };
  lastGradedAt: string | null;
}

export function SystemLoadMonitor() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/system-status')
      if (!res.ok) throw new Error('Failed to fetch status')
      const data = await res.json()
      setStatus(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  if (!status) {
    return (
      <Card className="border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl animate-pulse">
        <CardHeader><CardTitle className="text-slate-400">Loading Telemetry...</CardTitle></CardHeader>
      </Card>
    )
  }

  // Calculate some derived metrics
  const cpuPercent = status.cpuLoadAvg && status.cpuLoadAvg.length > 0 
    ? Math.min(100, Math.round(status.cpuLoadAvg[0] * 10)) // Naive scale for display
    : 0;

  const memPercent = Math.min(100, Math.round((status.memoryUsageMb / (status.totalMemoryMb || 1024)) * 100))
  
  const totalQueue = status.queue.pending + status.queue.grading
  
  return (
    <Card className="border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            System & Infrastructure Telemetry
          </CardTitle>
          <CardDescription>
            Live Next.js server environment, background queue, and database status.
          </CardDescription>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
          <Badge variant="outline" className={`font-mono text-[11px] gap-1 ${
            status.dbPing && !error 
            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
            : 'border-rose-500/30 text-rose-400 bg-rose-500/10'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dbPing && !error ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
            {status.dbPing && !error ? 'SYSTEMS ONLINE' : 'DEGRADED'}
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchStatus}
            disabled={isRefreshing}
            className="h-8 text-xs font-mono border-slate-800 hover:bg-slate-900"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        {/* Metric Progress Bar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* CPU Server Load (Serverless Apprximation) */}
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-blue-400" />
                Container Load
              </span>
              <span className={`font-semibold ${cpuPercent > 80 ? 'text-amber-400' : 'text-blue-400'}`}>
                {status.cpuLoadAvg && status.cpuLoadAvg.length ? status.cpuLoadAvg[0].toFixed(2) : 'N/A'}
              </span>
            </div>
            <Progress 
              value={cpuPercent} 
              variant={cpuPercent > 80 ? 'warning' : 'default'} 
            />
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
              <span>Node.js {status.nodeVersion}</span>
              <span>Next.js v{status.nextVersion}</span>
            </div>
          </div>

          {/* Memory Usage */}
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
                Heap Memory
              </span>
              <span className="font-semibold text-emerald-400">
                {status.memoryUsageMb} MB
              </span>
            </div>
            <Progress 
              value={memPercent} 
              variant="success" 
            />
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
              <span>{memPercent}% of Host OS</span>
              <span>{status.totalMemoryMb} MB Total</span>
            </div>
          </div>

          {/* Database Ping */}
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-purple-400" />
                DB Connection
              </span>
              <span className={`font-semibold ${status.dbPing ? 'text-purple-400' : 'text-rose-400'}`}>
                {status.dbPing ? 'Connected' : 'Failing'}
              </span>
            </div>
            <Progress 
              value={status.dbPing ? 100 : 0} 
              variant={status.dbPing ? 'purple' : 'destructive'} 
            />
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
              <span>Supabase REST</span>
              <span>pgbouncer pooled</span>
            </div>
          </div>

          {/* Evaluation Queue */}
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-amber-400" />
                Grading Queue
              </span>
              <span className="font-semibold text-amber-400">
                {totalQueue} active
              </span>
            </div>
            <Progress 
              value={Math.min(100, totalQueue * 10)} 
              variant="warning" 
            />
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
              <span>{status.queue.grading} in-flight</span>
              <span>{status.queue.pending} pending</span>
            </div>
          </div>

        </div>

        {/* System Performance Status Strip */}
        <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800/60 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Server className="h-4 w-4 text-slate-400" />
              <span className="text-slate-400">Groq LLM:</span>
              <span className="text-slate-200 font-semibold">{status.groqModel}</span>
            </div>

            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <span className="text-slate-400">Last Worker Run:</span>
              <span className="text-blue-400 font-semibold">
                {status.lastGradedAt ? new Date(status.lastGradedAt).toLocaleTimeString() : 'Never'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <span className="text-slate-400">Total Graded:</span>
              <span className="text-emerald-400 font-semibold">{status.queue.completed}</span>
            </div>
            
            {status.queue.error > 0 && (
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                <span className="text-slate-400">Errors:</span>
                <span className="text-rose-400 font-semibold">{status.queue.error}</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
             <span className="text-slate-500">Server Time: {new Date(status.serverTime).toLocaleTimeString()}</span>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}

