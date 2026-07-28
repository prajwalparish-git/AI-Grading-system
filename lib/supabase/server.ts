import { createClient } from '@supabase/supabase-js';

/**
 * Creates a server-side Supabase client with the Service Role key.
 * This client bypasses Row Level Security (RLS) policies and is intended
 * for backend tasks like AI grading, syncing data, and admin operations.
 * 
 * Note: Never expose the Service Role key to the frontend.
 */
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.'
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export const createServerSupabaseClient = createServerClient;
export const createServiceClient = createServerClient;

