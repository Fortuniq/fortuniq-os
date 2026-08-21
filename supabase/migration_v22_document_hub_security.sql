-- =========================================================================
-- FortunIQ OS — Migration: Document Hub Security & Manual Creation
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v21.
-- See docs/DOCUMENT_HUB_SECURITY.md for the full architecture.
-- =========================================================================

-- ---------- MANUAL DOCUMENT CREATION FIELDS ----------
-- expiry_date, classification, category, owner, version, status all
-- already exist from earlier migrations. Only description and
-- review_date are genuinely new.
alter table documents
  add column if not exists description text,
  add column if not exists review_date date;

comment on column documents.review_date is
  'Optional — when this document should next be reviewed for continued accuracy/relevance. Distinct from expiry_date, which is for hard compliance expiries (licences, insurance).';

-- ---------- SECURITY TRIMMING ----------
-- No schema change needed here — documents.employee_id already exists
-- (migration_v8_employee_hub.sql). The fix is entirely in application
-- code: canAccessDocumentByClassification() in ai-security-core.ts now
-- checks employee_id ownership BEFORE classification, and every
-- consumer of getDocuments() (the Documents Hub listing, search,
-- counts, AI Assistant) goes through that one function. See
-- docs/DOCUMENT_HUB_SECURITY.md for the full reasoning.
