-- =========================================================================
-- FortunIQ OS — Migration: Tender Workflow & Planner Integration
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v22.
-- See docs/TENDER_PLANNER.md for the full architecture.
-- =========================================================================

-- ---------- WORKFLOW STAGE ----------
-- tenders.stage already exists (schema.sql) as free text, previously
-- used loosely/optionally. Reused here as the formal 5-stage workflow
-- column rather than adding a second column — deliberately NOT adding a
-- CHECK constraint, since existing rows may already hold arbitrary
-- stage text and a constraint would break them on this migration.
-- Validation of the 5-stage workflow (Drafting/Pricing/Assessment &
-- Verification/Submission Ready/Submitted) happens in application code
-- — see canTransitionTenderStage() in tender-core.ts — same
-- non-destructive approach used throughout this app's migrations.
comment on column tenders.stage is
  'Tender workflow stage: Drafting, Pricing, Assessment & Verification, Submission Ready, or Submitted (see tender-core.ts). Not DB-constrained to avoid breaking pre-existing free-text values — validated in application code.';

-- ---------- SUBMISSION RECORD ----------
alter table tenders
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by text,
  add column if not exists submission_method text,
  add column if not exists submission_reference text,
  add column if not exists final_pack_sharepoint_item_id text,
  add column if not exists final_pack_sharepoint_web_url text,
  add column if not exists proof_of_submission_sharepoint_item_id text,
  add column if not exists proof_of_submission_sharepoint_web_url text,
  add column if not exists submission_ready_by text,
  add column if not exists submission_ready_at timestamptz;

comment on column tenders.submission_ready_by is
  'Who moved this tender into "Submission Ready" — the act of making this transition IS the required authorisation/verification event (see docs/TENDER_PLANNER.md, "Stage controls"), logged here and in audit_logs.';

-- ---------- MICROSOFT PLANNER SYNC ----------
-- Reuses the existing unified `tasks` table (module_key = 'tenders',
-- record_id = tender id) rather than a separate tender_tasks table —
-- "Avoid duplicate tasks" per the brief, and this is the exact same
-- task layer already powering My Tasks / My Workflow on the dashboard.
alter table tasks
  add column if not exists planner_task_id text,
  add column if not exists planner_bucket_id text,
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists notes text;

comment on column tasks.planner_task_id is
  'Microsoft Planner task id, once synced. Sync is FortunIQ OS -> Planner only for now (one-way) — see docs/TENDER_PLANNER.md, "Sync direction," for why two-way sync was not attempted in this pass.';

-- ---------- SHARED PLANNER PLAN/BUCKET IDS ----------
-- One shared Planner plan ("FortunIQ Tender Workflow") with 5 buckets
-- matching the workflow stages, rather than a plan per tender — Planner
-- plans require a Microsoft 365 Group as their container, and creating
-- a new group per tender would be heavy machinery for what the brief
-- actually asks for (buckets matching the workflow, tasks moving
-- between them). Cached here so the plan/buckets are only ever created
-- once, not re-resolved by name on every request.
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
create policy "No public access to app_settings" on app_settings for all using (false);

comment on table app_settings is
  'Small key-value store for app-wide configuration that is not per-record — e.g. the shared Planner plan/bucket ids (key = ''planner_tender_workflow''). See docs/TENDER_PLANNER.md.';
