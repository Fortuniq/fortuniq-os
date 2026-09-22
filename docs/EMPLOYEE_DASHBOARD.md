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

### Company vs Personal split (Project ORION)

The My Tasks widget now shows two tabs, per the brief: **Company Tasks**
(everything above — manager/workflow-assigned, created only through
`createTaskForEmployee()`, never editable/deletable by the employee,
only completable/reopenable) and **Personal Tasks** (employee-created,
private, full create/edit/delete/reorder/complete/due-dates/priority,
plus an optional reminder date/time). Both live in the SAME `tasks`
table — a new `task_type` column (`'Company'` / `'Personal'`, see
`migration_v31_personal_tasks.sql`) distinguishes them rather than a
second parallel table, keeping the "avoid a second task system"
principle intact even as CRUD gets added.

- `src/lib/tasks-core.ts` — `TaskType`, `splitTasksByType()`,
  `sortPersonalTasks()` (personal tasks keep the employee's own
  drag-and-drop order via `sort_order`, not the due-date order Company
  tasks use), `validatePersonalTaskInput()`.
- `src/lib/tasks.ts` — `createPersonalTask()` / `updatePersonalTask()`
  / `deletePersonalTask()` / `reorderPersonalTasks()`, each re-checking
  ownership AND `task_type = 'Personal'` server-side — none of them can
  ever be used to edit or delete a Company task, even if a client sent
  a Company task's id.
- `src/app/(app)/dashboard/PersonalTaskList.tsx` — the full CRUD UI
  (native HTML5 drag-and-drop, same no-new-dependency choice as the
  Phase 1 customizable layout).

**Known limitation**: the `reminder_at` column has no delivery
mechanism yet (no push/email/notification job reads it) — it's stored
and shown, but nothing fires when it arrives. Wiring it up is a
natural follow-on once the Daily Planner / notifications phases land.

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

## Project ORION — Employee Dashboard Redesign ("My Workspace")

The Dashboard is being redesigned in phases into a full personalised
work hub, per the ORION brief (personal calendar with Outlook sync,
split Company/Personal tasks, My Workflow redesign, Market News, My
Notes, Daily Planner, customizable widgets, My Focus Today). Each
phase ships as a discrete, working package.

### Phase 1 — Customizable Dashboard Layout (done)

Employees can now show/hide, resize (compact/standard/wide), and
reorder (drag-and-drop) the "personal productivity" widgets on their
own dashboard, saved independently per employee. This is the
foundation every later ORION phase plugs into.

**Hard constraint honoured exactly as specified**: the Clock In /
Attendance widget and the "My Calendar / Upcoming" preview next to it
are **excluded from this system** and stay hand-coded at the top of
`dashboard-view.tsx`, in their existing position, completely untouched.
The brief is explicit that Attendance "must remain exactly where it
is... do not move it... do not redesign its position" — the safest
reading was to keep it entirely outside the customization framework
rather than treat it as a "pinned" widget within it. Calendar is
excluded too, since it's getting its own full interactive redesign in
a later phase; wiring today's throwaway preview into the general
framework would be wasted work.

Organisation-wide content (the module shortcut cards, and the
"Organisation Overview" section shown only to Super Admin/Management)
also stays outside this system — customization is scoped to personal
productivity widgets only, matching the brief's own framing.

**What's customizable**: My Tasks, My Workflow, My Attendance
(history), Document Expiry, Reminders (HCM), My Tender Tasks, and Live
Fuel Prices (for employees without broader organisation visibility —
Super Admin/Management see fuel prices paired with the Sales Trend
chart in Organisation Overview instead, which is unaffected by this
system).

**How it works**:
- `src/lib/dashboard-widgets.ts` — pure logic (zero DB/Next
  dependencies, mirrors the `finance-core.ts` pattern): the widget
  registry (key, label, default visibility/size/order) and
  `mergeDashboardLayout()`, the single function used both to build the
  layout for display AND to sanitize a save request, so display and
  persistence can never drift apart. A saved/proposed layout is never
  trusted as-is — unavailable or unrecognized keys are dropped,
  missing/invalid size or visibility falls back to the registry
  default, duplicates are deduped, and `order` is always renumbered to
  a clean 0..n-1 sequence.
