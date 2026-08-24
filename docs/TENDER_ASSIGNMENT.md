# Tender Stage Ownership & Assignment

## Design principle, enforced in code

"FortunIQ OS remains the workflow controller. Microsoft Planner
visualises and tracks the work. Planner must never become the source
of truth. All workflow changes originate in FortunIQ OS and
synchronise to Planner." Concretely: every assignment write happens in
Supabase first; Planner sync is always the second, best-effort step
(see `docs/TENDER_PLANNER.md`) that never blocks or reverses the real
FortunIQ OS change.

## The core gate: a stage cannot become active without an owner

`validateStageAssignment()` in `tender-core.ts` is the actual
enforcement. `moveTenderStage()` in `tender-actions.ts` requires an
`assignTo` field in the same `FormData` as the stage change and
validates it BEFORE either the stage or the assignment is written —
they're written together, or neither is written. The UI
(`AssignStageModal` in `TenderWorkflowControl.tsx`) makes this the only
path: there is no "move stage" button that skips the assignment form.

## Data model: current state + permanent history

Two tables, deliberately separate:

- **`tender_stage_assignments`** — one row per `(tender, stage)`, the
  CURRENT owner only. Reassigning updates this row in place.
- **`tender_stage_assignment_history`** — permanent, append-only. Every
  Assigned/Reassigned/Completed event is recorded here and NEVER
  updated or deleted, satisfying "Store all reassignment history" and
  the Audit Trail section literally, even though the "current state"
  table only ever shows the latest owner per stage.

**Known interaction worth knowing about**: because
`tender_stage_assignments` has a unique constraint on `(tender_id,
stage)`, moving a tender backward to a stage it already passed through
(e.g. Assessment & Verification sends work back to Pricing) reactivates
that same row rather than creating a new one — its previous "Completed"
state is overwritten by the new "Active" assignment. The full sequence
of what happened is still completely recoverable from
`tender_stage_assignment_history`, which never loses anything; only the
"current state" table reflects just the latest state per stage, by
design.

## Overdue — computed, not stored

Same pattern as document expiry and dashboard reminders elsewhere in
this app: `isStageOverdue()` compares `due_date` against today at READ
time. There is no background job marking rows overdue, and no such job
is needed for the status itself to be accurate everywhere it's
displayed (tender detail, My Tender Tasks, Team Assignments).

## Notifications

Section 4 asks for in-app, Microsoft Teams, and Outlook email
notifications. Implemented in this pass: **in-app only** — both a task
(`createTaskForEmployee`, which surfaces in the assignee's My Tasks/My
Workflow automatically) and a lightweight row in the existing
`notifications` table. Teams and Outlook are explicitly listed in the
brief itself as "(future integration)" — not attempted here, since
Teams/Outlook notifications would need Microsoft Graph
`ChannelMessage.Send`/`Mail.Send` scopes this app doesn't have, and
sending email/Teams messages on someone's behalf is a meaningfully
bigger step than an in-app task.

## Overdue escalation — manual, not scheduled

Section 7 asks for automatic notification of the assignee, their
manager, and Super Admin when a stage goes overdue. This app has no
cron/scheduled-job infrastructure (everything is computed at request
time — see "Overdue — computed, not stored" above), so a true
automatic escalation the moment a due date passes isn't implemented.
Instead: `sendOverdueStageEscalation()` is a manual "Escalate" button
on the Team Assignments widget (CEO/Manager dashboard), available to
anyone with Tenders Edit permission, which notifies exactly those three
audiences on demand. A real automatic version would need a Netlify
Scheduled Function (or equivalent) polling for newly-overdue
assignments — a documented follow-up, not attempted here.

## Employee & CEO/Manager dashboards

- **My Tender Tasks** (`MyTenderTasksCard.tsx`, on the personal
  dashboard) — the signed-in person's own active assignments:
  tender, stage, due date, priority, overdue status. Only renders when
  there's at least one.
- **Team Tender Assignments** (`TeamAssignmentsWidget.tsx`, on the
  Tenders page) — org-wide for Super Admin/Management/HR-Admin;
  scoped to only a Manager's own direct reports (via the existing
  `manager_id` relationship — see `docs/HCM_PHASE3.md`, "Manager is a
  relationship, not a new role") for anyone else. This scoping happens
  server-side in `tenders/page.tsx`, not just by hiding rows in the
  UI. Filterable by employee client-side, and includes the manual
  Escalate action for overdue rows.

## Audit trail

Every assignment/reassignment/stage-move also writes a
`document_status_changed`-family entry to the existing `audit_logs`
table (reusing the same audit infrastructure as the rest of this app),
in addition to the dedicated, richer
`tender_stage_assignment_history` table. The two serve different
purposes: `audit_logs` is the general "who did what, when" log across
the whole app; `tender_stage_assignment_history` is the
structured, queryable, tender-specific record shown on the Assignment
History card.

## Known limitations

- **Planner assignment**: a synced Planner task's title/bucket reflect
  the stage and tender, but the task is not assigned to a specific
  Microsoft user in Planner itself — this would require storing each
  employee's Azure AD object id, which this app doesn't capture
  anywhere (same limitation already documented in
  `docs/TENDER_PLANNER.md`).
- **Teams/Outlook notifications**: not implemented — see
  "Notifications" above.
- **Automatic overdue escalation**: manual only — see "Overdue
  escalation" above.
- **Due Date Changed** history event type exists in the schema but
  isn't written by any action yet — there's currently no standalone
  "just change the due date, nothing else" action; changing a due date
  today happens via reassignment or a fresh stage move. A dedicated
  "update due date" action would be a small, self-contained follow-up.
