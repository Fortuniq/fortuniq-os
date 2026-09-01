-- =========================================================================
-- FortunIQ OS — Migration: Tender Register Usability & Ownership
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v24.
-- See docs/TENDER_REGISTER.md for the full architecture.
-- =========================================================================

-- ---------- CREATED BY ----------
-- Captured once, at creation, and never editable — see docs/TENDER_REGISTER.md.
alter table tenders
  add column if not exists created_by_name text,
  add column if not exists created_by_email text;

comment on column tenders.created_by_name is
  'Full name of whoever created this tender record — captured once at creation (addTender()), read-only afterward. Existing tenders created before this migration will show NULL here; there is no way to retroactively know who created them.';

-- ---------- ASSIGNED TO (denormalised for fast Register listing) ----------
-- The real source of truth for "who owns the CURRENT stage" remains
-- tender_stage_assignments (migration_v24) — these two columns are a
-- read-optimised COPY, kept in sync by moveTenderStage()/
-- reassignTenderStage() every time the current assignment changes, so
-- the Tender Register can show "Assigned To" without an extra join per
-- row across a register that may hold hundreds of tenders. See
-- docs/TENDER_REGISTER.md, "Why Assigned To is denormalised."
alter table tenders
  add column if not exists assigned_to_name text,
  add column if not exists assigned_to_email text,
  add column if not exists current_priority text;

comment on column tenders.current_priority is
  'Denormalised copy of the current stage assignment''s priority — kept in sync the same way as assigned_to_name/email, purely so the Tender Register can filter/sort by Priority without a join per row. See docs/TENDER_REGISTER.md.';

-- ---------- LAST ACTIVITY ----------
alter table tenders
  add column if not exists last_activity_at timestamptz,
  add column if not exists last_activity_description text;

comment on column tenders.last_activity_at is
  'Updated by recordTenderActivity() (see tender-activity.ts) whenever a MEANINGFUL action happens — stage changes, assignments, checklist updates, submissions, etc. Never updated for passive actions like simply viewing the tender. Used both for the Last Activity column and the Stale Tender indicator (isTenderStale() in tender-core.ts).';

-- ---------- ASSIGNMENT HISTORY: DISPLAY NAMES ----------
-- migration_v24 only captured previous_owner_email/new_owner_email —
-- correct for the backend record, but section 9 of this brief requires
-- "Always display employee full name and surname in the user
-- interface... Email addresses may remain in backend records where
-- needed but should not be the primary display value." Adding the name
-- columns here rather than editing migration_v24 in place, since that
-- migration may already be deployed — this follows the same
-- add-a-new-migration approach used throughout this app's history
-- rather than mutating a shipped one.
alter table tender_stage_assignment_history
  add column if not exists previous_owner_name text,
  add column if not exists new_owner_name text;

comment on column tender_stage_assignment_history.new_owner_name is
  'Full name, captured at the time of the event — used as the PRIMARY display value in AssignmentHistoryCard.tsx. new_owner_email remains for backend/audit purposes only, per the brief''s explicit instruction not to make email the primary UI value.';
