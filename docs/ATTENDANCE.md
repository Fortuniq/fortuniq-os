# Attendance (Clock In / Clock Out)

## Storage decision: Supabase table, not a SharePoint List directly

The brief originally asked to prefer a SharePoint List as the primary
attendance register. This implementation uses a Supabase table
(`attendance`) as the operational source of truth instead, with a
SharePoint List (`Attendance Register`) kept as a best-effort mirror for
HR's register/export needs. Reasoning:

- Every Clock In/Clock Out goes through `requirePermissionAction`/
  `getCurrentUserPermissions` and a server action, same as every other
  write in this app — that pattern expects a fast, queryable database
  call, not a Graph API round-trip on every request.
- Preventing duplicate clock-ins relies on a real `unique
  (employee_email, attendance_date)` database constraint (see
  `migration_v17_attendance.sql`) — SharePoint Lists don't offer an
  equivalent atomic uniqueness guarantee reachable from a serverless
  function without extra complexity.
- HR filtering/reporting (by employee, department, date range, status)
  is a normal SQL query against Supabase; the same filtering against a
  SharePoint List would need paginated Graph calls and client-side
  filtering.
- If Graph/SharePoint has a transient failure, a Clock In should still
  succeed — Supabase-first with a best-effort SharePoint sync means a
  person is never blocked from clocking in because of a SharePoint
  hiccup, matching how `ensureTenderFolder()` already behaves elsewhere
  in this app (tender creation never fails just because folder creation
  did).

The SharePoint List is still real and still gets written to — see
`upsertAttendanceListItem()` / `ensureAttendanceList()` in
`src/lib/graph.ts` — it's just not the thing Clock In/Out reads or
writes synchronously.

### SharePoint list permissions

Creating the list via Graph does not, by itself, restrict who in the
organisation can open it directly in SharePoint — that requires
breaking permission inheritance on the list, a site-admin action beyond
what `Sites.ReadWrite.All` safely automates. **A site admin needs to do
this once, manually, in SharePoint's own sharing settings**, to fully
lock the list down to HR/Super Admin at the SharePoint level. FortunIQ
OS itself already enforces the real access control regardless — nobody
without the `attendance` module permission can reach the HR Attendance
page or its data through the app, with or without that manual step.

## Identity — always server-side, never client-supplied

`clockInAction()` / `clockOutAction()` (in `attendance-actions.ts`) read
the employee's identity entirely from the authenticated session
(`getCurrentUserPermissions()` → `employees` table lookup by email).
The client sends no employee identifier at all — there's nothing to
tamper with.

## Timestamps

`clockIn()` / `clockOut()` in `src/lib/attendance.ts` generate `new
Date().toISOString()` on the server at the moment the function runs —
the browser is never asked for a time and nothing it sends is used for
the recorded timestamp.

## Preventing duplicate clock-ins

Two layers:

1. `canClockIn()` (pure logic, `attendance-core.ts`) checks the
   already-fetched "today" record before attempting a write.
2. The database's own `unique (employee_email, attendance_date)`
   constraint is the real backstop against a race between two
   near-simultaneous requests — a constraint violation is caught and
   turned into the same friendly "already clocked in" message.

## Missing Clock-Out

A record still `Clocked In` after its own calendar day has passed is
surfaced via `getMissingClockOuts()` on the HR Attendance page — nothing
invents a clock-out time automatically.

## Corrections — audit trail, never silent overwrite

`attendance_corrections` is a separate table. Employees never edit
`clock_in_at`/`clock_out_at` directly; `requestAttendanceCorrection()`
creates a pending row with the original value, requested value, and
reason. `reviewAttendanceCorrection()` (HR/Super Admin only, gated by
`requirePermissionAction("attendance", "Approve")`) updates the real
attendance row on approval **and** leaves the correction row itself as
permanent history — nothing is overwritten without a trace.

## Access control

- **Clock In/Clock Out for yourself**: available to anyone who can reach
  the Dashboard (no `attendance` module grant needed — this is a
  personal action, not an HR privilege).
- **HR Attendance page** (`/attendance` — register, missing clock-outs,
  corrections review): gated by `requireModuleAccess("attendance")` at
  the page level, and `requirePermissionAction("attendance", "Approve")`
  on the actual correction-approval server action — a hidden nav item is
  not the enforcement; the server action re-checks independently.
- Default role templates: HR Manager and Administrator get `attendance:
  Manage` (full); CEO gets it via the "everything" template; everyone
  else has no entry, meaning no access, until explicitly granted — per
  the brief's "Managers should NOT automatically have access to all
  employee attendance."

## Working hours / late detection

`isLateClockIn()` takes an optional `WorkingHoursConfig` — if none is
supplied, it always returns `false` rather than guessing. A real
Settings-driven working-hours configuration (start time, grace period,
working days, public holidays) is intentionally deferred, per the
brief's "do not hard-code employment rules unnecessarily" — the current
`DEFAULT_WORKING_HOURS` in `src/lib/attendance.ts` is a placeholder
default, not a policy.

## What wasn't built in this pass

- Leave/public-holiday awareness when computing attendance
- A dedicated "My Attendance" history view (the data function
  `getMyAttendanceHistory()` exists and is fetched into the dashboard
  payload, but no UI card renders it yet — a small follow-up)
- Payroll/timesheet integration (explicitly out of scope per the brief)
- GPS/biometric verification (explicitly excluded per the brief)
