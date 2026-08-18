-- =========================================================================
-- FortunIQ OS — Migration: HCM Phase 3
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v20.
-- See docs/HCM_PHASE3.md for the full architecture.
-- =========================================================================

-- ---------- IDENTITY (HR/Super Admin manage; employee views own, masked) ----------
alter table employees
  add column if not exists id_number text,
  add column if not exists passport_number text,
  add column if not exists date_of_birth date,
  add column if not exists nationality text,
  add column if not exists gender text,
  add column if not exists home_address text,
  add column if not exists drivers_licence text,
  add column if not exists work_permit text;

comment on column employees.id_number is
  'RESTRICTED. HR/Super Admin full view; the employee themselves sees a masked version only (****** **** 082). Nobody else — including Manager — ever sees this. See docs/HCM_PHASE3.md and canViewIdentity() in hcm-core.ts.';

-- ---------- EMPLOYMENT (expanded) ----------
alter table employees
  add column if not exists contract_type text,
  add column if not exists notice_period text,
  add column if not exists probation_end_date date,
  add column if not exists payroll_cycle text,
  add column if not exists shift_pattern text;

-- ---------- PAYROLL (RESTRICTED — Finance/HR/Super Admin ONLY, never the employee) ----------
alter table employees
  add column if not exists salary numeric(14, 2),
  add column if not exists payroll_number text,
  add column if not exists uif text,
  add column if not exists paye text,
  add column if not exists medical_aid text,
  add column if not exists pension text,
  add column if not exists bonus_eligibility boolean not null default false,
  add column if not exists leave_encashment numeric(14, 2),
  add column if not exists payroll_status text default 'Active' check (payroll_status in ('Active', 'Suspended', 'Final Pay Processed'));

comment on column employees.salary is
  'RESTRICTED to Finance/HR/Super Admin. Deliberately NOT covered by canViewRestrictedEmployeeField()''s self-access exception — the brief is explicit that employees do not see this, even their own, at this stage. See canViewPayroll() in hcm-core.ts.';

-- ---------- CAREER DEVELOPMENT & PROMOTION HISTORY ----------
-- Kept as single jsonb blobs rather than new tables — this data changes
-- rarely and is always viewed/edited as a whole unit, not queried
-- field-by-field, so a table with its own foreign keys would add
-- complexity without a real benefit. See docs/HCM_PHASE3.md.
alter table employees
  add column if not exists career_development jsonb
    default '{"trainingGoals": [], "developmentPlans": "", "completedProgrammes": [], "futureCareerPath": "", "promotionRecommendations": ""}'::jsonb,
  add column if not exists promotion_history jsonb not null default '[]'::jsonb;

comment on column employees.promotion_history is
  'Array of {date, fromRole, toRole, notes}. HR/Super Admin append-only in practice (enforced in application code, not a DB constraint) — see docs/HCM_PHASE3.md.';

-- Widen the existing leave_balance default to include the optional
-- "Study Leave" bucket the brief asks for, without breaking any
-- existing employee row's current balance (only the DEFAULT changes;
-- existing rows keep whatever they already have).
alter table employees alter column leave_balance
  set default '{"annual": 15, "sick": 10, "family_responsibility": 3, "study": 0}'::jsonb;

-- ---------- LEAVE REQUESTS ----------
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  employee_email text not null,
  employee_name text not null,
  leave_type text not null check (leave_type in ('Annual', 'Sick', 'Family Responsibility', 'Study', 'Maternity', 'Paternity', 'Unpaid')),
  start_date date not null,
  end_date date not null,
  working_days numeric(4, 1) not null,
  reason text,
  attachment_sharepoint_item_id text,
  attachment_web_url text,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected', 'Cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text
);

create index if not exists leave_requests_employee_id_idx on leave_requests (employee_id);
create index if not exists leave_requests_status_idx on leave_requests (status);
create index if not exists leave_requests_dates_idx on leave_requests (start_date, end_date);

alter table leave_requests enable row level security;
create policy "No public access to leave_requests" on leave_requests for all using (false);
-- See migration_v20's header comment for why this is a deny-all
-- placeholder today (service-role-only architecture) rather than a
-- real auth.jwt() policy — the same reasoning applies uniformly to
-- every new table in this migration.

comment on table leave_requests is
  'One row per leave request. Approving deducts working_days from employees.leave_balance; rejecting never touches the balance; cancelling restores previously-deducted days. All balance math happens in application code (see leave.ts) so it stays auditable and easy to reason about — never a database trigger doing it invisibly. See docs/HCM_PHASE3.md.';

-- ---------- PERFORMANCE REVIEWS ----------
create table if not exists performance_reviews (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  reviewer_email text not null,
  reviewer_name text,
  review_period text not null,
  overall_rating text,
  kpis jsonb not null default '[]'::jsonb,
  objectives jsonb not null default '[]'::jsonb,
  manager_feedback text,
  status text not null default 'Draft' check (status in ('Draft', 'Published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists performance_reviews_employee_id_idx on performance_reviews (employee_id);

alter table performance_reviews enable row level security;
create policy "No public access to performance_reviews" on performance_reviews for all using (false);

comment on table performance_reviews is
  'A review only becomes visible to the employee once status = Published — a Draft in progress is never shown in My Profile. See docs/HCM_PHASE3.md.';
