-- =========================================================================
-- FortunIQ OS — Migration: Employee Calendar
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
--
-- This is the FortunIQ OS calendar — deadlines, meetings, and workflow
-- dates that live inside FortunIQ OS itself. It is deliberately a
-- SEPARATE record type from `tasks` (calendar = scheduled date, task =
-- work item), linked together only by module_key/record_id, same as
-- tasks are linked to their underlying module records. See
-- docs/EMPLOYEE_DASHBOARD.md.
--
-- Outlook integration: `source` and `outlook_event_id` exist so that,
-- if/when Microsoft Graph Calendar read access (Calendars.Read) is
-- explicitly added to the app's requested scopes, Outlook events can be
-- synced in here without a schema change. That scope is NOT requested by
-- this migration or by the app today — see docs/EMPLOYEE_DASHBOARD.md
-- for why, and what would be required to turn it on.
-- =========================================================================

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  employee_email text not null,
  title text not null,
  event_date date not null,
  event_time time,
  all_day boolean not null default false,
  event_type text not null default 'General'
    check (event_type in ('Meeting', 'Deadline', 'Tender Closing', 'Compliance', 'Follow-up', 'Training', 'Internal', 'General')),
  module_key text,
  record_id text,
  record_url text,
  source text not null default 'fortuniq' check (source in ('fortuniq', 'outlook')),
  outlook_event_id text,
  created_by text,
  created_at timestamptz default now()
);

create index if not exists calendar_events_employee_email_idx on calendar_events (employee_email);
create index if not exists calendar_events_event_date_idx on calendar_events (event_date);
create index if not exists calendar_events_module_key_idx on calendar_events (module_key);

alter table calendar_events enable row level security;
create policy "No public access to calendar_events" on calendar_events for all using (false);

comment on table calendar_events is
  'Personal + workflow-generated calendar entries per employee. Populated by module actions (e.g. a tender closing date) as well as manually. See docs/EMPLOYEE_DASHBOARD.md.';
