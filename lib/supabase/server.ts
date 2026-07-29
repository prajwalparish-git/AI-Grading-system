import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSSRServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '../database.types';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Standard Server Client (ANON key) — for auth-aware requests
//    Uses the ANON key so Supabase RLS policies are enforced.
//    Suitable for: auth.getUser(), any query scoped to the authenticated user.
// ─────────────────────────────────────────────────────────────────────────────

export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can fail inside Server Components (read-only headers).
            // This is safe to swallow — cookies will still be refreshed in
            // middleware or Route Handlers.
          }
        },
      },
    }
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// 2. Admin Client (SERVICE ROLE key) — BYPASSES RLS
//    Use ONLY for forceful backend inserts where no user session exists
//    (e.g., the /api/submit route, the offline grader script).
//    NEVER import this on the client side.
// ─────────────────────────────────────────────────────────────────────────────

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.'
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
