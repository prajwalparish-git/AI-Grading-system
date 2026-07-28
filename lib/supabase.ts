// Browser client — safe to import from Client Components
export { createClient } from './supabase/client'

// Server-only clients — only import from Server Components, Route Handlers, middleware
export { createServerSupabaseClient, createServiceClient, createAdminClient } from './supabase/server'
