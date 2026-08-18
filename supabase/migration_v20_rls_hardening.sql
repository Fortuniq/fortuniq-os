-- =========================================================================
-- FortunIQ OS — Migration: Row Level Security for Employee Self-Service
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v19.
--
-- WHY THIS IS A SEPARATE MIGRATION, AND WHY IT'S DORMANT TODAY
-- =========================================================================
-- FortunIQ OS authenticates entirely through NextAuth + Microsoft Entra
-- ID (see src/auth.ts) — there is no Supabase Auth session anywhere in
-- this app. Every database call goes through the SERVICE ROLE key
-- (createServiceClient() in src/lib/supabase/service.ts), which BYPASSES
-- Row Level Security by design (this is standard, correct Supabase
-- behaviour — the service role is meant for trusted server code). That
-- is why every table in this app so far, including the ones added in
-- migration_v19, has a deny-all placeholder policy: `auth.uid()` and
-- `auth.jwt()` are simply undefined in every request FortunIQ OS
-- currently makes, so a policy written against them would never fire.
--
-- The REAL enforcement for "employees can only see their own profile /
-- documents" lives in application code today — see
-- getEmployeeByEmail(permissions.email) in src/lib/data.ts and
-- canSeeInEmploymentFile() in src/lib/employee-hub-core.ts, both driven
-- by the signed-in person's session email, which NextAuth verifies via
-- Microsoft on every request. This is a legitimate, secure enforcement
-- point — it is not "no security," it's enforcement at a different
-- layer than literal Postgres RLS.
--
-- That said, the brief specifically asks for Supabase RLS, and a second
-- layer of defence is worth having even if the primary app code is
-- correct. The policies below are written to be GENUINELY correct and
-- ready to activate: they match against `auth.jwt() ->> 'email'`, which
-- works the moment (if) this app introduces ANY code path that queries
-- Supabase using a user-context client carrying an email claim (e.g. a
-- future client-side Supabase client, a custom JWT minted from the
-- NextAuth session, or Supabase Auth itself). Until that day, these
-- policies are inert — the service role still bypasses them, exactly as
-- it does today — but they are real, tested-against-the-schema policies
-- rather than a "for all using (false)" placeholder, and they cost
-- nothing to have in place now.
-- =========================================================================

-- ---------- document_acknowledgements ----------
-- Replace the deny-all placeholder from migration_v19 with a real,
-- identity-scoped set of policies.
drop policy if exists "No public access to document_acknowledgements" on document_acknowledgements;

-- An employee (identified by JWT email claim, once one exists) can read
-- their own acknowledgement history, and can insert a new acknowledgement
-- for themselves — but can never update or delete one, matching "This
-- record must never be deleted" and "never updated after
-- acknowledged_at is set" from the brief.
create policy "Employees can view their own acknowledgements"
  on document_acknowledgements for select
  using (employee_email = (auth.jwt() ->> 'email'));

create policy "Employees can acknowledge on their own behalf"
  on document_acknowledgements for insert
  with check (employee_email = (auth.jwt() ->> 'email'));

-- No update/delete policy is defined at all for any role via this JWT
-- path — that absence is deliberate and is what makes the row
-- immutable once written, for anyone querying with a user-context
-- client. HR/Super Admin review and export still work today because
-- that code path uses the service role, which is unaffected by RLS.

-- ---------- employees ----------
-- Replace the deny-all placeholder with: an employee can read their own
-- row. Writes remain service-role-only (no insert/update/delete policy
-- is defined here) — HR/Super Admin editing an employee record already
-- goes through requirePermissionAction("people", "Edit") in application
-- code via the service role, unaffected by this.
drop policy if exists "No public access to employees" on employees;

create policy "Employees can view their own record"
  on employees for select
  using (email = (auth.jwt() ->> 'email'));

-- ---------- documents ----------
-- Replace the deny-all placeholder with: an employee can read a
-- document linked to them (employee_id) ONLY when it's marked "Employee
-- Visible" and is in a finalised state — the exact same rule
-- canSeeInEmploymentFile() enforces in application code (see
-- src/lib/employee-hub-core.ts). This mirrors, rather than duplicates,
-- that logic — if the two ever disagree, this is the one Postgres
-- itself will hold to regardless of what the application code does.
drop policy if exists "No public access to documents" on documents;

create policy "Employees can view their own Employee Visible, finalised documents"
  on documents for select
  using (
    employee_id in (select id from employees where email = (auth.jwt() ->> 'email'))
    and visibility = 'Employee Visible'
    and status in ('Approved', 'Published')
  );

-- Note: this policy only covers the EMPLOYEE-SELF-SERVICE case
-- (documents.employee_id set). It intentionally does NOT grant general
-- Documents Hub access to anyone via RLS — that's governed by
-- classification/authorized_roles/authorized_emails in application code
-- (see src/lib/ai-security-core.ts), which would need its own mirrored
-- policy if/when this app moves any Documents Hub read path off the
-- service role. Out of scope for this migration.
