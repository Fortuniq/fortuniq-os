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

### Phase 5 — My Notes (done)

Per the brief: a private notes widget for "notes, meeting minutes,
ideas, phone numbers, reminders, action items." Deliberately the
simplest ORION phase — free-text only, no categorisation or tagging,
since the brief's list of use cases is broad enough that any imposed
structure would just get in the way. Entirely private: nobody but the
signed-in employee can ever read or write their own notes, not even
Super Admin — there's no admin/manager view of another employee's
notes anywhere in this feature.

- `src/lib/notes-core.ts` — pure logic (zero DB/Next dependencies):
  `PersonalNote`/`NoteInput` types, `validateNoteInput()` (content
  required, ≤10,000 chars; optional title ≤200 chars), `sortNotes()`
  (pinned first, then most-recently-updated), `notePreview()` (first
  line, truncated) used for the collapsed card view.
- `supabase/migration_v32_personal_notes.sql` — new `personal_notes`
  table (`employee_email`, `title` nullable, `content`, `pinned`,
  timestamps), indexed on `employee_email`, RLS deny-all (all access
  goes through the service-role client in `notes-data.ts`, same
  pattern as every other personal-data table in this project).
- `src/lib/notes-data.ts` — `getMyNotes()` / `createNote()` /
  `updateNote()` / `deleteNote()` / `toggleNotePin()`, each of the
  write functions re-checking `employee_email` ownership server-side
  before touching a row, independent of whatever the client sent.
- `src/app/(app)/dashboard/note-actions.ts` — server actions deriving
  the owner from the signed-in session only (never a client-supplied
  email), same posture as the Personal Tasks actions.
- `src/app/(app)/dashboard/MyNotesCard.tsx` — expandable note cards
  (click to expand/collapse full content vs. preview), inline
  add/edit form, pin/unpin, delete with confirmation.
- **Always available, unlike every other widget in the customization
  system**: `myNotes` is added to `availableWidgetKeys`
  unconditionally in `data.ts`, not gated on having any notes yet —
  an empty My Notes widget IS the "add your first note" entry point,
  so hiding it until content exists would hide the only way to create
  that content. Documented inline in `dashboard-widgets.ts`.

### Phase 6 — Outlook Calendar two-way sync (done)

`Calendars.ReadWrite` added to `src/auth.ts`'s requested scopes —
**explicitly confirmed before adding**, since every employee sees a new
Microsoft consent prompt the next time they sign in after this deploys.

- `src/lib/graph.ts` — `getOutlookEvents()` / `createOutlookEvent()` /
  `updateOutlookEvent()` / `deleteOutlookEvent()`, same
  per-signed-in-user access-token pattern as every other Graph call in
  this file (never a shared app credential).
- `src/lib/calendar.ts`'s `syncOutlookCalendar(accessToken, employeeEmail)`
  — run on-demand (a "Sync with Outlook" button on the calendar page,
  or automatically whenever the calendar page loads), not as a
  scheduled job, since this Netlify/Next.js deployment has no
  background worker to run one from. Two directions:
  1. **Push** — any FortunIQ-sourced event with no `outlook_event_id`
     yet is created in Outlook and stamped with the id Graph returns.
  2. **Pull** — Outlook events in the sync window not already mirrored
     locally (matched by `outlook_event_id`) are inserted as
     `source='outlook'` rows, and from then on render identically to
     FortunIQ ones (`getMyUpcomingEvents()` needed no change).
  Deliberately does **not** detect or replay Outlook-side deletions —
  diffing the full remote set on every load was judged not worth the
  extra Graph calls for v1. A documented limitation, not a bug: a
  person who deletes a synced Outlook event will still see it in
  FortunIQ OS until they delete it there too.
- `supabase/migration_v33_calendar_planner_outlook.sql` — adds
  `updated_at`/`last_synced_at` to `calendar_events` (the `source`/
  `outlook_event_id` columns already existed, unused, since
  migration_v16).

### Phase 7 — Daily Planner (done)

Deliberately built on **top of** `calendar_events`, not a new table —
a "time block" is just a calendar event that also carries a duration
and a category (Deep Work/Meeting/Task/Break/Personal). This means
every planner block automatically gets Outlook two-way sync for free,
which is how "optional Outlook sync" from the brief is satisfied
without a second Graph integration (the brief said "Outlook Tasks
sync" specifically; this app doesn't have a Microsoft To Do/Tasks
integration, and building one would need yet another Graph scope — a
planner block syncing as a normal timed Outlook Calendar event was
judged the more useful, lower-friction interpretation).

- `src/lib/planner-core.ts` — `validatePlannerBlockInput()`,
  `sortBlocksByTime()`, `findOverlappingBlocks()` (advisory only — two
  things genuinely can overlap in a day; this never blocks a save),
  `totalPlannedMinutes()`.
- `src/app/(app)/dashboard/DailyPlannerCard.tsx` — today's blocks,
  native HTML5 drag-and-drop to retime a block by dropping it onto
  another (same no-new-dependency choice as every other reorderable
  list in this app), quick-add form, overlap warnings highlighted
  inline.
- A customizable "personal productivity" widget like My Notes —
  always available (see `dashboard-widgets.ts`), since an empty
  planner is the "add your first block" entry point.

### Phase 8 — Personal Calendar redesign (done)

A full interactive month view at `/dashboard/calendar`, internal-first
(works completely with zero Outlook connection — Outlook events just
appear once synced). Reached from the dashboard's "My Calendar /
Upcoming" preview via "Open full calendar."

- `src/lib/calendar-core.ts` — pure logic: `buildMonthGrid()` (a full
  6-week/42-day grid including the leading/trailing days from adjacent
  months, so every week row is complete), `groupEventsByDate()`,
  `addMonths()`.
