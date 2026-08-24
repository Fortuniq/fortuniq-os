-- =========================================================================
-- FortunIQ OS — Migration: Tender Stage Ownership & Assignment
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v23.
-- See docs/TENDER_ASSIGNMENT.md for the full architecture.
-- =========================================================================

-- ---------- CURRENT STAGE ASSIGNMENT ----------
-- One row per (tender, stage) — the CURRENT owner of that stage. When a
-- stage is reassigned, this row is updated in place (owner_email
-- changes); the full history of who owned it before is preserved
-- separately in tender_stage_assignment_history below, never lost.
create table if not exists tender_stage_assignments (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references tenders(id) on delete cascade,
  stage text not null check (stage in ('Drafting', 'Pricing', 'Assessment & Verification', 'Submission Ready', 'Submitted')),
  owner_email text not null,
  owner_name text,
  assigned_by text not null,
  assigned_at timestamptz not null default now(),
  due_date date,
  status text not null default 'Active' check (status in ('Active', 'Completed', 'Reassigned')),
  priority text not null default 'Medium' check (priority in ('High', 'Medium', 'Low')),
  comments text,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (tender_id, stage)
);

create index if not exists tender_stage_assignments_tender_idx on tender_stage_assignments (tender_id);
create index if not exists tender_stage_assignments_owner_idx on tender_stage_assignments (owner_email);
create index if not exists tender_stage_assignments_status_idx on tender_stage_assignments (status);

alter table tender_stage_assignments enable row level security;
create policy "No public access to tender_stage_assignments" on tender_stage_assignments for all using (false);

comment on table tender_stage_assignments is
  'One row per (tender, stage) — the current owner. "Overdue" is NOT a stored status here — it is computed at read time from due_date vs today (see isStageOverdue() in tender-core.ts), the same pattern already used for document/attendance expiry elsewhere in this app, so there is no dependency on a background job to keep it accurate.';

-- ---------- ASSIGNMENT / REASSIGNMENT HISTORY (permanent, never edited) ----------
create table if not exists tender_stage_assignment_history (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references tenders(id) on delete cascade,
  stage text not null,
  event_type text not null check (event_type in ('Assigned', 'Reassigned', 'Completed', 'Due Date Changed')),
  previous_owner_email text,
  new_owner_email text,
  previous_due_date date,
  new_due_date date,
  reason text,
  comments text,
  actor_email text not null,
  actor_name text,
  created_at timestamptz not null default now()
);

create index if not exists tender_stage_assignment_history_tender_idx on tender_stage_assignment_history (tender_id);

alter table tender_stage_assignment_history enable row level security;
create policy "No public access to tender_stage_assignment_history" on tender_stage_assignment_history for all using (false);

comment on table tender_stage_assignment_history is
  'Permanent audit trail for stage ownership — every assignment, reassignment, completion, and due-date change, with who did it and when. Rows are never updated or deleted. See docs/TENDER_ASSIGNMENT.md.';
