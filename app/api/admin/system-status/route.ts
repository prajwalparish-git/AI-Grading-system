import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import os from 'os'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const adminClient = createAdminClient()

    // 1. DB Ping
    const { error: pingError } = await adminClient
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    // Applications by status
    const { data: applications, error: appError } = await adminClient
      .from('applications')
      .select('status')

    const applicationsByStatus: Record<string, number> = {}
    if (applications && !appError) {
      applications.forEach(app => {
        applicationsByStatus[app.status] = (applicationsByStatus[app.status] || 0) + 1
      })
    }

    // Number of pending projects
    const { count: pendingProjectsCount } = await adminClient
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('fetch_status', 'pending')

    // Read last grader run
    let lastGraderRun = 'Never'
    try {
      const filePath = path.join(process.cwd(), '.grader-last-run')
      if (fs.existsSync(filePath)) {
        lastGraderRun = fs.readFileSync(filePath, 'utf-8')
      }
    } catch (err) {}

    const mem = process.memoryUsage()
    const memoryMb = Math.round(mem.heapUsed / 1024 / 1024)
    const rssMb = Math.round(mem.rss / 1024 / 1024)
    const totalMemMb = Math.round(os.totalmem() / 1024 / 1024)
    
    return NextResponse.json({
      serverTime: new Date().toISOString(),
      nodeVersion: process.version,
      memoryUsageMb: memoryMb,
      rssMb: rssMb,
      totalMemoryMb: totalMemMb,
      cpuLoadAvg: os.loadavg(),
      dbPing: !pingError,
      groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      applicationsByStatus,
      pendingProjects: pendingProjectsCount || 0,
      lastGraderRun
    })
  } catch (error: any) {
    console.error('System status error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
