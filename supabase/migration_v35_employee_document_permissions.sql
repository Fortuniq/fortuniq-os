-- ============================================================================
-- migration_v35_employee_document_permissions.sql
-- ============================================================================
-- Fixes HR/Admin not being able to upload/manage employee documents in the
-- Employee Hub -> Employee Profile -> Document Centre. See
-- docs/EMPLOYEE_DOCUMENT_PERMISSIONS.md for the full write-up.
--
-- A new granular RBAC module key, "employee-documents", was added in code
-- (src/lib/permissions-core.ts, src/lib/rbac-core.ts) — deliberately
-- SEPARATE from the existing "people" module, so employee-document
-- management can be granted or withheld independently of general Employee
-- Hub access. This migration is the one-time backfill new module keys
-- always need: everyone with the coarse "HR/Admin" role gets it added to
-- their `allowed_modules` column (the actual per-user list that
-- hasModuleAccess() checks — ROLE_DEFAULT_MODULES in code is only the
-- starting point copied for BRAND NEW users going forward, it does not
-- retroactively touch existing rows).
--
-- Super Admins need no backfill — getCurrentUserPermissions() always gives
-- them every module key dynamically (ALL_MODULE_KEYS), including this new
-- one, with no dependency on the stored allowed_modules array at all.
--
-- This does NOT touch the granular employee_module_actions table (the
-- per-person, per-module View/Create/Edit/.../Manage matrix used by
-- checkPermissionAction/requirePermissionAction) — that system already
-- has documented, deliberate "not yet configured -> fall back to allow"
-- behaviour (see src/lib/rbac.ts), so an HR/Admin user who has never had
-- this module explicitly configured for them individually already gets
-- full access once the coarse gate above passes. Nothing needs seeding
-- there for this fix to take effect. An admin can still visit System
-- Access & Permissions afterwards to grant "employee-documents" to a
-- specific Manager or Finance person if ever needed for their role.
-- ============================================================================

update user_permissions
set allowed_modules = allowed_modules || array['employee-documents']::text[]
where role = 'HR/Admin'
  and not ('employee-documents' = any(allowed_modules));
