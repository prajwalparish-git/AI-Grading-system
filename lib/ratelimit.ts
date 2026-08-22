import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createAdminClient } from '@/lib/supabase/server'

let redis: Redis | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

export function createRatelimit(prefix: string, maxRequests: number, windowString: string, windowMinutes: number) {
  if (redis) {
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, windowString as any),
      prefix,
    })
  }

  // Fallback to DB
  return {
    limit: async (identifier: string) => {
      try {
        const supabaseAdmin = createAdminClient()
        // Log this attempt
        await supabaseAdmin.from('audit_log').insert({
          action: `ratelimit_${prefix}`,
          actor_usn: identifier, // Use actor_usn as the identifier column (stores IP or user ID)
        })

        // Count attempts in the window
        const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
        const { count } = await supabaseAdmin
          .from('audit_log')
          .select('*', { count: 'exact', head: true })
          .eq('action', `ratelimit_${prefix}`)
          .eq('actor_usn', identifier)
          .gte('created_at', windowStart)

        return { success: (count || 0) <= maxRequests }
      } catch (err) {
        console.warn('DB Ratelimit fallback error:', err)
        return { success: true } // fail open
      }
    }
  }
}

// 5 login attempts per 15 minutes per IP
export const loginRatelimit = createRatelimit('login', 5, '15 m', 15)

// 3 submissions per hour per user (submit is once-ever, but guard the API)
export const submitRatelimit = createRatelimit('submit', 3, '1 h', 60)

// 60 integrity events per minute per user (fire-and-forget logging)
export const integrityRatelimit = createRatelimit('integrity', 60, '1 m', 1)

export function getIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'
}
