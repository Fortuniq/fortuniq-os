-- =========================================================================
-- FortunIQ OS — Migration: Daily Planner + Outlook two-way sync columns
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v32.
--
-- Extends the existing `calendar_events` table (migration_v16) rather
-- than creating a new one — a Daily Planner "time block" is just a
-- calendar event that also carries a duration and an optional category.
-- See src/lib/planner-core.ts and docs/EMPLOYEE_DASHBOARD.md.
--
-- Also adds the columns Outlook two-way sync needs: `updated_at` (so we
-- know which side changed more recently) and `last_synced_at` (so a
-- background/on-load sync pass can tell what still needs pushing/
-- pulling). `source`/`outlook_event_id` already existed, unused until
-- now — see docs/EMPLOYEE_DASHBOARD.md for the scope change this
-- migration accompanies (Calendars.ReadWrite requested in src/auth.ts).
-- =========================================================================

alter table calendar_events add column if not exists duration_minutes integer;
alter table calendar_events add column if not exists block_category text
  check (block_category is null or block_category in ('Deep Work', 'Meeting', 'Task', 'Break', 'Personal'));
alter table calendar_events add column if not exists updated_at timestamptz default now();
alter table calendar_events add column if not exists last_synced_at timestamptz;

comment on column calendar_events.duration_minutes is
  'Daily Planner time-block length in minutes. Null for ordinary calendar entries (deadlines, tender closings) that were never dragged into a planned block.';
comment on column calendar_events.block_category is
  'Daily Planner block category (Deep Work/Meeting/Task/Break/Personal). Null for non-planner calendar entries.';
comment on column calendar_events.last_synced_at is
  'Last time this row was successfully pushed to or pulled from Outlook. Null means never synced (source=''fortuniq'' event not yet mirrored, or Outlook sync not yet run for this employee).';
