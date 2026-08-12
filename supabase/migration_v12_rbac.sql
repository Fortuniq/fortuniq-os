-- =========================================================================
-- FortunIQ OS — Migration: Granular Role-Based Access Control (RBAC)
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
--
-- This ADDS a finer-grained permission layer on top of the existing
-- role/module system (from migration_v5) — it does not replace it. The
-- existing system still governs "can this person open this module's page
-- at all." This migration adds "given they can, what specifically can
-- they do there" — View, Create, Edit, Delete, Approve, Export, Manage,
-- per module, per employee. See docs/RBAC.md.
-- =========================================================================

create table if not exists employee_module_actions (
  id uuid primary key default gen_random_uuid(),
  employee_email text not null,
  module_key text not null,
  actions text[] not null default '{}',
  role_template text,
  updated_at timestamptz default now(),
  updated_by text,
  unique (employee_email, module_key)
);

create index if not exists employee_module_actions_email_idx on employee_module_actions (employee_email);

alter table employee_module_actions enable row level security;
create policy "No public access to employee_module_actions" on employee_module_actions for all using (false);

comment on table employee_module_actions is
  'Granular View/Create/Edit/Delete/Approve/Export/Manage permissions, per module, per employee. Managed from each employee''s System Access & Permissions section in Employee Hub. See docs/RBAC.md.';
comment on column employee_module_actions.role_template is
  'Which named Role Template (if any) was last applied as the starting point for this module''s permissions — for display/audit purposes only. Permissions can be customised after applying a template, so this is informational, not authoritative.';
