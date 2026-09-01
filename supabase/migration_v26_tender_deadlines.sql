-- =========================================================================
-- FortunIQ OS — Migration: Automatic Tender Deadline Management
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v25.
-- See docs/TENDER_DEADLINES.md for the full architecture.
-- =========================================================================

-- ---------- MISSED STATUS ----------
alter table tenders drop constraint if exists tenders_status_check;
alter table tenders add constraint tenders_status_check
  check (status in ('Open', 'Awarded', 'Lost', 'Missed'));

alter table tenders
  add column if not exists missed_at timestamptz;

comment on column tenders.missed_at is
  'When this tender was automatically classified Missed. Set once, by applyMissedStatusIfNeeded() (see tender-deadlines.ts) — never by a person directly. See docs/TENDER_DEADLINES.md, "How the automatic transition actually happens" for why this is applied lazily rather than by a live background job.';

-- ---------- WORKFLOW HISTORY FOR THE MISSED TRANSITION ----------
-- Reuses the existing tender_stage_assignment_history table (from
-- migration_v24) as the tender's general workflow history feed — the
-- same table AssignmentHistoryCard.tsx already displays — rather than a
-- new table, so the Missed event shows up in the same place as every
-- other workflow event a person already looks at.
alter table tender_stage_assignment_history drop constraint if exists tender_stage_assignment_history_event_type_check;
alter table tender_stage_assignment_history add constraint tender_stage_assignment_history_event_type_check
  check (event_type in ('Assigned', 'Reassigned', 'Completed', 'Due Date Changed', 'Missed', 'Reopened'));

-- ---------- CONFIGURABLE CLOSING SOON WARNING PERIOD ----------
-- Uses the existing app_settings key-value table (created in
-- migration_v23_tender_planner.sql for the Planner plan/bucket cache,
-- currently otherwise unused) rather than a new dedicated column or
-- table — "Allow the warning period to be configurable in Settings" is
-- exactly the kind of small, single-value, app-wide setting that table
-- exists for. No row is required — getClosingSoonWarningDays() in
-- tender-core.ts falls back to a default of 7 when unset. See
-- docs/TENDER_DEADLINES.md.