- `src/lib/calendar.ts` — `getMyEventsInRange()` (an arbitrary date
  window, not just "next N days" like `getMyUpcomingEvents()`),
  `createCalendarEvent()` / `updateCalendarEvent()` /
  `deleteCalendarEvent()`, all ownership-scoped like every other
  personal-data write in this app.
- `src/app/(app)/dashboard/calendar/CalendarView.tsx` — month grid,
  click a day to see/add/delete its events, month navigation via URL
  search params (`?y=&m=`), and the "Sync with Outlook" button.
- Deleting a FortunIQ-sourced event that was synced to Outlook also
  best-effort deletes the Outlook copy (`calendar-actions.ts`) — a
  Graph failure there never blocks the local delete that already
  happened.

### Phase 9 — My Focus Today (done)

Built exactly to the detailed brief provided for this feature. **Not**
another task list — it answers one question ("what's the single most
important thing today?") and highlights one real work item that still
lives in My Tasks/My Workflow/Calendar/Tenders/Finance. Rendered
**pinned above the customizable widget grid**, same treatment as
Attendance, because the brief calls it "one of the main features of
the dashboard" — unlike every other ORION widget, it can't be hidden,
resized away, or buried by personal layout choices.

- `src/lib/focus-core.ts` — `EmployeeFocus`/`FocusCandidate` types,
  `validateFocusInput()`, `scoreFocusCandidate()` /
  `recommendFocus()` — **"FortunIQ Intelligence"** is a deterministic,
  explainable scoring rule (overdue work scores highest, then closer
  due dates, then priority, then a same-day meeting nudge), built
  entirely from fields already on candidates the dashboard had already
  fetched for other widgets — no external AI/LLM call and no new data
  source, same "real logic now, no placeholder" posture used for
  Market News's `source` field. `needsDailyResetPrompt()` — the "never
  silently discard unfinished work" rule from the brief.
- `supabase/migration_v34_employee_focus.sql` — `employee_focus`
  table, one row per focus ever held (active or historical). A partial
  unique index (`is_active` where true) backstops the "only ONE active
  focus" rule that application code (`focus-data.ts`'s `setFocus()`,
  which deactivates any current active row before inserting) already
  enforces.
- `src/lib/focus-data.ts` — `getMyActiveFocus()`, `setFocus()`
  (source: Employee/Intelligence/Manager), `carryForwardFocus()` ("Continue
  Yesterday's Focus"), `updateFocusProgress()`, `deactivateFocus()`
  ("Change Focus"), and `getMyDirectReports()` — **reuses the existing
  `employees.manager_id` relationship** (already powering
  `managerName` in the Employee Hub directory) for "who is this
  person's manager," rather than inventing a second reporting-line
  concept just for this feature.
- `src/app/(app)/dashboard/focus-actions.ts` — server actions for all
  of the above, plus `assignFocusToReportAction()` (Manager Assigned),
  which checks the target really is a direct report of the caller
  before writing anything.
- `src/app/(app)/dashboard/MyFocusCard.tsx` — every state from the
  brief: the daily-reset prompt, "no focus yet" (recommendation +
  manual picker), the full active-focus display (all the brief's
  fields — Objective/Module/Related item/Stage/Priority/Due
  Date/Days Remaining/Progress/Est. Time/Assigned By/Last Activity —
  plus Continue/Update Progress/Change Focus), and a compact "Assign a
  focus to your team" section shown only to people who actually have
  direct reports.
- **Candidates, and where "Set as My Focus" lives**: rather than
  adding a bespoke "Set as My Focus" button to every module's own
  detail page (Tender Workspace, a Quotation, an Invoice, a Course —
  each a separate file this pass didn't touch), the brief's "any
  eligible task, tender, workflow stage, quotation, invoice, meeting
  prep item or personal task" is surfaced through the Focus card's own
  picker, built from the same My Tasks/My Workflow/Calendar data
  already flowing through the dashboard (`data.ts`'s
  `focusCandidates`). Every open Company task, Personal task, and
  today's calendar events are eligible; since Tenders/Finance work
  already reaches My Tasks via `createTaskForEmployee()` (see "My
  Tasks — how it avoids becoming a second task system," above), this
  covers the brief's examples without a second integration point.
  Academy and a dedicated Finance quotation/invoice picker are the
  natural next follow-on once those modules also call
  `createTaskForEmployee()` the way Tenders does.
- **Known limitation**: the "When completed" success moment is the
  card's own state transition (a completed focus deactivates, and the
  card falls back to "no active focus" — recommendation/picker — which
  can only be reached by the employee's own next choice, never
  automatically) rather than a distinct toast/success banner. The
  substance of the brief ("never automatically select another item
  without confirmation") is honoured; the extra polish of a
  celebratory message is a small, easy follow-up.

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
- Outlook sync doesn't detect deletions made on the Outlook side (see
  Phase 6) — only new/changed events are pulled in.
- Daily Planner blocks and Personal Calendar events are `today`/window
  scoped from the same `calendar_events` rows My Tasks-generated
  deadlines also use; a block dragged onto another block's time slot
  swaps times one-directionally (the dropped block takes the target's
  start time) rather than a full swap — simplest correct behaviour for
  v1, matching this app's general "no more than the brief asks for"
  discipline.
- My Focus Today's "Manager Assigned" source only offers direct
  reports (`employees.manager_id`) — there's no way today for a
  manager to assign a focus to someone outside their direct line
  (e.g. a cross-functional project lead), matching how the rest of
  FortunIQ OS doesn't yet model matrixed reporting.
