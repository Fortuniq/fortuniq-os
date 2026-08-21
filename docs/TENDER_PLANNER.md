# Tender Planner Integration

## Architecture principle, enforced in code

**FortunIQ OS owns the tender. SharePoint owns the documents. Microsoft
Planner manages the work.** Concretely: `tenders` and `tasks` remain the
only system of record — Planner never gets a field FortunIQ OS doesn't
also have, and every Planner-related action in this app writes to
FortunIQ OS FIRST, then best-effort mirrors to Planner. A Planner
failure never blocks or rolls back the real FortunIQ OS action.

## New Microsoft Graph scope: `Tasks.ReadWrite`

Added to `SCOPES` in `auth.ts`. This means every person will see a new
Microsoft consent prompt the next time they sign in after this deploys.
Requested only because explicitly instructed to build the full Planner
integration — confirm this is still wanted before deploying.

## One shared Planner plan, not one per tender

Planner plans require a Microsoft 365 Group as their container.
Programmatically creating a new Group per tender would need
`Group.ReadWrite.All` — a much broader permission than this feature
actually needs, and against this app's established principle of not
requesting more Graph access than necessary. Instead: **an admin
provisions ONE Planner plan once**, manually, in Planner or Teams
("FortunIQ Tender Workflow"), and sets its id as the `PLANNER_PLAN_ID`
environment variable — the same pattern already used for
`SHAREPOINT_SITE_URL`. `ensureTenderPlannerBuckets()` then creates the 5
workflow-stage buckets inside that one plan automatically, idempotently.

If `PLANNER_PLAN_ID` isn't set, `isPlannerConfigured` is `false` and
every Planner sync call in this app quietly no-ops — tender tasks still
work completely normally in FortunIQ OS, they just don't appear on a
Planner board until an admin sets this up.

## Sync direction: FortunIQ OS → Planner only

Per the brief's own guidance ("If two-way sync cannot safely be
implemented immediately, prioritise FortunIQ OS → Planner first and
clearly document the limitation") — this pass implements **one-way
sync only**:

- Creating a tender task in FortunIQ OS creates the matching Planner
  task (`syncNewTenderTaskToPlanner`).
- Moving a tender's workflow stage moves its synced tasks to the
  matching Planner bucket (`syncTenderStageToPlanner`).
- Completing a FortunIQ OS task marks the Planner task 100% complete
  (`syncTaskCompletionToPlanner`).

**Not implemented**: a Planner task being completed or moved directly
in Planner does NOT flow back into FortunIQ OS. Someone completing a
task in the Planner app itself will not update FortunIQ OS — FortunIQ
OS remains the source of truth for status regardless. A true two-way
sync would need either a webhook subscription to Planner change
notifications or a polling job — genuinely more infrastructure than fit
in this pass, and deliberately deferred rather than attempted partially.

## No duplicate task system

Tender tasks are the exact same `tasks` table (module_key='tenders')
that already powers My Tasks / My Workflow on the personalised
dashboard — extended with `planner_task_id`, `planner_bucket_id`,
`checklist` (jsonb), and `notes` columns, not a new `tender_tasks`
table. "Avoid duplicate tasks" per the brief is satisfied by
construction: there is only ever one task record per piece of work,
whether or not it's synced to Planner.

## Workflow stages

Reuses the existing `tenders.stage` column (already present, previously
loose free text) rather than adding a second column. **Deliberately not
DB-constrained** — a CHECK constraint would break any pre-existing
tender with a stage value outside the new 5-value set (the codebase
already had at least one such value, `"Closed — Won"`, used by an
unrelated pre-existing "Won" stat card). Validation lives entirely in
application code (`canTransitionTenderStage()` in `tender-core.ts`).

**Known interaction worth knowing about**: tenders using the new
workflow will never have `stage = "Closed — Won"`, since that's not one
of the 5 workflow values. The pre-existing "Won (12 mo.)" stat card on
the Tender Register, which filters on that exact string, was not
touched in this pass (out of scope) but may show 0 for tenders created
under the new workflow. Worth revisiting — likely that stat should
filter on `status === "Awarded"` instead, which is the tender's real
outcome field, separate from workflow stage.

Stages move forward one step at a time, or backward to any earlier
stage (work getting sent back for rework) — never skipped ahead.

## Stage controls — the "Submission Ready" gate

Moving specifically INTO "Submission Ready" requires:
1. Documents "Approve"-level RBAC permission (not just Edit).
2. `checkSubmissionReadiness()` passing — every checklist item
   confirmed AND compliance at 100%, computed from real data
   (`tender_checklist_items`, `tenders.compliance`).

Per the brief: "FortunIQ Intelligence may identify risks and missing
items but must not independently approve the stage transition." This is
enforced structurally, not just by convention — `checkSubmissionReadiness()`
only checks what FortunIQ OS's own data says is complete; it never
calls out to the AI, and no AI-derived signal can satisfy this gate.
Actually clicking "Move to Submission Ready" — a human action requiring
real permission — is the only path through.

## Submission record

`recordTenderSubmission()` — only reachable from "Submission Ready" —
captures Submission Method and Reference directly, Submission Date/Time
and Submitted By automatically (server-generated, never client-supplied,
same principle as attendance timestamps and tender values elsewhere in
this app), and optionally uploads the Final Tender Pack / Proof of
Submission to the tender's SharePoint folder.

## Tender Dashboard indicators

`getTenderWorkflowCounts()` computes Drafting/Pricing/Awaiting
Assessment/Submission Ready counts from tenders, and Due This
Week/Overdue Tasks from the same unified `tasks` table. Clicking a
metric filters the Tender Register client-side.

## Known limitations

- No Planner task assignment to a specific Microsoft user — would
  require storing each employee's Azure AD object id (not currently
  captured anywhere in this app), so new Planner tasks are created
  unassigned. FortunIQ OS's own task assignment (`employee_email`) is
  unaffected and remains the real assignment record.
- No two-way sync — see "Sync direction" above.
- The pre-existing "Won (12 mo.)" stat card's stage-string filter was
  not reconciled with the new workflow — see "Workflow stages" above.
