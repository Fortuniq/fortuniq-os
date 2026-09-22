-- =========================================================================
-- FortunIQ OS — Migration: Company vs Personal Tasks
-- (Project ORION, "My Workspace" redesign — My Tasks split)
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v30.
-- See docs/EMPLOYEE_DASHBOARD.md for the full design.
--
-- Extends the existing unified `tasks` table (same one workflow-
-- generated tasks already use — see migration_v15_dashboard_tasks.sql)
-- rather than creating a second, parallel task system for personal
-- tasks. Every existing row predates this column and is, by
-- definition, workflow-generated — so the default and backfill are both
-- 'Company', never 'Personal'.
-- =========================================================================

alter table tasks
  add column if not exists task_type text not null default 'Company' check (task_type in ('Company', 'Personal')),
  add column if not exists sort_order integer,
  add column if not exists reminder_at timestamptz;

update tasks set task_type = 'Company' where task_type is null;

create index if not exists tasks_task_type_idx on tasks (employee_email, task_type);

comment on column tasks.task_type is
  'Company = manager/workflow-assigned (created only via createTaskForEmployee in tasks.ts, never directly editable/deletable by the employee — see completeTask/reopenTask). Personal = employee-created, private, full CRUD (see createPersonalTask/updatePersonalTask/deletePersonalTask/reorderPersonalTasks in tasks.ts). Never changed after creation — a task cannot switch type.';
comment on column tasks.sort_order is
  'Manual drag-and-drop order for a Personal task, set via reorderPersonalTasks(). Unused/meaningless for Company tasks, which always sort by due date (see sortMyTasks in tasks-core.ts).';
comment on column tasks.reminder_at is
  'Optional reminder date/time for a Personal task, per the brief. No delivery mechanism reads this yet (no push/email job) — see docs/EMPLOYEE_DASHBOARD.md, "Known limitations."';
