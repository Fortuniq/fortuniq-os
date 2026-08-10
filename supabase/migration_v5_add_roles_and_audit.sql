-- =========================================================================
-- FortunIQ OS — Migration: Roles & Audit Logs
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
-- =========================================================================

-- ---------- ROLES ----------
-- Adds a named role to each person, alongside the existing is_admin flag
-- and allowed_modules list (which now represent the role's default set of
-- modules, fine-tunable per person from Team Management).
alter table user_permissions
  add column if not exists role text
    check (role in ('Super Admin', 'Management', 'HR/Admin', 'Finance', 'Sales/Marketing', 'Employee'));

-- Backfill existing people sensibly: anyone who was already an Admin
-- becomes Super Admin; everyone else becomes Employee (the most
-- restrictive role) until you assign them something more specific in
-- Team Management.
update user_permissions set role = 'Super Admin' where is_admin = true and role is null;
update user_permissions set role = 'Employee' where is_admin = false and role is null;

comment on column user_permissions.role is
  'One of: Super Admin, Management, HR/Admin, Finance, Sales/Marketing, Employee. See docs/ROLES_AND_PERMISSIONS.md for what each role can see.';

-- ---------- AUDIT LOGS ----------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_email text not null,
  actor_name text,
  action text not null,
  target_type text,
  target_id text,
  target_label text,
  metadata jsonb
);

create index audit_logs_created_at_idx on audit_logs (created_at desc);
create index audit_logs_actor_email_idx on audit_logs (actor_email);
create index audit_logs_action_idx on audit_logs (action);

alter table audit_logs enable row level security;

-- Same pattern as user_permissions: real access control happens in the
-- app itself (only Super Admin and HR/Admin can reach the Audit Logs
-- page — see src/lib/permissions.ts). This policy is defense-in-depth
-- in case the public anon key is ever used directly against this table.
create policy "No public access to audit logs" on audit_logs
  for all using (false);

comment on table audit_logs is
  'Records who did what and when. Visible in-app only to Super Admin and HR/Admin roles. Populated automatically by the app — never edit rows here directly.';
