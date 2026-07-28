-- AI Grading System — Supabase schema
-- Run this in the Supabase SQL editor to set up all tables and RLS policies.

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Users (app-level profile linked to Supabase Auth) ───────────────────────
create table if not exists public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text unique not null,
  name       text not null,
  role       text not null check (role in ('student', 'admin')) default 'student',
  cohort     text,
  created_at timestamptz default now()
);

-- ─── Submissions ─────────────────────────────────────────────────────────────
create table if not exists public.submissions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique not null references public.users (id) on delete cascade,
  repo_url     text not null,
  demo_url     text,
  answers      jsonb not null default '{}',
  status       text not null check (status in ('draft', 'submitted', 'graded')) default 'draft',
  submitted_at timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists submissions_status_idx on public.submissions (status);

-- ─── Grades (one row per criterion per submission) ────────────────────────────
create table if not exists public.grades (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  criterion     text not null,
  score         numeric(5,2) not null,
  max           numeric(5,2) not null,
  rationale     text,
  model         text,
  graded_at     timestamptz default now(),
  unique (submission_id, criterion)
);

create index if not exists grades_submission_idx on public.grades (submission_id);

-- ─── Integrity events ─────────────────────────────────────────────────────────
create table if not exists public.integrity_events (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type    text not null check (type in ('paste', 'copy', 'cut', 'blur', 'fast_paste')),
  payload jsonb,
  at      timestamptz default now()
);

create index if not exists integrity_events_user_idx on public.integrity_events (user_id);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists submissions_updated_at on public.submissions;
create trigger submissions_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.users              enable row level security;
alter table public.submissions        enable row level security;
alter table public.grades             enable row level security;
alter table public.integrity_events   enable row level security;

-- Helper: is current user an admin?
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

-- users: everyone reads their own row; admins read all
create policy "users_select_own"   on public.users for select using (id = auth.uid() or public.is_admin());
create policy "users_insert_self"  on public.users for insert with check (id = auth.uid());
create policy "users_update_self"  on public.users for update using (id = auth.uid());

-- submissions: students insert/select their own; admins select all; no student updates after submit
create policy "submissions_student_select" on public.submissions for select using (user_id = auth.uid() or public.is_admin());
create policy "submissions_student_insert" on public.submissions for insert with check (user_id = auth.uid());
create policy "submissions_student_update" on public.submissions for update using (
  user_id = auth.uid() and status = 'draft'
);
create policy "submissions_admin_update"   on public.submissions for update using (public.is_admin());

-- grades: students see only non-hidden criteria for their own submissions; admins see all
create policy "grades_student_select" on public.grades for select using (
  public.is_admin()
  or (
    criterion not in ('Prompt Engineering', 'Token-Context Efficiency', 'API Security', 'Integrity & Honesty')
    and submission_id in (select id from public.submissions where user_id = auth.uid())
  )
);
create policy "grades_admin_insert"  on public.grades for insert with check (public.is_admin());
create policy "grades_admin_update"  on public.grades for update using (public.is_admin());

-- integrity_events: students insert their own; admins select all
create policy "integrity_insert_own"    on public.integrity_events for insert with check (user_id = auth.uid());
create policy "integrity_admin_select"  on public.integrity_events for select using (public.is_admin());

-- ─── Seed: create an admin user helper ────────────────────────────────────────
-- After creating a user via Supabase Auth Dashboard or invite, run:
--   insert into public.users (id, email, name, role, cohort)
--   values ('<auth-uid>', 'admin@college.edu', 'Admin Name', 'admin', '2025');
--
-- For bulk student creation, use the Supabase Admin API or a seed script
-- (see grader/seed.ts) — never store plaintext passwords here.
