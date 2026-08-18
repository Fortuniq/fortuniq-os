-- =========================================================================
-- FortunIQ OS — Migration: Employee Self-Service & Document Acknowledgement
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations
-- (including migration_v18_document_control.sql — this one builds
-- directly on top of the versioning/status system it introduced).
-- See docs/EMPLOYEE_SELF_SERVICE.md for the full architecture.
-- =========================================================================

-- ---------- EMPLOYEE SHAREPOINT FOLDER ----------
-- Each employee gets their own SharePoint folder, created automatically
-- when their record is created. Stored here the same way tender/document
-- folders already are elsewhere in this app.
alter table employees
  add column if not exists sharepoint_folder_id text,
  add column if not exists sharepoint_folder_url text;

-- ---------- DOCUMENT VISIBILITY ----------
-- Separate from (and additive to) the existing General/Internal/
-- Confidential/Highly Confidential classification system from
-- migration_v7 — that system controls who can see a document AT ALL;
-- this one specifically controls whether an EMPLOYEE-linked document
-- (documents.employee_id is set) appears in that employee's own "My
-- Employment File" view. A document can be, say, Internal classification
-- (visible company-wide in the general Documents Hub) yet still HR
-- Restricted for THIS purpose — the two systems ask different questions.
-- Defaults to the most restrictive option deliberately: a document only
-- appears in My Employment File once someone explicitly marks it
-- Employee Visible, never by omission.
alter table documents
  add column if not exists visibility text not null default 'HR Restricted'
    check (visibility in ('Employee Visible', 'Manager Visible', 'HR Restricted', 'Finance Restricted', 'Super Admin Only'));

comment on column documents.visibility is
  'Controls My Employment File visibility for employee-linked documents specifically. See docs/EMPLOYEE_SELF_SERVICE.md.';

-- ---------- ACKNOWLEDGEMENT REQUIREMENT ----------
alter table documents
  add column if not exists acknowledgement_required boolean not null default false;

comment on column documents.acknowledgement_required is
  'When true, the employee this document belongs to must acknowledge the CURRENT version (see document_acknowledgements) before it counts as complete in Compliance Status.';

-- ---------- ACKNOWLEDGEMENT AUDIT TRAIL ----------
-- One row per (document, version, employee) acknowledgement — deliberately
-- version-specific and NEVER updated in place once created: a new version
-- of a document requires a brand new acknowledgement row, and the old
-- row for the previous version remains permanently, satisfying "the
-- acknowledgement for Version 2.0 must remain permanently stored."
create table if not exists document_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  version_number int not null,
  employee_id uuid references employees(id) on delete set null,
  employee_email text not null,
  employee_name text not null,
  document_name text not null,
  document_category text,
  status text not null default 'Pending' check (status in ('Pending', 'Acknowledged')),
  acknowledged_at timestamptz,
  ip_address text,
  device_info text,
  created_at timestamptz not null default now(),
  unique (document_id, version_number, employee_id)
);

create index if not exists document_acknowledgements_employee_idx on document_acknowledgements (employee_id);
create index if not exists document_acknowledgements_document_idx on document_acknowledgements (document_id);
create index if not exists document_acknowledgements_status_idx on document_acknowledgements (status);

alter table document_acknowledgements enable row level security;
create policy "No public access to document_acknowledgements" on document_acknowledgements for all using (false);

comment on table document_acknowledgements is
  'Permanent audit trail. Never deleted, never updated after acknowledged_at is set — a new document version gets a brand new Pending row rather than reusing/overwriting the old one. See docs/EMPLOYEE_SELF_SERVICE.md.';
