-- =========================================================================
-- FortunIQ OS — Migration: AI-Generated Checklist Support
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
-- =========================================================================

-- Distinguishes an AI-proposed checklist item from one a person typed in
-- manually — purely informational (shown as a small badge in the UI), so
-- a Tender Administrator can see at a glance which items came from
-- FortunIQ Intelligence's analysis versus their own additions. This has
-- no effect on confirmation — AI-generated items start unconfirmed
-- exactly like manual ones, and only a human ticking the box changes
-- that. See docs/TENDER_WORKSPACE.md.
alter table tender_checklist_items add column if not exists source text not null default 'manual'
  check (source in ('manual', 'ai'));

comment on column tender_checklist_items.source is
  'Whether this item was proposed by FortunIQ Intelligence (''ai'') or added directly by a person (''manual''). Never affects confirmation status — a human must always tick the box.';
