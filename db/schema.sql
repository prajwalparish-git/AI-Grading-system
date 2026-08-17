-- AI Grading System — Unified Schema (Model A)
-- Canonical tables: applicants → submissions → evaluations
-- integrity_events linked to auth.users directly
--
-- SECURITY & SERVICE ROLE ARCHITECTURE:
-- 1. Row Level Security (RLS) is enabled on all tables.
-- 2. Authenticated users interact via anon/session clients and can ONLY read their own records
--    and create initial applicant/submission/integrity_event records.
-- 3. Administrative operations check user role strictly via auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'.
-- 4. Evaluations and applicant status updates are service-role ONLY. Background workers (e.g. grader script)
--    and server route handlers use the Supabase Service Role Client (createAdminClient), which bypasses RLS safely.

-- Enum for Applicant Status
do $$ begin
    create type public.applicant_status as enum ('pending', 'grading', 'completed', 'error');
exception
    when duplicate_object then null;
end $$;

-- 1. Applicants Table
create table if not exists public.applicants (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    name text not null,
    email text not null,
    github_url text not null,
    language text not null,
    status public.applicant_status default 'pending',
    created_at timestamptz default now()
);

-- 2. Submissions Table
create table if not exists public.submissions (
    id uuid primary key default gen_random_uuid(),
    applicant_id uuid not null references public.applicants(id) on delete cascade,
    repo_url text not null,
    raw_code_text text,
    submitted_at timestamptz default now()
);

-- 3. Evaluations Table (JSONB criteria — single row per submission)
create table if not exists public.evaluations (
    id uuid primary key default gen_random_uuid(),
    submission_id uuid not null references public.submissions(id) on delete cascade,
    overall_score numeric(5,2),
    criteria_scores jsonb not null default '{}',
    ai_summary text,
    vulnerabilities jsonb default '[]',
    evaluated_at timestamptz default now()
);

-- 4. Integrity Events (tab-switching / paste monitoring)
--    Linked to auth.users directly — events fire before an applicant record exists.
create table if not exists public.integrity_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null,
    payload jsonb,
    created_at timestamptz default now()
);

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.applicants enable row level security;
alter table public.submissions enable row level security;
alter table public.evaluations enable row level security;
alter table public.integrity_events enable row level security;

-- Drop existing policies if present for idempotency
drop policy if exists "Users can view own applicant" on public.applicants;
drop policy if exists "Admins can view all applicants" on public.applicants;
drop policy if exists "Users can insert own applicant" on public.applicants;
drop policy if exists "Service role can update applicants" on public.applicants;
drop policy if exists "Users can update own applicant" on public.applicants;

drop policy if exists "Users can view own submissions" on public.submissions;
drop policy if exists "Admins can view all submissions" on public.submissions;
drop policy if exists "Users can insert own submissions" on public.submissions;

drop policy if exists "Users can view own evaluations" on public.evaluations;
drop policy if exists "Admins can view all evaluations" on public.evaluations;
drop policy if exists "Authenticated can insert evaluations" on public.evaluations;
drop policy if exists "Users can insert own evaluations" on public.evaluations;

drop policy if exists "Users can insert own integrity events" on public.integrity_events;
drop policy if exists "Admins can view all integrity events" on public.integrity_events;

-- Applicants RLS
create policy "Users can view own applicant"
    on public.applicants for select
    using (user_id = auth.uid());

create policy "Admins can view all applicants"
    on public.applicants for select
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Users can insert own applicant"
    on public.applicants for insert
    with check (user_id = auth.uid());

-- Note: No UPDATE policy for authenticated users on applicants. Status transitions
-- ('pending' -> 'grading' -> 'completed' / 'error') and field updates are service-role only.

-- Submissions RLS
create policy "Users can view own submissions"
    on public.submissions for select
    using (
        applicant_id in (
            select id from public.applicants where user_id = auth.uid()
        )
    );

create policy "Admins can view all submissions"
    on public.submissions for select
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Users can insert own submissions"
    on public.submissions for insert
    with check (
        applicant_id in (
            select id from public.applicants where user_id = auth.uid()
        )
    );

