# Automatic Tender Deadline Management

## How the automatic transition actually happens

This app has no cron/scheduled-job infrastructure — the same
constraint already documented for overdue stage escalation
(`docs/TENDER_ASSIGNMENT.md`) and dashboard reminders
(`docs/HCM_PHASE3.md`). "Automatically" therefore means:

1. **Display is always correct, instantly.** `computeEffectiveTenderStatus()`/
   `computeEffectiveTenderStage()` (pure functions, `tender-core.ts`) are
   used everywhere a tender's status/stage is shown — the Register, the
   detail page header, Overview, Workflow Summary. These are derived
   fresh from the closing date on every render, so the UI shows "Missed"
   the moment it's true, with zero lag, regardless of database state.
2. **The database catches up lazily.** `applyMissedStatusIfNeeded()`
   (`tender-deadlines.ts`) runs the next time a tender is actually read
   — the Register loads, or a tender's detail page loads — and performs
   the real write (status, stage, `missed_at`) plus an audit log entry
   and a workflow history entry, exactly once, idempotently. It
   re-checks against the live database row immediately before writing,
   closing the small race window where two people load the same overdue
   tender at once.

Given how this app is actually used — people checking the Tender
Register regularly, not leaving it unopened for weeks — the gap between
"deadline passes" and "database write lands" is realistically minutes
to hours, not days. It is a real gap, worth being honest about. A true
"the instant midnight passes" transition would need a real scheduled
function (e.g. a Netlify Scheduled Function) — a documented follow-up,
not implemented here.

## Missed status — exactly the brief's own rule, tested

`shouldAutoMarkMissed()`: closing date passed, AND not Awarded, AND not
Lost, AND not already Missed (idempotent), AND not Submitted (checked
via `stage === "Submitted"`, since that's this app's own signal for "a
submission actually happened," distinct from the tender's outcome
status). Every one of these conditions has a dedicated test.

## Read-only unless reopened

A Missed tender's stage-move/reassign controls are hidden in
`TenderWorkflowControl.tsx` — not just visually disabled, entirely
absent from the DOM, with a clear banner explaining why. `reopenMissedTender()`
requires Approve-level permission (a higher bar than ordinary Edit,
matching how significant overriding an automatic classification is),
resets status to Open and stage to Drafting, clears `missed_at`, and
writes both an audit entry and a workflow history entry — the same
two-record pattern used for the automatic Missed transition itself, so
reopening is exactly as traceable as the original classification.

## Closing Soon / Due Today — warnings, not status changes

`isClosingSoon()`/`isDueToday()` never touch `tenders.status` — exactly
as the brief specifies ("This should not change the Tender Status").
They're purely display indicators, computed the same way everywhere
they appear (Register Closing column, Next Deadlines widget).

## Next Deadlines widget

Replaces the (non-existent, this was purely additive) old static "Next
Deadline" card. Excludes Awarded/Lost/Submitted/Missed/Archived exactly
per the brief, sorted nearest-first. Each entry is a real link to the
tender's own page — "Clicking it should open the tender, display its
workflow, display its checklist" is satisfied by linking to the same
tender detail page every other entry point in this app already uses,
which already shows the Workflow Summary and checklist together — no
separate "highlight the record" mechanism was built beyond navigating
directly to that tender.

## Configurable warning period

Uses the existing `app_settings` key-value table (created in
`migration_v23_tender_planner.sql` for the Planner plan cache,
otherwise unused) rather than a new column or dedicated settings page —
`getClosingSoonWarningDays()`/`setClosingSoonWarningDays()` in
`tender-deadlines.ts`, with a compact inline Super-Admin-only control on
the Tender Register itself (`ClosingSoonSettingsCard`) rather than a
separate Settings page, since this is the only setting of its kind so
far.

## Dashboard counters

`getTenderWorkflowCounts()` extended with Due Today, Closing This
Week/Month, Missed, Submitted, Awarded, Lost — computed from the same
live data every other display uses, clickable to filter the Register
the same way the existing workflow-stage counters already work.

## Workflow Summary

Extended with Closing Date, Days Remaining (showing "⚠ Overdue by X
Days" in red when applicable, matching the brief's exact wording), and
the live effective Current Stage/Status. The pre-existing Assigned On /
Stage Due Date fields (from `docs/TENDER_REGISTER.md`'s Workflow
Summary work) were kept, not dropped, even though this brief's own list
in section 11 doesn't re-list them — they're a different, still-useful
concept (when the ASSIGNED PERSON should finish their part of the
current stage) from the tender's overall Closing Date.

## Known limitations

- **No live background job** — see "How the automatic transition
  actually happens" above. The realistic lag is minutes to hours, not
  days, given normal usage patterns, but it is not instantaneous.
- **Deadline alerts** (section 9: notify the assigned employee at 7
  days/3 days/tomorrow/due today/missed) are **not implemented in this
  pass**. The infrastructure to do this (My Tasks, the notifications
  table) already exists and is used elsewhere in this app, but wiring
  automatic, time-based reminders at specific day-thresholds would
  itself need the same scheduled-job infrastructure this whole feature
  works around — attempting it via lazy on-read triggers would mean
  either firing duplicate reminders on every page load or building
  separate "have I already sent the 7-day reminder" tracking, which
  felt like a half-solution not worth shipping incompletely. A proper
  implementation belongs together with the scheduled-function follow-up
  noted above. Teams/Outlook/Email notifications are explicitly listed
  in the brief itself as "(future versions)" — not attempted.
- **Sorting by Status in the Register** (from `docs/TENDER_REGISTER.md`)
  still sorts by the RAW stored status, not the live effective one — a
  tender that's about to display as "Missed" sorts by its old stored
  status until the lazy write catches up. A minor, temporary
  inconsistency in the same spirit as the display/write lag above.
