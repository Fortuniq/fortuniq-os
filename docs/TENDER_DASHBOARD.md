# Tender Dashboard UX & Executive Workflow Redesign

## Important context: this was found half-rewritten

While implementing this brief, discovery revealed that significant
prior work already existed in the codebase — `rankTenderPriority()`
(the multi-factor ranking function), `PriorityQueueWidget.tsx`, and a
`primaryFilter`/`registerHeadingLabel` state model in `tenders-view.tsx`
— all clearly built for this exact task, but never fully wired up. The
file was left in a genuinely broken state: `open` (a business summary
variable) was referenced before its own declaration (a real runtime
error), the render still called `setStageFilter()` — a variable that
no longer existed after being renamed to `primaryFilter` — and the
Workflow/Operational Alert card rows hadn't been split into the 4
sections this brief asks for. This document describes the CURRENT,
fixed, complete state — the broken intermediate state never shipped.

## Four sections, four different questions

Exactly as the brief's own design principle states — each section
answers a different management question, with no overlap:

1. **Business Summary** (`StatCard` row) — Open Tenders, Pipeline
   Value, Won (12 mo.), Bid Library. Unchanged from before.
2. **Workflow** — ONLY the 4 active stage cards (Drafting, Pricing,
   Assessment & Verification, Submission Ready). "Due This Week" and
   "Overdue Tasks," which used to live in this row, moved to Section 3
   where they actually belong.
3. **Operational Alerts** — ONLY Due Today, Due This Week, Overdue,
   Missed. Closing This Month, Submitted, Awarded, and Lost are
   deliberately NOT shown on the dashboard — still computed by
   `getTenderWorkflowCounts()` (useful elsewhere/for reporting) but not
   rendered here, exactly matching the brief's explicit "Do NOT
   include" list.
4. **Priority Queue** — replaces the old Next Deadlines widget
   entirely (that file has been deleted, not just unused).

## One filter state, not several

`primaryFilter` (a discriminated union: `{kind: "stage", stage}` or
`{kind: "dueToday" | "dueThisWeek" | "overdue" | "missed"}`) is the
SINGLE thing that drives which KPI card is highlighted, what the
Register heading says, and what rows the Register actually shows.
Clicking a highlighted card again clears it. This replaced two earlier,
separate `stageFilter`/`statusFilter` pieces of state that used to
double as both a KPI filter AND a secondary Register filter — a source
of the exact "duplicated information" and inconsistent behaviour the
brief asks to eliminate. Secondary refinement filters (Created By,
Assigned To, Priority, Status) remain separate and compose on top of
whichever primary filter is active.

## Dynamic Register heading

`registerHeadingLabel` renders "Tender Register / Showing / {label}"
exactly matching the brief's examples ("Pricing (4)", "Due Today (1)",
"Missed (10)", "All Open Tenders (15)") — computed from the same
`primaryFilter` state and the actual filtered row count, so the heading
can never drift out of sync with what's really being shown.

## Priority Queue ranking — what "AI Risk Assessment" actually is

`rankTenderPriority()` (`tender-core.ts`) combines: Closing Date (the
biggest factor), whether the current stage's assignment is overdue,
compliance completeness (this app's real proxy for "missing compliance
documents" — see below), and the assignment's own stated Priority.

**"AI Risk Assessment" is deliberately NOT implemented as a real
per-tender LLM call.** This app has an extensive AI security framework
(classification-based document access, audit logging of every AI
interaction) that a genuine "call Claude to assess this tender's risk"
feature would need to properly integrate with — new cost tracking, a
new AI-security-reviewed data-access path, and a real prompt design.
That's a meaningfully sized feature on its own, not a line item to
slip into a dashboard redesign. The ranking function's structure
(`score += ...`, additive) is deliberately left open for a real
AI-derived term to be added later without restructuring the whole
function — but nothing here fabricates an AI opinion in the meantime.

**"Missing Compliance Documents"** uses `compliancePct` (checklist
completeness) as the concrete signal — this app doesn't track
individual named "missing document" flags separately from the
checklist itself, so checklist completeness is the honest proxy.

This is a genuine multi-factor ranking, not a closing-date sort — the
brief's own test case (a tender due later but overdue/at-risk should
outrank a healthy one due sooner) is exactly what's tested in
`tender-core.test.ts`.

## Priority Queue display fields

All 6 fields from the brief's section 5: Priority Indicator (🔴/🟠/🟢 +
level), Tender Name, Days Remaining, Assigned To, Current Stage
(added — this was missing from the initial widget build and is now
included), and Outstanding Issue — via the new `deriveOutstandingIssue()`
function, which correctly produces "Waiting for {stage}" for an overdue
stage assignment (previously the widget only ever showed "Missing X" or
"Assessment Complete," never the "Waiting for" case at all).

## Sticky Tender AND sticky Actions columns

`StickyScrollDataTable` gained an opt-in `stickyLast` prop — the Tender
Register is the only current user of it, passing `stickyLast`, so both
identity (left) and row actions (right) stay reachable during
horizontal scroll. The Register's previously-separate "workspace" (a
folder-open icon) and "actions" (edit/delete) columns were merged into
one combined, properly-labelled "Actions" column — having two separate
trailing icon-only columns would have meant either two sticky columns
on the right (visually awkward) or stickying only one of them
(inconsistent), so consolidating them was the correct fix, not just a
convenience.

## Known limitations

- **The "Overdue" KPI count and the "Overdue" filter use slightly
  different underlying data.** The displayed count
  (`workflowCounts.overdueTasks`) comes from the general `tasks` table
  (module_key='tenders') org-wide; clicking the card filters using
  `overdueTenderIds`, derived from `teamAssignments` (already scoped to
  what the viewer is allowed to see — the full org for Admin/
  Management/HR, a manager's own reports otherwise). For a Super Admin
  these are the same set; for a Manager, the displayed count may be
  organisation-wide while the filter only shows tenders within their
  own visibility. Unifying these into one consistent computation would
  be a worthwhile follow-up.
- **Priority Queue's "Outstanding Issue" doesn't yet have real
  per-tender checklist data on the Register page** — the checklist prop
  currently fetched there is for a single tender (the sidebar
  "Submission Checklist" card), not the whole register. The widget
  falls back to a compliance-percentage-based generic message
  ("compliance items") rather than a named item until per-tender
  checklist data is fetched for the whole list.
