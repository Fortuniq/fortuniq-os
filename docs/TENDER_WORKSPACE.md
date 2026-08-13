# Tender Document Workspace

Phase 1 of turning every tender into its own dedicated, SharePoint-backed
document workspace — automated folder creation, an in-app document
browser, and a real Submissions tab. This document covers what's built,
verified, and what's genuinely still ahead.

## What's built and verified in Phase 1

**Automatic SharePoint folder creation.** When a tender is created,
FortunIQ OS creates (or finds, if one already exists) a dedicated folder
at `Tenders/{ref} - {title}` — e.g. `Tenders/GDOH-2026-114 - Bulk Diesel
Supply`, with five standard subfolders inside it: Tender Documents (RFT),
Compliance Documents, Pricing Schedules, Submission Pack, and
Correspondence. This uses the **signed-in Tender Administrator's own
Microsoft permissions** — the folder is created "as" them, not through a
shared app identity, consistent with how every other SharePoint
interaction in this app works. See `ensureTenderFolder()` in
`src/lib/graph.ts`.

**Folder creation never blocks tender creation.** If SharePoint isn't
connected, or this specific call fails for any reason, the tender record
is still created — a missing document workspace is logged, never a
reason to fail the whole action. If it does fail, a **"Create SharePoint
Folder"** retry button appears on the tender's Documents tab.

**A dedicated document workspace per tender**, at `/tenders/[id]`, with
four tabs in this order: **Overview, Compliance, Documents, Submissions**.

**The Documents tab** shows that specific tender's SharePoint folder
contents in-app via Microsoft Graph — never the general document
library — plus an **"Open in SharePoint"** button that goes straight to
that tender's specific folder, not the SharePoint site root. Real-time
access is enforced by the signed-in person's own Graph token — if they
don't have SharePoint permission to a tender's folder, Microsoft itself
refuses the request, regardless of what FortunIQ OS's own records say.

**The Tender Register** has a folder icon next to Edit on every row,
opening that tender's dedicated workspace directly.

**The Submissions tab** records Submission Method (Online or Hand
Delivery) and Submission Date/Time, per tender.

**A real, per-tender checklist** — not the old single shared example.
Every tender has its own checklist, linked by `tender_id`, with add,
toggle, and delete all working and audit-logged. This persists regardless
of the tender's status (Open, Awarded, Lost, Archived) — nothing about
checklist storage is tied to a tender being in any particular state.

## Honestly, what's not built yet

Per your original request's own sequencing, this was explicitly Phase 1
(folders + Submissions tab). Still ahead, in the order you originally laid
out:

- **Automatic compliance percentage** calculated from confirmed checklist
  items, replacing the manually-entered number. The Compliance tab
  currently shows both side by side (confirmed count and the manual
  percentage) specifically so the gap is visible, not hidden.
- **AI-generated checklists** — FortunIQ Intelligence analysing a
  tender's uploaded documents and proposing the checklist, with the
  Tender Administrator confirming each item — the AI would never
  auto-confirm anything itself, per your explicit requirement.
- **Full audit logging for document actions** — uploads, removals,
  version changes, and access specifically. Checklist changes (toggle,
  add, delete) and folder creation are already audit-logged today;
  logging the SharePoint file-level actions themselves (which happen
  inside SharePoint's own UI, outside FortunIQ OS's direct control once
  someone clicks "Open in SharePoint") is the more involved remaining
  piece — likely requiring Microsoft Graph's delta/webhook capabilities
  to know when a file actually changes.

## Security

- Every Graph API call in this feature uses the **signed-in person's own
  delegated token** — folder creation, file listing, and folder access
  all fail or succeed based on that specific person's real Microsoft
  permissions, never a shared credential.
- Tender Create/Edit/Delete, and everything on the Compliance and
  Submissions tabs, are gated by the real, granular RBAC system (see
  `docs/RBAC.md`) — someone with Tenders View-only access sees the
  workspace but can't check off requirements or add documents.
- Checklist changes, tender creation, and folder creation are all written
  to the audit log (`src/lib/audit.ts`) — visible at Audit Logs to Super
  Admin and HR/Admin.

## Testing

The folder-naming and path-construction helpers (`sanitiseFolderName`,
`ensureFolder`) are exercised as part of the wider Graph integration and
were manually verified end-to-end via screenshots across all four tabs.
Given these functions make real Microsoft Graph API calls, they aren't
practical to unit test in isolation the way the pure `*-core.ts` modules
elsewhere in this app are — real verification here means testing against
a real, connected SharePoint site, which is what the manual checklist
below is for.

## Manual verification checklist

1. **Create a new tender** with a real reference number and title. Check
   Supabase's `tenders` table — `sharepoint_folder_id` and
   `sharepoint_folder_url` should both be populated.
2. **Check SharePoint directly** — a `Tenders/{ref} - {title}` folder
   should exist, with the five standard subfolders inside it.
3. **Click the folder icon** next to that tender in the Tender Register —
   it should open `/tenders/{id}`, landing on the Overview tab.
4. **Click through Documents** — click "Load Documents" and confirm the
   five subfolders appear. Click "Open in SharePoint" and confirm it
   opens that tender's specific folder, not the site root.
5. **Click Submissions**, set a method and date/time, save, reload the
   page, and confirm it persisted.
6. **Click Compliance**, tick a few items, add a new custom requirement,
   and confirm the "X of Y confirmed" count updates immediately.
7. **Sign in as someone with Tenders View-only** access (or temporarily
   set that via System Access & Permissions) and confirm they can see all
   four tabs, but can't tick checklist items, add documents, or save
   Submissions info.
