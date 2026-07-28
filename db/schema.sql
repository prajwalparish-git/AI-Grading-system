-- AI Grading System — Unified Schema (Model A)
-- Canonical tables: applicants → submissions → evaluations

-- Enum for Applicant Status
do $$ begin
    create type public.applicant_status as enum ('pending', 'grading', 'completed', 'error');
exception
    when duplicate_object then null;
end $$;

-- 1. Applicants Table
create table if not exists public.applicants (
    id uuid primary key default gen_random_uuid(),
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
create table if not exists public.integrity_events (
    id uuid primary key default gen_random_uuid(),
    applicant_id uuid not null references public.applicants(id) on delete cascade,
    type text not null,
    payload jsonb,
    created_at timestamptz default now()
);
