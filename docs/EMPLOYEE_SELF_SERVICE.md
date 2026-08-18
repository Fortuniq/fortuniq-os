# Employee Self-Service: My Profile & Document Acknowledgement

## What this is

Employee Hub Phase 2: a "My Profile" self-service page for every
employee, sitting alongside (not replacing) the existing HR/Super Admin
Employee Profile console. Both read from the exact same `employees` and
`documents` rows — My Profile just shows a different, narrower slice,
enforced server-side.

## Reused, not rebuilt

This deliberately builds on three things already in the codebase rather
than creating parallel systems:

- **`documents.employee_id`** (from `migration_v8_employee_hub.sql`) —
  already links a document to a specific employee's personnel file.
- **The Document Control System** (`migration_v18`, `document-actions.ts`,
  `document_versions`) — the version control, archiving, and SharePoint
  upload/move engine. Employee documents use the exact same
  `replaceDocumentVersion()`, `restoreDocumentVersion()`, and
  `DocumentLinkModal`/`VersionHistoryModal` UI components as the general
  Documents Hub — see "Folder resolution" below for the one place that
  needed a genuine change to support this reuse correctly.
- **The My Tasks system** (`createTaskForEmployee()`) — acknowledgement
  reminders are ordinary tasks, not a separate notification system.

## My Profile — security boundary

`/profile` has no `[id]` URL segment at all. The page always looks up
the SIGNED-IN person's own `employees` row by their session email
(`getEmployeeByEmail(permissions.email)`) — there is no code path where
a document ID, employee ID, or any other identifier from the URL or
client determines whose data loads.

`canSeeInEmploymentFile()` (`employee-hub-core.ts`) is the second layer:
even if a document row is somehow reachable, it only appears in My
Employment File when `viewerEmployeeId === documentOwnerEmployeeId` AND
`visibility === "Employee Visible"` AND the document is in a finalised
state (`Approved`/`Published`).

## Document visibility (new, additive to classification)

`documents.visibility` is a NEW column, separate from the existing
General/Internal/Confidential/Highly Confidential classification system
(`migration_v7`). The two answer different questions:

- **Classification** — who can see this document at all, anywhere in
  FortunIQ OS.
- **Visibility** — specifically, does this document appear in the
  OWNING EMPLOYEE'S OWN My Employment File.

Defaults to the most restrictive (`HR Restricted`) — a document only
reaches My Employment File once someone explicitly marks it `Employee
Visible`, never by omission.

## SharePoint structure

```
FortunIQ Documents/
  Employees/
    EMP-0010 - Nthabiseng Ramabetha/
      Employment Contract.pdf       (core documents live directly here)
      Employee Handbook.pdf
      NDA.pdf
      Performance/
      Skills & Certifications/
      HR Restricted/
      Payroll Restricted/
      Archive/
```

Created automatically the moment HR adds a new employee
(`addEmployee()` -> `ensureEmployeeFolder()`), best-effort.

### Folder resolution — a real bug caught during review

The Document Control System's `getCategoryFolder()` only knows about
the general Documents Hub's 14 categories. Employee document categories
("Employment Contract", "NDA", "Performance Review") aren't in that
list. Reusing `DocumentLinkModal`/`replaceDocumentVersion()` unmodified
for employee documents would have silently fallen back to uploading
into the general `Policies` folder instead of the employee's own
folder. Fixed with `resolveTargetFolder()`/`resolveArchiveFolder()` in
`document-actions.ts`: if a document has `employee_id` set, they
resolve to that employee's own root/subfolder instead of the general
category folder — applied uniformly across every call site.

## Version control

Employee documents are ordinary `documents` rows, using the same
`document_versions` archiving/versioning as the general Documents Hub.
One difference: documents HR uploads directly into a personnel file go
straight to `Published` status, skipping the general approval pipeline
— HR uploading a signed contract IS the approval.

## Document Acknowledgement — version-specific, permanent

`document_acknowledgements` only ever stores COMPLETED acknowledgements.
"Pending" is computed, not stored — a document is Pending for an
employee simply because no `Acknowledged` row exists yet for
`(document_id, current_version_number, employee_id)`.

Version-specific by construction: the unique constraint is
`(document_id, version_number, employee_id)`. When HR replaces a
document, the OLD acknowledgement row stays permanently, while the
employee becomes "Pending" again for the new version automatically —
no explicit "reset" step needed, it falls out of the schema design.

`acknowledgeDocumentAction()` records `ip_address`/`device_info` (both
optional per the brief) and is idempotent.

## Compliance Status

`compliance-status-core.ts` is entirely data-driven: standing checks
(emergency contact, equipment) plus one entry per acknowledgement-
required document, whatever HR has configured — nothing hard-coded.
"Skills & Certifications Outstanding" matches the brief's own "(if
applicable)" phrasing exactly: it only appears on the checklist at all
when the employee has zero skills and zero certifications on file —
once either exists, the line disappears entirely rather than sitting
there permanently green.

## HR Document Acknowledgements widget

`DocumentAcknowledgementsWidget.tsx` on the Employee Hub landing page,
HR/Super Admin only. Filter/search/CSV export/Send Reminder — reminders
create a My Tasks item via the existing unified task layer, satisfying
the "dashboard notification" requirement for free.

## Known limitations

- **Manager visibility** (`canManagerViewByVisibility()`) is built and
  tested but not yet wired into a dedicated manager-facing screen — the
  brief marks this "optional."
- **Email/Teams reminders** — explicitly deferred per the brief; the
  in-app task-based reminder is what's built now.
- **RLS**: `migration_v20_rls_hardening.sql` adds real, identity-scoped
  policies (keyed on `auth.jwt() ->> 'email'`) for `employees`,
  `documents` (employee-linked rows only), and `document_
  acknowledgements`. They're correct but currently DORMANT: this app
  authenticates via NextAuth + Microsoft Entra ID, not Supabase Auth, so
  every database call today goes through the service-role key, which
  bypasses RLS by design — the same reason every other table in this app
  uses a deny-all placeholder. Real enforcement for "employees only see
  their own data" lives in application code (`getEmployeeByEmail()`,
  `canSeeInEmploymentFile()`) today. The policies are in place, ready to
  activate the moment any code path queries Supabase with a user-context
  client carrying an email claim.
