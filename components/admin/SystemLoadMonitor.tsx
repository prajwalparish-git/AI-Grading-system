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
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'

export function SystemLoadMonitor() {
  const [isSimulating, setIsSimulating] = useState(false)
  const [loadMetrics, setLoadMetrics] = useState({
    cpu: 42,
    memory: 64,
    gpuVram: 78,
    queueDepth: 14,
    queueCapacity: 50,
    activeWorkers: 8,
    maxWorkers: 10,
    requestsPerMin: 124,
    avgLatencyMs: 142,
  })

  // Simulated live pulse effect
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadMetrics(prev => {
        const jitter = (Math.random() * 6 - 3)
        const newCpu = Math.min(98, Math.max(20, Math.round(prev.cpu + jitter)))
        const newVram = Math.min(95, Math.max(50, Math.round(prev.gpuVram + (Math.random() * 4 - 2))))
        const newQueue = Math.min(50, Math.max(2, Math.round(prev.queueDepth + (Math.random() * 4 - 2))))
        return {
          ...prev,
          cpu: newCpu,
          gpuVram: newVram,
          queueDepth: newQueue,
          avgLatencyMs: Math.round(135 + newCpu * 0.4),
        }
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const triggerSpike = () => {
    setIsSimulating(true)
    setLoadMetrics(prev => ({
      ...prev,
      cpu: 89,
      gpuVram: 94,
      queueDepth: 42,
      activeWorkers: 10,
      avgLatencyMs: 380,
    }))
    setTimeout(() => {
      setIsSimulating(false)
    }, 4000)
  }

  const queuePercentage = Math.round((loadMetrics.queueDepth / loadMetrics.queueCapacity) * 100)

  return (
    <Card className="border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400 animate-pulse" />
            System Load & Inference Queue Monitor
          </CardTitle>
          <CardDescription>
            Real-time server infrastructure, LLM worker cluster telemetry, and evaluation queue.
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="font-mono text-[11px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            ALL SYSTEMS NOMINAL
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={triggerSpike}
            disabled={isSimulating}
            className="h-8 text-xs font-mono border-slate-800 hover:bg-slate-900"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSimulating ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            {isSimulating ? 'Spike Active...' : 'Simulate Spike'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        {/* Metric Progress Bar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* CPU Server Load */}
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-blue-400" />
                Server CPU Load
              </span>
              <span className={`font-semibold ${loadMetrics.cpu > 80 ? 'text-amber-400' : 'text-blue-400'}`}>
                {loadMetrics.cpu}%
              </span>
            </div>
            <Progress 
              value={loadMetrics.cpu} 
              variant={loadMetrics.cpu > 80 ? 'warning' : 'default'} 
            />
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
              <span>8 Core Cluster</span>
              <span>Target: &lt;75%</span>
            </div>
          </div>

          {/* GPU VRAM Load */}
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-purple-400" />
                LLM GPU VRAM
              </span>
              <span className={`font-semibold ${loadMetrics.gpuVram > 85 ? 'text-rose-400' : 'text-purple-400'}`}>
                {loadMetrics.gpuVram}%
              </span>
            </div>
            <Progress 
              value={loadMetrics.gpuVram} 
              variant={loadMetrics.gpuVram > 85 ? 'destructive' : 'purple'} 
            />
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
              <span>NVIDIA A10G (24GB)</span>
              <span>Active Batch: 16</span>
            </div>
          </div>

          {/* System Memory (RAM) */}
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
                RAM Memory Usage
              </span>
              <span className="font-semibold text-emerald-400">
                {loadMetrics.memory}%
              </span>
            </div>
            <Progress 
              value={loadMetrics.memory} 
              variant="success" 
            />
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
              <span>20.4 / 32 GB</span>
              <span>Cache: 4.2 GB</span>
            </div>
          </div>

          {/* Evaluation Queue Capacity */}
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-amber-400" />
                API Queue Depth
              </span>
              <span className={`font-semibold ${queuePercentage > 70 ? 'text-rose-400' : 'text-amber-400'}`}>
                {loadMetrics.queueDepth} / {loadMetrics.queueCapacity}
              </span>
            </div>
            <Progress 
              value={queuePercentage} 
              variant={queuePercentage > 70 ? 'destructive' : 'warning'} 
            />
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
              <span>Backpressure: Low</span>
              <span>{queuePercentage}% Filled</span>
            </div>
          </div>

        </div>

        {/* System Performance Status Strip */}
        <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800/60 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Server className="h-4 w-4 text-slate-400" />
              <span className="text-slate-400">Grader Nodes:</span>
              <span className="text-slate-200 font-semibold">{loadMetrics.activeWorkers}/{loadMetrics.maxWorkers} Active</span>
            </div>

            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <span className="text-slate-400">Avg Eval Latency:</span>
              <span className="text-blue-400 font-semibold">{loadMetrics.avgLatencyMs} ms</span>
            </div>

            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <span className="text-slate-400">Throughput:</span>
              <span className="text-emerald-400 font-semibold">{loadMetrics.requestsPerMin} submissions/min</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-slate-400">Worker Auto-Scaling:</span>
            <Badge variant="secondary" className="text-[10px] font-mono py-0">Enabled</Badge>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
