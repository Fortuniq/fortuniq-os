-- =========================================================================
-- FortunIQ OS — Reset Script
-- Only run this if you want to wipe everything and start schema.sql fresh.
-- This permanently deletes all tables and data — there's no undo.
-- =========================================================================

drop table if exists tender_checklist_items cascade;
drop table if exists tenders cascade;
drop table if exists tasks cascade;
drop table if exists notifications cascade;
drop table if exists fuel_prices cascade;
drop table if exists learning_paths cascade;
drop table if exists courses cascade;
drop table if exists documents cascade;
drop table if exists employees cascade;
