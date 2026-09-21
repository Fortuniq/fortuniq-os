-- =========================================================================
-- FortunIQ OS — Migration: Customizable Dashboard Layout
-- (Project ORION, "My Workspace" redesign, Phase 1)
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v28.
-- See docs/EMPLOYEE_DASHBOARD.md for the full design.
--
-- Deliberately a single small table, not a generic "user preferences"
-- store — this is specifically the dashboard's own widget layout
-- (visibility/size/order per widget), keyed by employee. If a second,
-- unrelated kind of per-user preference shows up later, it should get
-- its own column or table rather than being crammed into this one's
-- jsonb blob, for the same reason finance_number_sequences is its own
-- table rather than living in the generic app_settings key/value store.
-- =========================================================================

create table if not exists dashboard_layouts (
  employee_email text primary key,
  layout jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table dashboard_layouts enable row level security;
create policy "No public access to dashboard_layouts" on dashboard_layouts for all using (false);

comment on table dashboard_layouts is
  'Per-employee saved dashboard widget layout (which personal-productivity widgets are visible, what size, and in what order). One row per employee_email, upserted whenever they save a customization. Never used to gate WHAT DATA a widget can show — that is still decided entirely server-side by getPersonalisedDashboardData(); this table only ever decides whether an already-permitted widget is shown/hidden/resized/reordered. See src/lib/dashboard-widgets.ts for the widget registry and the merge/sanitize logic that is the single source of truth for turning a row here into what actually renders.';
comment on column dashboard_layouts.layout is
  'jsonb array of {key, visible, size, order}. Always re-sanitized through sanitizeDashboardLayoutForSave() (src/lib/dashboard-widgets.ts) before being written — never trusted as-is from the client, even though it already came from this same employee (a stale/corrupted saved layout must never break the dashboard for its own owner either).';