- `getPersonalisedDashboardData()` (`src/lib/data.ts`) computes
  `availableWidgetKeys` server-side for the signed-in employee, right
  now — mirroring each widget component's own existing "nothing to
  show" empty-state check, so the Customize panel never offers a
  widget with nothing in it — and merges it with their saved layout
  (`dashboard_layouts` table, migration `migration_v29_dashboard_layout.sql`,
  RLS deny-all, one row per employee, `jsonb` layout column).
- `CustomizableDashboardGrid.tsx` (client component) renders the
  widgets, and only ever decides layout — it receives every available
  widget's already-rendered content as a `ReactNode` from the server
  (via `MyWorkflowCard.tsx` and `FuelPricesCard.tsx`, extracted from
  the dashboard view into their own files so every widget is a
  self-contained component). Reordering uses the native HTML5
  drag-and-drop API — no new npm dependency was added, consistent with
  this project's caution around installing new packages without a
  verified local build.
- `dashboard-layout-actions.ts` — `saveDashboardLayout()` /
  `resetDashboardLayout()` server actions, gated by
  `requireModuleAccess("dashboard")` (personal customization isn't an
  admin-level "Edit" RBAC action). `saveDashboardLayout()` never trusts
  the client's `availableWidgetKeys` — it recomputes them fresh via
  `getPersonalisedDashboardData()` before sanitizing, so a stale client
  (e.g. an old tab open from before a role change) can't smuggle in a
  widget key no longer available to that employee. `resetDashboardLayout()`
  deletes the saved row rather than writing back defaults, so a future
  new widget appears automatically instead of being frozen out.

### Phase 2 — Market News module (done)

Full admin-managed CRUD content module (create/edit/delete/pin/
categorise/publish+expiry dates/high-priority/PDF-or-link attachments)
feeding a new `marketNews` dashboard widget — see `docs/MARKET_NEWS.md`
for the complete design, including the deliberate `source` column that
lets a future external API or AI pipeline plug in without a schema or
UI redesign, per the brief's explicit two-phase instruction. No
placeholder content, no external API — real content, manually
published, from day one.

### Phase 3 — My Tasks split, Company vs Personal (done)

See "Company vs Personal split (Project ORION)" above.

### Phase 4 — My Workflow redesign (done)

Per the brief: "show current workflow/stage/owner/progress/due date, a
'Continue Working' button, and recent workflow history." Built entirely
on the existing unified task layer, not a new tracking system — a
"workflow item" is simply an open Company task that carries a
`workflow_stage` (see `src/lib/workflow-core.ts`):

- `pickCurrentWorkflowItemsByModule()` — one item per module you have
  live workflow work in (the most urgent open task: soonest due date,
  then highest priority), each shown with its stage, due date, owner
  ("You" — My Tasks/My Workflow are always the signed-in person's own,
  by design), and a "Continue Working" button linking to
  `recordUrl` (falling back to the module's own page if a task has
  none).
- **Progress bar**: only shown where this app actually has an ordered
  stage sequence to compute a fraction from — today, only Tenders
  (`TENDER_WORKFLOW_STAGE_ORDER` in `tender-core.ts`). Every other
  module's workflow item shows its stage as text with no progress bar,
  rather than fabricating a percentage — same "never invent a number"
  principle as `tender-core.ts`'s own `ComplianceResult`. Extending
  progress bars to another module just means giving that module an
  ordered stage list and adding one branch to
  `computeStageProgressPct()`.
- **Recent workflow history**: the last 5 completed Company/workflow
  tasks for the signed-in employee (`getMyRecentlyCompletedWorkflowTasks()`
  in `tasks.ts` — a small, separate, explicit query, so every other
  caller of `getMyTasks()` keeps only ever seeing open work).
- The old counts-by-module view (a bare "3 items" link per module) is
  gone from this widget — that information now lives, as it always
  did, in the "Relevant module cards" grid further down the dashboard
  (`moduleCards`, computed from the same `workflowByModule` counts,
  unchanged).

### What's next

My Notes, Daily Planner, Personal Calendar redesign, Outlook Calendar
two-way sync (blocked on an explicit decision to request the new
`Calendars` Microsoft Graph scope — not added unilaterally, since
every employee would see a new consent prompt), and My Focus Today.

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
