# AI Code Auditor & Grading System

An automated, LLM-powered code evaluation platform built with Next.js (App Router), Supabase, Groq (Meta Llama 3), and Upstash Redis. Designed for high-throughput admissions, coding club evaluations, and technical screening.

---

## Key Features

- **Automated Repository Parsing**: Clones and ingests source code from public GitHub repositories with strict safety limits (file count, file size, total output size).
- **Asynchronous AI Grading**: Offloads LLM code auditing (10 evaluation criteria + vulnerability detection) to a background worker queue (`npm run grade`), keeping HTTP request paths responsive and resistant to DoS.
- **Row Level Security (RLS)**: Enforces tight, least-privilege policies in Supabase so applicants can only view and update their own submissions.
- **Role-Based Access Control**: Hardened admin access verified strictly via Supabase JWT `app_metadata.role === 'admin'`.
- **IP & User Rate Limiting**: Upstash Redis sliding-window rate limits protecting authentication (`5 attempts / 15m`), project submission (`3 / 1h`), and telemetry endpoints (`60 / 1m`).
- **Security Headers**: Comprehensive HTTP response headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`).

---

## Architecture Overview

```
                      +-------------------+
                      |   Next.js App     |
                      |   Router (SSR)    |
                      +---------+---------+
                                |
      +-------------------------+-------------------------+
      |                         |                         |
+-----+-----+             +-----+-----+             +-----+-----+
| Public    |             | Protected |             | Admin     |
| Routes    |             | API       |             | Control   |
| /login    |             | /submit   |             | Center    |
| /results  |             | /integrity|             | /admin/*  |
+-----------+             +-----+-----+             +-----------+
                                |
                   +------------+------------+
                   |                         |
         +---------+---------+     +---------+---------+
         |  Supabase DB      |     | Upstash Redis     |
         |  (RLS Enforced)   |     | (Rate Limiting)   |
         +---------+---------+     +-------------------+
                   ^
                   | (Bypasses RLS safely via Service Role)
         +---------+---------+
         | Background AI     | ===> Groq API (Llama 3)
         | Worker Pipeline   | ===> GitHub REST API
         | `npm run grade`   |
         +-------------------+
```

---

## Getting Started

### 1. Prerequisites

- Node.js 20+
- A Supabase project instance
- A Groq API key
- (Optional) An Upstash Redis database instance for rate limiting

### 2. Environment Setup

Copy `.env.example` to `.env.local` and populate the variables:

```bash
cp .env.example .env.local
```

Refer to `.env.example` for detailed comments on each variable (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).

### 3. Database Migration

Run the unified schema script in your Supabase SQL Editor:

```bash
# Execute db/schema.sql in the Supabase Dashboard
```

This creates canonical tables (`applicants`, `submissions`, `evaluations`, `integrity_events`) and applies RLS policies.

> [!IMPORTANT]
> **Schema Re-application**: If upgrading from a previous version, re-run `db/schema.sql` in the Supabase SQL Editor so live database policies match the latest security updates (service-role only evaluations and applicant status locking).

### 4. Admin Role Assignment

To grant a user admin privileges, set `app_metadata.role = 'admin'` in Supabase:

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'admin@yourdomain.com';
```

### 5. Running the Application

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

### 6. Executing the AI Grading Worker

Submissions received via `/api/submit` are placed in `pending` status. Run the background worker to execute repository cloning and Groq AI code audits:

```bash
npm run grade
```

---

## Security Specifications

1. **Authentication & Authorization**:
   - `/admin/*` routes require authenticated sessions where `user.app_metadata.role === 'admin'`.
   - Client-supplied `user_metadata` is explicitly ignored for access control.
2. **Server/Client Supabase Isolation**:
   - `createAdminClient` uses `SUPABASE_SERVICE_ROLE_KEY` and is restricted to server-side code (Route Handlers, worker script).
   - Client components interact via browser clients bound by RLS.
3. **Repository Ingestion Limits**:
   - Maximum 500 code files per repository.
   - Files larger than 100 KB are skipped.
   - Total concatenated code output is capped at 2 MB.
   - Repositories are validated strictly against `https://github.com/` to prevent SSRF.
