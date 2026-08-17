-- =========================================================================
-- FortunIQ OS — Migration: Employee Attendance (Clock In / Clock Out)
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
--
-- Storage decision (see docs/ATTENDANCE.md for the full reasoning): the
-- operational source of truth is this Supabase table, NOT a SharePoint
-- List directly. Every employee's Clock In/Clock Out reads and writes
-- here, so it stays fast and fits the app's existing server-action
-- pattern. A SharePoint List ("Attendance Register", HR/Super-Admin-only
-- access) is kept in sync as a best-effort mirror by
-- src/lib/attendance.ts, purely for HR's Excel export / register-of-
-- record needs — a Clock In/Out never fails or blocks just because that
-- sync call has trouble, matching how tender SharePoint folder creation
-- already behaves elsewhere in this app.
--
-- One row per employee per calendar day — enforced by the unique
-- constraint below, which is what actually prevents duplicate Clock Ins
-- (see docs/ATTENDANCE.md, "Preventing duplicate clock-ins").
-- =========================================================================

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete set null,
  employee_email text not null,
  employee_name text not null,
  department text,
  role text,
  attendance_date date not null,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  total_minutes int,
  status text not null default 'Clocked In'
    check (status in ('Clocked In', 'Clocked Out', 'Missing Clock-Out')),
  late boolean not null default false,
  notes text,
  sharepoint_item_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (employee_email, attendance_date)
);

create index if not exists attendance_employee_email_idx on attendance (employee_email);
create index if not exists attendance_attendance_date_idx on attendance (attendance_date);
create index if not exists attendance_status_idx on attendance (status);

alter table attendance enable row level security;
create policy "No public access to attendance" on attendance for all using (false);

comment on table attendance is
  'One row per employee per working day. clock_in_at/clock_out_at are always set server-side from the request timestamp, never trusted from the browser. See docs/ATTENDANCE.md.';
comment on column attendance.status is
  'Clocked In = active session, no clock-out yet today. Clocked Out = completed normally. Missing Clock-Out = a previous day was left open and needs HR/Super Admin review — see attendance_corrections.';

-- ---------- ATTENDANCE CORRECTIONS ----------
-- Employees never edit a clock-in/out timestamp directly once recorded —
-- only through this auditable request/approve workflow (see
-- docs/ATTENDANCE.md, "Attendance Corrections").

create table if not exists attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid references attendance(id) on delete cascade,
  employee_email text not null,
  attendance_date date not null,
  requested_field text not null check (requested_field in ('clock_in_at', 'clock_out_at')),
  original_value timestamptz,
  corrected_value timestamptz not null,
  reason text not null,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  requested_by text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz default now()
);

create index if not exists attendance_corrections_status_idx on attendance_corrections (status);
create index if not exists attendance_corrections_employee_email_idx on attendance_corrections (employee_email);

alter table attendance_corrections enable row level security;
create policy "No public access to attendance_corrections" on attendance_corrections for all using (false);

comment on table attendance_corrections is
  'Full audit trail for any change to a recorded clock-in/out time: original value, corrected value, reason, who requested it, who approved/rejected it, and when. Approving a correction updates the attendance row AND keeps this row as the historical record — nothing is silently overwritten.';
