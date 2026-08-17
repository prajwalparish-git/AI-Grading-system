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

This creates canonical tables and the new admissions system tables (`roster`, `verification_codes`, `applications`, `projects`, `audit_log`), and applies RLS policies. The script includes a mock `roster` seed section at the bottom for testing.

> [!IMPORTANT]
> **Schema Re-application**: If upgrading from a previous version, re-run `db/schema.sql` in the Supabase SQL Editor so live database policies match the latest security updates.

### 4. Admin Role Assignment & Seeding

The system restricts dashboard access to candidates, and control center access to administrators. 
To grant a user admin privileges, set `app_metadata.role = 'admin'` in Supabase. You can create your first admin user manually via the Supabase Auth Dashboard, and then run the following in the SQL Editor:

```sql
UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'your_admin_email@example.com';
```

Once the first admin is set up, they can invite other admins directly from the **Admin Control Center** > **Admins** tab.

### 5. Managing the Roster (CSV Template)

Students can only apply if their USN is pre-approved in the system. As an admin, navigate to `/admin/roster` to manually add students or upload a CSV file.

**CSV Format Requirements:**
The CSV must have the exact headers: `usn, name, email, dob, batch`.
Example:
```csv
usn,name,email,dob,batch
1RV21CS001,Alice Smith,alice@example.com,2003-05-15,2021
```
The upload parser handles inline quotes, validates emails, and enforces USN uniqueness.

### 6. The End-to-End Application Flow

**Student Flow:**
1. **Landing Page (`/`)**: Student enters their USN.
2. **OTP Verification**: If the USN exists in the roster and is active, an OTP is emailed via Resend.
3. **Account Creation**: Upon verifying the OTP, the system creates a Supabase Auth user, upgrades their status to `verified`, and emails a secure, auto-generated password.
4. **Dashboard (`/dashboard`)**: Student logs in with their email and password. They can submit up to 3 GitHub repository URLs, change their password, message the developers, or withdraw their application.
5. **Results (`/results`)**: Once admins publish the results, students can view their selection status and any follow-up questions.

**Admin Flow:**
1. **Roster**: Pre-populate valid USNs.
2. **Applications Overview**: View all incoming applications. Admins can click **"Verify & Grade"** on any submitted application to immediately trigger the LLM grading pipeline.
3. **Publish Results**: Admins construct dynamic questions, decide whether to reveal exact LLM scores, and mark candidates as `selected` or `rejected`. 
4. **Audit Log**: Every significant admin action (roster upload, admin revoke, publishing results) is immutably tracked.

### 7. Running the Application

Install dependencies (including UI libraries like `sonner` and `lucide-react`):

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

### 8. Executing the AI Grading Worker

While you can grade single applications from the Admin Control Center, you can also process all pending submissions at once using the background worker:

```bash
npm run grade
```

---

## Security Specifications

1. **Authentication & Authorization**:
   - `/admin/*` routes require authenticated sessions where `user.app_metadata.role === 'admin'`.
   - Admin lock-out prevention ensures the last active admin cannot be revoked.
   - Client-supplied `user_metadata` is explicitly ignored for access control.
2. **Server/Client Supabase Isolation**:
   - `createAdminClient` uses `SUPABASE_SERVICE_ROLE_KEY` and is restricted to server-side code (Route Handlers, worker script).
   - Client components interact via browser clients bound by RLS.
3. **Repository Ingestion Limits**:
   - Maximum 500 code files per repository.
   - Files larger than 100 KB are skipped.
   - Total concatenated code output is capped at 2 MB.
   - Repositories are validated strictly against `https://github.com/` to prevent SSRF.
4. **Rate Limiting**:
   - OTP Requests fallback to Database sliding window limiting (3 attempts per hour) if Upstash Redis is unconfigured.
