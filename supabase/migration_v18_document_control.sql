-- =========================================================================
-- FortunIQ OS — Migration: Enterprise Document Control System
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
--
-- See docs/DOCUMENT_CONTROL.md for the full architecture. Summary:
--   - `documents` gains a 5-state lifecycle (was 3-state) plus who/when
--     for each transition, and a running version counter.
--   - `document_versions` is NEW — one row per physical file that has
--     ever been linked to a document record, whether it's the current
--     active version or has since been archived. This is what makes
--     Version History / Restore Previous Version possible: SharePoint's
--     own native version history can't hold our "comments" field or
--     survive our archive-by-moving-to-a-different-folder model, so we
--     keep our own ledger. See docs/DOCUMENT_CONTROL.md,
--     "Why a separate versions table."
-- =========================================================================

-- ---------- 5-STATE LIFECYCLE ----------
-- Was: Draft, Approved, Archived (3 states, from migration_v4).
-- Now: Draft -> Pending Approval -> Approved -> Published -> Archived.
-- Existing rows keep their current status unchanged (Draft/Approved/
-- Archived are still valid values in the new, wider set).

alter table documents drop constraint if exists documents_status_check;
alter table documents add constraint documents_status_check
  check (status in ('Draft', 'Pending Approval', 'Approved', 'Published', 'Archived'));

alter table documents
  add column if not exists submitted_for_approval_by text,
  add column if not exists submitted_for_approval_at timestamptz,
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz,
  add column if not exists published_by text,
  add column if not exists published_at timestamptz,
  add column if not exists modified_by text,
  add column if not exists current_version_number int not null default 1;

comment on column documents.current_version_number is
  'The version number of the currently active file (matches the highest is_current=true row in document_versions). Displayed as "v{n}" in the UI.';

-- Note: `expiry_date` already exists on `documents` from migration_v8 —
-- reused as-is for Tax Clearance / Insurance / B-BBEE / Licence expiry
-- tracking, no new column needed for that.

-- ---------- VERSION HISTORY ----------

create table if not exists document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  version_number int not null,
  sharepoint_item_id text not null,
  sharepoint_web_url text,
  is_current boolean not null default true,
  uploaded_by text,
  uploaded_by_name text,
  uploaded_at timestamptz not null default now(),
  comments text,
  archived_at timestamptz,
  archived_by text,
  unique (document_id, version_number)
);

create index if not exists document_versions_document_id_idx on document_versions (document_id);
create index if not exists document_versions_is_current_idx on document_versions (is_current);

alter table document_versions enable row level security;
create policy "No public access to document_versions" on document_versions for all using (false);

comment on table document_versions is
  'One row per physical file ever linked to a document record. Moving a file into SharePoint''s Archive folder does not change its SharePoint item id (Graph moves preserve id) — only is_current, archived_at, archived_by change here. See docs/DOCUMENT_CONTROL.md.';

-- ---------- CATEGORY VALUES ----------
-- Widened to match the SharePoint library structure exactly (see
-- docs/DOCUMENT_CONTROL.md, "SharePoint folder structure"). Existing
-- singular values (Policy, Certificate, Licence) are intentionally left
-- valid alongside the new plural set so existing rows never need a
-- backfill — the UI going forward always writes the new values.
