-- =========================================================================
-- FortunIQ OS — Migration: Employee Hub (Phase 1)
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
--
-- This is Phase 1 of the Employee Hub — the Employee Directory, full
-- Employee Profile, and the Document Centre foundation. See
-- docs/EMPLOYEE_HUB.md for what's built now vs. what's a genuinely
-- separate future phase (Onboarding/Offboarding workflows, Attendance,
-- Leave, Performance, Payroll, Expenses, Benefits, Compliance Dashboard).
-- =========================================================================

-- ---------- EMPLOYEE NUMBERS ----------
-- Human-readable, sequential IDs like EMP-0001, auto-assigned.
create sequence if not exists employee_number_seq start 1;

-- ---------- EXTEND THE EMPLOYEES TABLE ----------
alter table employees add column if not exists employee_number text unique;
alter table employees add column if not exists photo_url text;
alter table employees add column if not exists preferred_name text;
alter table employees add column if not exists manager_id uuid references employees(id);
alter table employees add column if not exists office_location text;
alter table employees add column if not exists employment_type text
  check (employment_type in ('Full-Time', 'Part-Time', 'Contract', 'Intern'));
alter table employees add column if not exists probation_status text
  check (probation_status in ('In Probation', 'Confirmed', 'Not Applicable'))
  default 'Not Applicable';
alter table employees add column if not exists phone text;
alter table employees add column if not exists emergency_contact jsonb;
alter table employees add column if not exists next_of_kin jsonb;

-- Restricted fields — see docs/EMPLOYEE_HUB.md for exactly who can see
-- these (the employee themselves, HR/Admin, Finance, Super Admin — same
-- pattern as document classification in migration_v7).
alter table employees add column if not exists banking_details jsonb;
alter table employees add column if not exists tax_number text;

alter table employees add column if not exists skills text[] not null default '{}';
alter table employees add column if not exists performance_rating text;
alter table employees add column if not exists leave_balance jsonb
  default '{"annual": 15, "sick": 10, "family_responsibility": 3}'::jsonb;
alter table employees add column if not exists archived boolean not null default false;
alter table employees add column if not exists archived_at timestamptz;
alter table employees add column if not exists updated_at timestamptz default now();

-- Extend the status options to include Suspended and Archived, alongside
-- the existing Active/Onboarding/On Leave/Terminated (kept for backward
-- compatibility with any existing data — "Terminated" is treated the
-- same as "Archived" going forward; new records should use "Archived",
-- consistent with "no employee is ever permanently deleted."
alter table employees drop constraint if exists employees_status_check;
alter table employees add constraint employees_status_check
  check (status in ('Active', 'Onboarding', 'On Leave', 'Suspended', 'Terminated', 'Archived'));

-- Backfill employee numbers for anyone who doesn't have one yet.
update employees set employee_number = 'EMP-' || lpad(nextval('employee_number_seq')::text, 4, '0')
  where employee_number is null;

comment on column employees.banking_details is
  'RESTRICTED. Visible only to: the employee themselves, HR/Admin, Finance, Super Admin. See docs/EMPLOYEE_HUB.md.';
comment on column employees.tax_number is
  'RESTRICTED. Same access rule as banking_details.';

-- ---------- EQUIPMENT ----------
create table if not exists employee_equipment (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  item text not null,
  serial_number text,
  issued_date date not null default current_date,
  returned_date date,
  status text not null default 'Issued' check (status in ('Issued', 'Returned')),
  created_at timestamptz default now()
);

-- ---------- CERTIFICATIONS ----------
create table if not exists employee_certifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  name text not null,
  issued_date date,
  expiry_date date,
  created_at timestamptz default now()
);

-- ---------- DOCUMENT CENTRE: link documents to a specific employee ----------
-- Reuses the exact classification system built in migration_v7 — an
-- employee's contract, ID document, disciplinary record etc. all go
-- through the same General/Internal/Confidential/Highly Confidential
-- rules, the same ai_excluded switch, and the same AI permission
-- inheritance already built. Nothing new to secure here — this just
-- connects existing documents to a specific person's file.
alter table documents add column if not exists employee_id uuid references employees(id) on delete set null;
alter table documents add column if not exists document_type text;
alter table documents add column if not exists expiry_date date;

-- Digital signature fields — the DATA MODEL is ready now; the actual
-- signing flow (notification, e-signature capture, IP/timestamp
-- recording) is a Phase 2 feature. See docs/EMPLOYEE_HUB.md.
alter table documents add column if not exists signature_status text
  default 'Not Required' check (signature_status in ('Not Required', 'Pending Signature', 'Signed'));
alter table documents add column if not exists signed_by_email text;
alter table documents add column if not exists signed_at timestamptz;
alter table documents add column if not exists signed_ip_address text;
-- When a document is signed, the ORIGINAL is never overwritten — a new
-- row is created for the signed copy, linked back to the original here.
alter table documents add column if not exists original_document_id uuid references documents(id);

comment on column documents.employee_id is
  'If set, this document belongs to a specific employee''s personnel file — subject to the same classification rules as any other document.';
comment on column documents.signature_status is
  'Data model ready for Phase 2 e-signature capture. Not yet wired to a real signing flow — see docs/EMPLOYEE_HUB.md.';

-- ---------- SECURITY ----------
alter table employee_equipment enable row level security;
create policy "No public access to employee_equipment" on employee_equipment for all using (false);

alter table employee_certifications enable row level security;
create policy "No public access to employee_certifications" on employee_certifications for all using (false);
