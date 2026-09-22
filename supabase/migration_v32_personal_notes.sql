-- =========================================================================
-- FortunIQ OS — Migration: My Notes
-- (Project ORION, "My Workspace" redesign)
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v31.
-- See docs/EMPLOYEE_DASHBOARD.md for the full design.
--
-- "My Notes: private notes widget (notes, meeting minutes, ideas, phone
-- numbers, reminders, action items)." A single free-text `content`
-- column, not a structured schema per note "type" — see the module
-- comment at the top of src/lib/notes-core.ts for why.
-- =========================================================================

create table if not exists personal_notes (
  id uuid primary key default gen_random_uuid(),
  employee_email text not null,
  title text,
  content text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personal_notes_employee_email_idx on personal_notes (employee_email);

alter table personal_notes enable row level security;
create policy "No public access to personal_notes" on personal_notes for all using (false);

comment on table personal_notes is
  'Private, free-text notes an employee keeps for themselves — meeting minutes, ideas, phone numbers, reminders, action items, per the Project ORION brief. Never shown to anyone but the owner: every read/write in notes-data.ts is scoped to employee_email = the signed-in person, and RLS denies direct access entirely (service role only). Not linked to any module record — for that, use the existing task/calendar primitives (createTaskForEmployee/createCalendarEventForEmployee) instead.';
