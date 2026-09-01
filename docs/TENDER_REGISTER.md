# Tender Register Usability, Ownership & Activity

## Sticky column + floating scrollbar — a separate component, deliberately

`StickyScrollDataTable.tsx` is a NEW component, not a modification to
the shared `DataTable.tsx` used across many other pages in this app
(Documents, Attendance, etc.). Sticky-column/floating-scrollbar
behaviour is opt-in, only where a table genuinely needs it at scale —
forcing it onto every table in the app would be unwanted visual
complexity elsewhere.

- **Sticky column**: the table's FIRST column (whatever it is) gets
  `position: sticky; left: 0` with a solid background and a right-edge
  shadow divider, on both header and body cells. For the Tender
  Register specifically, that first column is already "Tender" (title +
  reference), so no reordering was needed.
- **Floating scrollbar**: a second, thin `overflow-x-auto` element
  below the table, `position: sticky; bottom: 0`, whose inner content
  is sized to match the table's real `scrollWidth`. Scroll position is
  synced bidirectionally between it and the real table via `scrollLeft`
  read/write in each other's `onScroll` handlers, with a guard flag to
  prevent an infinite feedback loop between the two. Hidden entirely
  when `scrollWidth <= clientWidth` (no overflow) or when the table
  itself isn't in the viewport (`IntersectionObserver`) — both
  conditions the brief asks for explicitly.
- Because the wrapping container is only as tall as the table itself,
  `position: sticky` naturally behaves correctly for a genuinely long
  (100+ row) register: it stays pinned to the viewport bottom while
  scrolling through the table, and scrolls away normally once the
  table's actual bottom edge comes into view — no `position: fixed` or
  manual pixel math needed.

## Created By / Created On — captured once, immutable

`tenders.created_by_name`/`created_by_email` are set exactly once, in
`addTender()`, from the signed-in person's own session — there is no
edit path for these fields anywhere in the app. `created_at` already
existed. Tenders created before this migration will show `—` for
Created By; there's no way to retroactively know who created them.

## Why "Assigned To" is denormalised

The real source of truth for stage ownership is
`tender_stage_assignments` (from `docs/TENDER_ASSIGNMENT.md`). For the
Register specifically — which the brief says may hold 100+ rows —
joining that table per row on every list load is worse than keeping a
read-optimised copy. `tenders.assigned_to_name`/`assigned_to_email`
(and `current_priority`, for the Priority filter/sort) are updated in
the exact same transaction as the real assignment, inside
`moveTenderStage()` and `reassignTenderStage()` — "The value should
automatically update whenever the current tender workflow assignment
changes" is satisfied by construction, not by a background sync job.

## Last Activity — what actually updates it, and what doesn't

`recordTenderActivity()` (`tender-activity.ts`) is called from every
mutation point the brief lists as meaningful: tender creation, stage
changes, assignment/reassignment, checklist add/toggle/delete, AI
checklist generation, submission info updates, and tender
value/due-date/status(Awarded/Lost) changes — each with a specific,
readable description ("Pricing updated" style), not a generic "Tender
modified" for the cases the brief calls out by name.

**Never called from a read/view action** — opening or viewing a tender
does not touch `last_activity_at`, exactly as instructed.

**Known gap**: document upload/replace isn't wired into tender
activity in this pass. Documents aren't currently linked to tenders via
a direct foreign key (only indirectly, through a task's `record_id`),
so "Document uploaded"/"Document replaced" as tender activity would
need that link established first — a documented follow-up, not
attempted here to avoid a half-correct implementation.

## Stale Tender indicator

`isTenderStale()` in `tender-core.ts`: only ever true for a tender that
is still `status = 'Open'` — Awarded and Lost tenders are never flagged,
per the brief. The threshold (`STALE_TENDER_THRESHOLD_DAYS`, currently
5) lives as a single named constant rather than a fabricated settings
UI — the brief calls the period "configurable," and this is the one
place that configuration would plug into once a real settings screen
exists.

## Filtering & sorting

Implemented client-side over the already-fetched tender list (Created
By, Assigned To, Status, Priority filters; sort by Closing Date,
Created On, Last Activity, Tender Value, Created By, Assigned To,
Status, or Stage, either direction) — a toolbar above the register
rather than clickable column headers, since the shared `Column<T>` type
(used by both `DataTable` and `StickyScrollDataTable`) only supports a
plain string `header`, and widening that type would ripple into every
other table using it for no benefit outside this one page.

## Workflow Summary & Assignment History — names, not emails

Section 8's Workflow Summary card (`WorkflowSummaryCard.tsx`, on the
tender detail page) shows Created On/By, Current Stage, Assigned
To/On, Due Date, Priority, Status, and Last Activity together, exactly
as specified.

Section 9 required a real fix, not just a display tweak:
`tender_stage_assignment_history` (from `docs/TENDER_ASSIGNMENT.md`)
only ever captured owner EMAILS, not names — showing a name-first UI
would have meant fabricating one. Added `previous_owner_name`/
`new_owner_name` columns (this migration, not editing the original
`migration_v24` in place, since that one may already be deployed), and
both `moveTenderStage()`/`reassignTenderStage()` now write the real
employee name they already look up at that point, alongside the email.
`AssignmentHistoryCard.tsx` now shows the name as the primary value,
falling back to email only for history rows written before this change
existed.

## Known limitations

- Document upload/replace not yet linked to Last Activity — see above.
- Stale threshold is a single constant, not a per-org configurable
  setting yet.
- Sorting/filtering is client-side over the full fetched list — fine at
  "hundreds of tenders" per the brief's own stated scale, but would need
  to move server-side (pagination + query-level filtering) well beyond
  that.
- Mobile horizontal swipe relies on the browser's native touch-scroll
  behaviour on the `overflow-x-auto` table wrapper — not a custom touch
  handler — which is standard and reliable, but wasn't independently
  tested on a physical device in this pass.
