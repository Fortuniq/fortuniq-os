-- =========================================================================
-- FortunIQ OS — Migration: Personalised Dashboard & Unified "My Tasks"
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
--
-- This extends the existing `tasks` and `notifications` tables (from
-- schema.sql) rather than creating a parallel task system. `owner` (a free
-- text display name) is kept for backward compatibility with existing
-- rows and the mock-data fallback; `employee_email` is the new real
-- targeting column everything going forward should use, since it's what
-- can actually be matched against the signed-in person's session email.
--
-- See docs/EMPLOYEE_DASHBOARD.md for the full architecture this supports.
-- =========================================================================

alter table tasks
  add column if not exists employee_email text,
  add column if not exists module_key text,
  add column if not exists record_id text,
  add column if not exists record_url text,
  add column if not exists due_date date,
  add column if not exists status text not null default 'To Do'
    check (status in ('To Do', 'In Progress', 'Waiting', 'Completed', 'Overdue')),
  add column if not exists workflow_stage text,
  add column if not exists created_by text,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by text,
  add column if not exists updated_at timestamptz default now();

create index if not exists tasks_employee_email_idx on tasks (employee_email);
create index if not exists tasks_module_key_idx on tasks (module_key);
create index if not exists tasks_due_date_idx on tasks (due_date);

comment on column tasks.employee_email is
  'The FortunIQ OS employee this task belongs to — matched against the signed-in session email. Null/unmatched rows fall back to being treated as unassigned, not shown to everyone.';
comment on column tasks.module_key is
  'Which module this task relates to (tenders, finance, documents, ...) — used to filter My Tasks by the same module permissions enforced everywhere else in the app.';
comment on column tasks.record_id is
  'The id of the underlying module record this task links to (e.g. a tender id), so My Tasks never duplicates data — it always points back to the real record.';

-- Existing `done` boolean is kept and kept in sync with `status` by the
-- application layer (see src/lib/tasks.ts) rather than removed, so
-- nothing that already reads `done` breaks.

alter table notifications
  add column if not exists employee_email text,
  add column if not exists module_key text;

create index if not exists notifications_employee_email_idx on notifications (employee_email);

comment on column notifications.employee_email is
  'Null = company-wide notification (still subject to module_key permission filtering). Set = personal notification for that specific employee only.';