-- Evaluations RLS
create policy "Users can view own evaluations"
    on public.evaluations for select
    using (
        submission_id in (
            select s.id from public.submissions s
            join public.applicants a on a.id = s.applicant_id
            where a.user_id = auth.uid()
        )
    );

create policy "Admins can view all evaluations"
    on public.evaluations for select
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Note: No INSERT policy for authenticated users on evaluations. Evaluations are written
-- strictly by the background grader service role (createAdminClient).

-- Integrity Events RLS
create policy "Users can insert own integrity events"
    on public.integrity_events for insert
    with check (user_id = auth.uid());

create policy "Admins can view all integrity events"
    on public.integrity_events for select
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 5. Roster Table
create table if not exists public.roster (
    id uuid primary key default gen_random_uuid(),
    usn text unique not null,
    name text not null,
    email text not null,
    dob date,
    batch text,
    is_active boolean default true,
    created_at timestamptz default now()
);

-- 6. Verification Codes Table
create table if not exists public.verification_codes (
    id uuid primary key,
    usn text not null,
    code_hash text not null,
    expires_at timestamptz not null,
    used_at timestamptz,
    attempt_count int default 0,
    created_at timestamptz default now()
);

-- 7. Applications Table
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid references public.roster(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null check (status in ('pending_otp', 'verified', 'submitted', 'withdrawn', 'error')),
  selection_status text not null default 'pending' check (selection_status in ('pending', 'selected', 'rejected')),
  published_questions jsonb not null default '[]',
  scores_published boolean not null default false,
  withdrawn_at timestamptz,
  submitted_at timestamptz,
  edit_deadline timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(roster_id)
);

-- 8. Projects Table
create table if not exists public.projects (
    id uuid primary key,
    application_id uuid references public.applications(id) on delete cascade,
    slot int not null check (slot between 1 and 3),
    repo_url text not null,
    fetch_status text default 'pending', -- pending | ok | failed
    fetch_error text,
    last_checked_at timestamptz,
    unique(application_id, slot)
);

-- 9. Audit Log
create table if not exists public.audit_log (
    id uuid primary key,
    application_id uuid,
    actor_usn text,
    actor_user_id uuid,
    action text not null,
    payload jsonb default '{}',
    created_at timestamptz default now()
);

-- ─── Row Level Security for New Tables ────────────────────────────────────────

alter table public.roster enable row level security;
alter table public.verification_codes enable row level security;
alter table public.applications enable row level security;
alter table public.projects enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "Admins can view roster" on public.roster;
create policy "Admins can view roster"
    on public.roster for select
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
-- (Service role used for other lookups)

drop policy if exists "No client access to verification codes" on public.verification_codes;
create policy "No client access to verification codes"
    on public.verification_codes for all
    using (false);

drop policy if exists "Users can view own applications" on public.applications;
create policy "Users can view own applications"
    on public.applications for select
    using (user_id = auth.uid());

drop policy if exists "Admins can view all applications" on public.applications;
create policy "Admins can view all applications"
    on public.applications for select
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Users can view own projects" on public.projects;
create policy "Users can view own projects"
    on public.projects for select
    using (
        application_id in (
            select id from public.applications where user_id = auth.uid()
        )
    );

drop policy if exists "Admins can view all projects" on public.projects;
create policy "Admins can view all projects"
    on public.projects for select
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can view audit log" on public.audit_log;
create policy "Admins can view audit log"
    on public.audit_log for select
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ─── Seed Data ─────────────────────────────────────────────────────────────

insert into public.roster (usn, name, email, dob, batch)
values 
  ('1RV21CS001', 'Alice Smith', 'alice@example.com', '2003-05-15', '2021'),
  ('1RV21CS002', 'Bob Jones', 'bob@example.com', '2003-08-22', '2021'),
  ('1RV21CS003', 'Charlie Brown', 'charlie@example.com', '2003-11-30', '2021')
on conflict (usn) do nothing;
