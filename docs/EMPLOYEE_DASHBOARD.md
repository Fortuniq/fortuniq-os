# Employee Dashboard, My Tasks & Calendar

## What this is

The Dashboard is now a personalised "My Work" command centre instead of
a single company-wide view shown to everyone. It's built from four
pieces, all permission-aware:

- **My Tasks** — a unified task layer (extends the existing `tasks`
  table, doesn't replace it)
- **My Calendar** — a new `calendar_events` table
- **My Workflow** — a derived view (task counts grouped by module), not
  a separate system
- **Today's Attendance** — see `docs/ATTENDANCE.md`

## Reused, not rebuilt

Both existing permission layers are used exactly as they were before:

- `permissions.ts` / `permissions-core.ts` — coarse module access
  (`hasModuleAccess`)
- `rbac.ts` / `rbac-core.ts` — granular View/Create/Edit/Delete/Approve/
  Export/Manage per module per person

No new permission engine was introduced. `attendance` was added as a
new `ModuleKey`/`RbacModuleKey` so attendance visibility can be granted
independently — everything else plugs into the same two functions every
other module already uses.

## How personalisation works

`getPersonalisedDashboardData(permissions)` in `src/lib/data.ts` is the
single entry point the dashboard page calls. It:

1. Fetches the signed-in person's own tasks (`getMyTasks`), filtered by
   `employee_email` AND re-checked against `hasModuleAccess` per task —
   defence in depth, not just a query filter.
2. Fetches their own upcoming calendar events the same way.
3. Only includes organisation-wide statistics (the original global
   stat cards/chart) if `permissions.isAdmin` or `permissions.role ===
   "Management"` — everyone else only ever sees their own data.

The dashboard view component (`dashboard-view.tsx`) does **no
additional filtering** — by the time data reaches it, access decisions
have already been made server-side.

## My Tasks — how it avoids becoming a second task system

The existing `tasks` table (from `schema.sql`) was extended, not
replaced: `employee_email`, `module_key`, `record_id`, `record_url`,
`due_date`, `status`, `workflow_stage`, `created_by`, `completed_at`,
`completed_by`. The old `owner` (free-text name) and `due_label`
columns are kept for backward compatibility with existing rows and the
mock-data fallback.

Other modules create tasks by calling `createTaskForEmployee(...)` from
`src/lib/tasks.ts` — see `tender-actions.ts`'s `addTender()` for the
reference implementation: registering a tender automatically creates a
"Prepare submission" task (due on the closing date) and a matching
calendar entry, assigned to whoever registered it.

**Extending this to other modules**: the same two calls —
`createTaskForEmployee()` and `createCalendarEventForEmployee()` — can
be dropped into any other server action (Finance approvals, Document
review requests, HR onboarding steps) exactly the way they were added
to `addTender()`. This was deliberately built as a reusable primitive
rather than hand-building bespoke integration for every module in one
pass — Tenders is the reference; the same pattern extends to Finance/
Documents/HR/Sales as those workflows are wired up next.

## Calendar

`calendar_events` is a genuinely separate record type from `tasks`
(calendar = scheduled date, task = work item), linked only loosely via
`module_key`/`record_url` — matching the brief's own distinction.

**Outlook Calendar is NOT connected yet.** The existing Microsoft Graph
scopes (`src/auth.ts`) are `openid profile email offline_access
User.Read Files.ReadWrite.All Sites.ReadWrite.All` — no
`Calendars.Read`. Per the brief's explicit instruction ("do NOT
automatically request unnecessary Microsoft Graph permissions"), this
migration/feature does not add that scope. The `calendar_events` table
already has `source` (`'fortuniq' | 'outlook'`) and `outlook_event_id`
columns so Outlook sync can be added later without a schema change —
turning it on requires:

1. Adding `Calendars.Read` (or `.ReadWrite` if two-way sync is wanted)
   to `SCOPES` in `src/auth.ts`
2. Admin consent in Entra ID for the new scope
3. A new `getOutlookEvents()` function in `src/lib/graph.ts` (same
   delegated-token pattern as everything else there)
4. Merging its results into `getMyUpcomingEvents()` in
   `src/lib/calendar.ts`

This is a deliberate stopping point, not an oversight — confirm you
want the new scope requested before it's added, since every employee
who signs in afterward will see a new Microsoft consent prompt.

## Known limitations / what wasn't built in this pass

- Notifications are still company-wide/global (the `notifications`
  table gained `employee_email`/`module_key` columns in the migration,
  but nothing writes personal notifications into it yet).
- Only Tenders demonstrates the workflow-task-generation pattern.
  Finance/Documents/HR/Sales need the same two function calls added to
  their own server actions.
- No dedicated "My Tasks" full-list page yet — the dashboard shows the
  top 8 open tasks; a full list/filter page would be a small follow-up
  using the same `getMyTasks()` function.
