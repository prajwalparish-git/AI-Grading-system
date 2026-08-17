import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import os from 'os'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const adminClient = createAdminClient()

    // 1. DB Ping
    const { error: pingError } = await adminClient
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    // Wait, applicant status (pending, grading, completed, error) is in the applicants table. 
    const { data: applicants, error: applicantsError } = await adminClient
      .from('applicants')
      .select('status')

    let pending = 0
    let grading = 0
    let completed = 0
    let errorCount = 0

    if (applicants && !applicantsError) {
      applicants.forEach(app => {
        if (app.status === 'pending') pending++
        if (app.status === 'grading') grading++
        if (app.status === 'completed') completed++
        if (app.status === 'error') errorCount++
      })
    }

    let lastGradedAt: string | null = null
    const { data: evaluations } = await adminClient
      .from('evaluations')
      .select('evaluated_at')
      .order('evaluated_at', { ascending: false })
      .limit(1)
    
    if (evaluations && evaluations.length > 0) {
      lastGradedAt = evaluations[0].evaluated_at
    }

    // Next.js version
    let nextVersion = 'Unknown'
    try {
      nextVersion = require('next/package.json').version
    } catch(e) {}

    const memoryMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    const totalMemMb = Math.round(os.totalmem() / 1024 / 1024)
    
    return NextResponse.json({
      serverTime: new Date().toISOString(),
      nodeVersion: process.version,
      nextVersion,
      memoryUsageMb: memoryMb,
      totalMemoryMb: totalMemMb,
      cpuLoadAvg: os.loadavg(),
      dbPing: !pingError,
      groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      queue: {
        pending,
        grading,
        completed,
        error: errorCount
      },
      lastGradedAt
    })
  } catch (error: any) {
    console.error('System status error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
