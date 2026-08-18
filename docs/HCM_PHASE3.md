# Employee Hub Phase 3: HCM (Identity, Leave, Performance, Payroll)

## What this is

Phase 3 turns Employee Hub into a Human Capital Management module:
Identity, expanded Employment, Leave (with a full request/approval/
balance workflow), Performance reviews, and restricted Payroll — all
governed by RBAC, and surfaced in My Profile where the brief specifies.

## Manager is a relationship, not a new role

Rather than widening `RoleKey` from 6 values to 7, Manager access is
derived from the existing `employees.manager_id` relationship (added in
`migration_v8_employee_hub.sql`). `isDirectManagerOf()` and
`canManagerAccessTeamMember()` in `hcm-core.ts` check "is this person's
`manager_id` equal to the viewer's own employee id" — anyone gets
manager-scoped access to their own direct reports' Leave requests and
can create Performance reviews for them. Nothing else HR-restricted
(Identity, Payroll) extends to Manager.

## Identity — masked, not just hidden

`canViewIdentity()` returns `"full" | "masked" | "none"`. HR/Super Admin
get `"full"`; the employee themselves gets `"masked"` — `maskIdNumber()`
reduces an ID number to `****** **** 082`, matching the brief's example
exactly. Nobody else, including Manager, gets anything. Enforced
server-side in `people/[id]/page.tsx` — the full identity object is
replaced with an all-null object before it reaches the browser when
access is `"none"`.

## Payroll — deliberately narrower than the existing banking/tax rule

`canViewPayroll()` is a NEW function, separate from the existing
`canViewRestrictedEmployeeField()` (banking/tax), because the brief is
explicit: employees do not see this even for themselves, unlike
banking/tax which has a self-access exception. Finance/HR/Super Admin
only, always.

## Leave — balance math lives in application code, never a trigger

`leave.ts`'s `reviewLeaveRequest()` is the one place balance changes
happen: Approved deducts, Rejected never touches the balance, Cancelled
from Approved restores exactly what was deducted, Cancelled from
Pending never touches the balance. `calculateWorkingDays()` excludes
weekends and is computed server-side from the submitted dates, never
trusted from the client. South African public holidays are the brief's
own listed "(future enhancement)" — not implemented, since hard-coding
a holiday calendar would silently go stale year to year.

`canTransitionLeaveStatus()` validates every transition server-side,
mirroring the same pattern already used for documents and attendance.

## Performance — Draft vs Published

A review is only visible to the employee once `status = 'Published'`.
`getMyPublishedReviews()` (employee-facing) and `getAllReviewsForEmployee()`
(HR/Manager-facing, includes Drafts) are deliberately separate functions
so the employee-facing path can never accidentally leak a Draft.

## Career Development & Promotion History — jsonb, not new tables

Both stored as `jsonb` on `employees` rather than their own tables —
this data changes rarely and is always read/written as a whole unit, so
a table with foreign keys would add complexity without real benefit.

## Dashboard reminders — only what's honestly computable

Implemented: Upcoming Leave, Pending Leave Requests (own + org-wide for
HR), Probation Ending Soon, Birthday, Work Anniversary — all computed
live from existing fields.

**Deliberately NOT implemented**: "Performance Review Due" and
"Mandatory Training Outstanding." Neither `performance_reviews` nor the
Academy integration has a "next due date" or "mandatory" concept in the
schema — inventing one would be guessing at an unspecified business
rule, which is worse than omitting it.

## Known limitations

- Performance Review Due / Mandatory Training Outstanding — not
  implemented; would need an explicit review-cadence field and an
  Academy "mandatory" flag, neither of which exists yet.
- South African public holidays in leave calculation — explicitly
  deferred per the brief.
- A dedicated Leave Calendar UI (Section 3's "Calendar" subsection) —
  the data is fully queryable via `leave_requests`, but no standalone
  calendar component was built this pass.
- Maternity/Paternity/Unpaid leave types don't draw down a tracked
  balance bucket — matching the brief listing these as forward-looking.
- RLS: follows the same dormant-but-correct pattern from
  `migration_v20_rls_hardening.sql` — deny-all placeholders on the new
  tables, consistent with this app's service-role-only architecture.
