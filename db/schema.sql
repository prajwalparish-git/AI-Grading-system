-- AI Grading System — Unified Schema (Model A)
-- Canonical tables: applicants → submissions → evaluations
-- integrity_events linked to auth.users directly

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

-- Applicants: authenticated users can read/insert their own rows; admins read all
create policy "Users can view own applicant"
    on public.applicants for select
    using (user_id = auth.uid());

create policy "Admins can view all applicants"
    on public.applicants for select
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Users can insert own applicant"
    on public.applicants for insert
    with check (user_id = auth.uid());

create policy "Service role can update applicants"
    on public.applicants for update
    using (true);

-- Submissions: inherit access through applicant ownership
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

-- Evaluations: inherit access through submission → applicant ownership
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

create policy "Authenticated can insert evaluations"
    on public.evaluations for insert
    with check (true);

-- Integrity Events: users can insert their own; admins can read all
create policy "Users can insert own integrity events"
    on public.integrity_events for insert
    with check (user_id = auth.uid());

create policy "Admins can view all integrity events"
    on public.integrity_events for select
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
