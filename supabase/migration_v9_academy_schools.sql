-- =========================================================================
-- FortunIQ OS — Migration: Academy Schools, Lessons & Assessments
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
-- Restructures Academy into Skillsoft-style Schools, each containing
-- Courses, each containing Lessons (video-ready) and a multiple-choice
-- assessment. See docs/ACADEMY_SCHOOLS.md.
-- =========================================================================

-- ---------- SCHOOLS (faculties) ----------
create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default '🎓',
  description text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- ---------- EXTEND COURSES ----------
alter table courses add column if not exists school_id uuid references schools(id);
alter table courses add column if not exists description text;
alter table courses add column if not exists sort_order int not null default 0;
alter table courses add column if not exists pass_mark_pct int not null default 70;

-- ---------- LESSONS ----------
-- Video-ready: video_url is nullable on purpose. Until real recorded
-- video exists, a lesson displays its written content in a clean,
-- video-player-styled layout. The moment a real video is available
-- (recorded internally, hosted on SharePoint/Stream, or elsewhere),
-- paste its URL into video_url and the player uses it automatically —
-- no other change needed. See docs/ACADEMY_SCHOOLS.md.
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  content text not null,
  video_url text,
  duration_minutes int not null default 5,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- ---------- QUIZ QUESTIONS ----------
create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  question text not null,
  options jsonb not null, -- array of 4 strings
  correct_option_index int not null check (correct_option_index between 0 and 3),
  explanation text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- ---------- PER-EMPLOYEE PROGRESS ----------
create table if not exists employee_course_progress (
  id uuid primary key default gen_random_uuid(),
  employee_email text not null,
  course_id uuid not null references courses(id) on delete cascade,
  status text not null default 'Not Started' check (status in ('Not Started', 'In Progress', 'Completed')),
  completed_lesson_ids jsonb not null default '[]',
  quiz_score_pct int,
  quiz_passed boolean,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz default now(),
  unique (employee_email, course_id)
);

create index if not exists employee_course_progress_email_idx on employee_course_progress (employee_email);

-- ---------- SECURITY ----------
alter table schools enable row level security;
create policy "No public access to schools" on schools for all using (false);

alter table lessons enable row level security;
create policy "No public access to lessons" on lessons for all using (false);

alter table quiz_questions enable row level security;
create policy "No public access to quiz_questions" on quiz_questions for all using (false);

alter table employee_course_progress enable row level security;
create policy "No public access to employee_course_progress" on employee_course_progress for all using (false);

-- ---------- SEED: THE FIVE SCHOOLS ----------
insert into schools (name, icon, description, sort_order) values
('School of Corporate Excellence', '🎓', 'Who FortunIQ Fuels is, and what we expect of every team member.', 1),
('School of Compliance & Governance', '🎓', 'The rules, laws, and ethical standards that protect our people, our customers, and our licence to operate.', 2),
('School of Petroleum Operations', '🎓', 'The fuels we supply, how they move, and how to handle them safely.', 3),
('School of Business Excellence', '🎓', 'How we win and keep customers, and run the business well.', 4),
('School of Leadership', '🎓', 'Skills for anyone leading people, projects, or themselves.', 5);
