-- =========================================================================
-- FortunIQ OS — Migration: My Focus Today
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v33.
--
-- One row per "focus" an employee has ever had (active or historical) —
-- NOT a new task system. `related_*` columns point back at the real
-- work item, which still lives in tasks/calendar_events/tenders/etc; see
-- src/lib/focus-core.ts and docs/EMPLOYEE_DASHBOARD.md.
--
-- Only one row per employee may have is_active = true at a time — the
-- "only ONE active focus may exist" rule from the brief is enforced in
-- application code (focus-data.ts deactivates any existing active row
-- in the same transaction-like sequence before inserting a new one),
-- mirrored here by a partial unique index as a hard backstop.
-- =========================================================================

create table if not exists employee_focus (
  id uuid primary key default gen_random_uuid(),
  employee_email text not null,
  title text not null,
  module_key text check (module_key is null or module_key in ('tenders', 'finance', 'tasks', 'calendar', 'academy')),
  related_label text,
  related_url text,
  workflow_stage text,
  priority text check (priority is null or priority in ('High', 'Medium', 'Low')),
  due_date date,
  estimated_time text,
  progress_pct integer check (progress_pct is null or (progress_pct >= 0 and progress_pct <= 100)),
  status text not null default 'Not Started'
    check (status in ('Not Started', 'In Progress', 'Waiting', 'Blocked', 'Complete')),
  source text not null default 'Employee' check (source in ('Employee', 'Intelligence', 'Manager')),
  assigned_by text, -- manager's email, only set when source = 'Manager'
  notes text,
  focus_date date not null default current_date,
  is_active boolean not null default true,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists employee_focus_employee_email_idx on employee_focus (employee_email);
create index if not exists employee_focus_active_idx on employee_focus (employee_email, is_active) where is_active = true;
-- Backstop: at most one active focus per employee, even if application
-- logic ever races (e.g. two tabs open at once).
create unique index if not exists employee_focus_one_active_per_employee
  on employee_focus (employee_email) where is_active = true;

alter table employee_focus enable row level security;
create policy "No public access to employee_focus" on employee_focus for all using (false);

comment on table employee_focus is
  'My Focus Today (Project ORION) — the employee''s single current primary objective, plus history. A shortcut onto real work in tasks/calendar_events/tenders, never a second source of truth for it. See docs/EMPLOYEE_DASHBOARD.md.';
