# Security Audit & Hardening Report

## Executive Summary

A comprehensive security audit and hardening effort was executed across the AI Grading System repository. All high and critical vulnerabilities—including high-severity Next.js CVEs, Supabase RLS misconfigurations, request DoS vectors, and role-escalation flaws—have been resolved.

---

## Remediated Vulnerabilities & Enhancements

### 1. Framework CVE Fixes (Next.js Upgrade)
- **Vulnerability**: Known high-severity CVEs in `next@16.2.9` (GHSA-6gpp-xcg3-4w24 middleware bypass, SSRF/DoS class issues).
- **Remediation**: Upgraded `next` to `16.2.11` in `package.json`.

### 2. Supabase Row Level Security (RLS) Hardening
- **Vulnerability**: Insecure `using (true)` on applicant UPDATE and `with check (true)` on evaluation INSERT allowed authenticated users to modify arbitrary applicant records or forge evaluations.
- **Remediation**:
  - Rewrote RLS policies in `db/schema.sql` to use `user_id = auth.uid()` for applicants.
  - Restricted evaluation INSERT to submissions owned by the authenticated user (`submission_id IN (SELECT s.id FROM submissions s JOIN applicants a ON a.id = s.applicant_id WHERE a.user_id = auth.uid())`).
  - Added idempotent `DROP POLICY IF EXISTS` statements.
  - Documented that background worker (`npm run grade`) uses `createAdminClient` (service role) to bypass RLS safely on the server.

### 3. Strict Admin Authorization
- **Vulnerability**: Role checking in `middleware.ts` fell back to `user.user_metadata?.role`, which could be user-controlled in certain authentication flows.
- **Remediation**: Restricted role verification strictly to `user.app_metadata?.role === 'admin'`.

### 4. Server-Side Login Rate Limiting
- **Vulnerability**: Login rate limiting (`loginRatelimit`) was defined but unreferenced, leaving `/login` vulnerable to brute-force credential stuffing.
- **Remediation**: Created `/api/auth/login` Route Handler applying IP-based sliding window rate limits (5 attempts / 15 minutes via Upstash Redis). Updated `app/login/page.tsx` to authenticate through the server handler.

### 5. Decoupled Asynchronous AI Grading
- **Vulnerability**: Heavy repository cloning and Groq LLM inference were executed synchronously inside the POST `/api/submit` handler, exposing the application to HTTP request timeouts and DoS attacks.
- **Remediation**: Refactored `/api/submit` to validate inputs, store applicant records with `status: 'pending'`, and return immediately. Ingestion and AI evaluation are processed asynchronously by `npm run grade`.

### 6. Admin Data Layer Hardening
- **Vulnerability**: Dashboard and leaderboard queries relied on mock generators in production and selected `raw_code_text` unnecessarily.
- **Remediation**: Refactored `lib/api/leaderboard.ts` to perform real server-side queries on Supabase using `createAdminClient`. Excluded `raw_code_text` from list endpoints and limited mock data to an explicit development fallback.

### 7. Security Headers & Dependency Surface Reduction
- **Remediation**: Configured security headers in `next.config.ts` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `HSTS`). Removed unused `resend` dependency from `package.json`.

---

## Round 2 Security Hardening

### 8. Login API Middleware Authorization Whitelist
- **Vulnerability**: `/api/auth/login` was blocked for unauthenticated users because `/api/*` routes mandated session authentication in `middleware.ts`.
- **Remediation**: Whitelisted `/api/auth/login` as a public API path in `middleware.ts` so unauthenticated users can access server login and IP-based rate limiting.

### 9. Service-Role Only Evaluations & Applicant Status Lock (RLS)
- **Vulnerability**: Authenticated users could INSERT evaluation rows (grade forgery) or UPDATE applicant status/repo URLs via RLS.
- **Remediation**: Dropped authenticated INSERT policy on `evaluations` and UPDATE policy on `applicants` in `db/schema.sql`. Evaluation writes and applicant status transitions are service-role only (`createAdminClient`). Switched submit route failure recovery status updates to `createAdminClient()`.

### 10. Admin Mock Data Gating & Submission Detail API Route
- **Vulnerability**: Empty Supabase responses or DB query errors triggered mock data fallbacks in production. Client submission detail relied solely on mock data.
- **Remediation**: Gated server layer mock generators behind `ALLOW_MOCK_ADMIN_DATA === 'true'` or `NODE_ENV === 'development'`. Created authenticated `GET /api/admin/submissions/[id]` Route Handler and updated client data access layer (`lib/api/leaderboard.ts`).

> [!IMPORTANT]
> **Operator Action Required**: Operators MUST re-run `db/schema.sql` in the Supabase SQL Editor to enforce the updated RLS policies in live environments.

---

## Verification & Build Status

- **Type Check**: Verified cleanly with `npx tsc --noEmit`.
- **Production Build**: Verified with `npm run build`.
