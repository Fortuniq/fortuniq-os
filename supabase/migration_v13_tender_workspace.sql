-- =========================================================================
-- FortunIQ OS — Migration: Tender Document Workspace (Phase 1: Folders & Submissions)
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
-- =========================================================================

-- Per-tender SharePoint folder — created automatically when a tender is
-- added (see ensureTenderFolder() in src/lib/graph.ts), stored here so
-- FortunIQ OS never needs to re-derive or guess the folder location.
alter table tenders add column if not exists sharepoint_folder_id text;
alter table tenders add column if not exists sharepoint_folder_url text;

-- Submissions tab: how and when the tender was actually submitted.
alter table tenders add column if not exists submission_method text
  check (submission_method in ('Online', 'Hand Delivery'));
alter table tenders add column if not exists submission_datetime timestamptz;

comment on column tenders.sharepoint_folder_id is
  'The Microsoft Graph drive item ID for this tender''s dedicated SharePoint folder — set automatically when the tender is created.';
comment on column tenders.submission_method is
  'How the final tender pack was actually submitted: Online or Hand Delivery.';
comment on column tenders.submission_datetime is
  'When the tender pack was actually submitted.';
