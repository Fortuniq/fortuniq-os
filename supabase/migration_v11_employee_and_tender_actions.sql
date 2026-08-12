-- =========================================================================
-- FortunIQ OS — Migration: Employee & Tender Add/Edit support
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
-- =========================================================================

-- Employee numbers are now assigned automatically by the database itself
-- whenever a new employee row is created — through the app's new "Add
-- Employee" form, or a direct SQL insert — so there's no risk of two
-- people accidentally getting the same number.
alter table employees
  alter column employee_number set default ('EMP-' || lpad(nextval('employee_number_seq')::text, 4, '0'));
