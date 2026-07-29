import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { loginRatelimit, getIp } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  try {
    // 1. IP-based rate limiting
    const ip = getIp(request);
    const { success: withinLimit } = await loginRatelimit.limit(ip);

    if (!withinLimit) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in 15 minutes.' },
        { status: 429 }
      );
    }

    // 2. Parse credentials
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const { email, password } = body as Record<string, string | undefined>;
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // 3. Authenticate with Supabase on the server
    const supabase = await createServerClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const role = authData.user.app_metadata?.role;

    return NextResponse.json({
      success: true,
      role: role ?? 'user',
    });
  } catch (err) {
    console.error('[Login API Error]:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred during login.' },
      { status: 500 }
    );
  }
}
