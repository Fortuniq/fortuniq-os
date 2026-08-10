-- =========================================================================
-- FortunIQ OS — Migration: SharePoint Document Management
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
--
-- Per the requirements for this feature: actual document FILES are never
-- stored in Supabase. This migration only adds a few columns so Supabase
-- can hold a pointer to where each document actually lives in SharePoint
-- (its SharePoint item ID and link), plus an approval status so the AI
-- Assistant only ever surfaces documents your team has marked Approved.
-- =========================================================================

alter table documents
  add column if not exists sharepoint_item_id text,
  add column if not exists sharepoint_web_url text,
  add column if not exists status text not null default 'Draft'
    check (status in ('Draft', 'Approved', 'Archived'));

-- Mark your existing sample documents as Approved, since they represent
-- real, already-finalised company documents (Handbook, Brand Manual, etc.)
update documents set status = 'Approved' where status = 'Draft';

comment on column documents.sharepoint_item_id is
  'The SharePoint driveItem ID for this file. Populated automatically once a document is linked to SharePoint from the Documents page.';
comment on column documents.sharepoint_web_url is
  'Direct link to open this file in SharePoint/Office in the browser.';
comment on column documents.status is
  'Draft, Approved, or Archived. Only Approved documents are ever surfaced to the AI Assistant.';
