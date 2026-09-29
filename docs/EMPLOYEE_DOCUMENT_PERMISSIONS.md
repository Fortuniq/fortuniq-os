# Employee Document Centre Permissions

Fixes: HR/Admin unable to upload or manage employee documents in
**Employee Hub → Employee Profile → Document Centre**, while Super Admin
could. Super Admin still has full access; HR/Admin was NOT given Super
Admin rights anywhere else in FortunIQ OS.

## Root cause

Every mutation behind the Document Centre — upload, change visibility/
classification, send an acknowledgement reminder — was gated by a
hardcoded, coarse comparison:

```ts
if (!permissions.isAdmin && permissions.role !== "HR/Admin") {
  return { error: "..." };
}
```

This bypassed FortunIQ OS's own granular RBAC system entirely
(`src/lib/rbac.ts` / `rbac-core.ts`, already used everywhere else in the
app — Tenders, Finance, the general Documents Hub). A role-name string
comparison like this is exactly the "checking only role names" pattern
the app's own granular RBAC was built to replace, and it also meant
access could never be independently granted to (or withheld from)
someone whose role wasn't the literal string `"HR/Admin"`.

On top of that, some of the **shared** document actions used by the
Document Centre — replacing a version, linking/relinking a file, removing
a link, restoring a version (all in `src/app/(app)/documents/document-actions.ts`,
reused via `DocumentLinkModal`) — were gated on the general **"documents"**
RBAC module, not on anything employee-document-specific. Since several
roles (Management, Finance) get "documents" Edit access by default for
the general FortunIQ Documents Hub, this meant, in principle, a Manager
or Finance user could replace or remove a link on **any employee's**
personnel-file document, while HR/Admin's own access to that same action
depended on the separate, broken role-name check above. Both problems are
fixed together here.

## Fix: a new, independent RBAC module — `employee-documents`

Added to `src/lib/permissions-core.ts` (`ModuleKey`) and
`src/lib/rbac-core.ts` (`RbacModuleKey`), exactly the same pattern already
used this project for "attendance" and "market-news" — a first-class
module in the existing granular RBAC system, not a second permission
system.

**Deliberately separate from `people`** (the general Employee Hub
module): someone can have `people` access (directory, profile fields)
without employee-document rights, and vice versa. An admin can grant
`employee-documents` to anyone via **System Access & Permissions** on
that person's profile — it shows up there automatically, since that
screen already iterates `ALL_RBAC_MODULES`.

| Role (coarse, module-level) | `employee-documents` by default? |
|---|---|
| Super Admin | Yes (always — every module) |
| HR/Admin | **Yes** (this fix) |
| Management | No — must be explicitly granted |
| Finance | No — must be explicitly granted |
| Sales/Marketing | No |
| Employee | No (employees see their own file via a separate, unrelated path — see below) |

Granular actions (`View` / `Create` / `Edit` / `Delete` / `Approve` /
`Export` / `Manage`, same enum as every other RBAC module) map onto the
brief's requested verbs like this:

| Brief's verb | `PermissionAction` used |
|---|---|
| `employee_documents.view` | `View` |
| `employee_documents.upload` (first version) | `Create` |
| `employee_documents.edit` / replace-version / relink / remove-link / restore-version | `Edit` |
| `employee_documents.manage_classification` | `Manage` |
| `employee_documents.manage_acknowledgements` (toggle "Acknowledgement Required") | `Manage` |
| `employee_documents.archive` | covered by `Manage` (its own dedicated archive action doesn't exist yet — versions already move to Archive automatically on replace, see below) |

`Manage` is a superset (existing `hasPermissionAction()` behaviour) — HR
Manager's/Administrator's `Manage` grant covers every action above
automatically, so nothing further is needed for full HR access.

**Rollout is safe by construction**: this module uses the same
already-existing "not yet configured → fall back to the coarse module
gate" behaviour as every other RBAC module (`src/lib/rbac.ts`). Nobody is
newly locked out — HR/Admin gets the coarse `employee-documents` module
grant (below) and, having never had per-person granular entries
configured for it, passes every action by default until an admin
explicitly customises it for a specific person in System Access &
Permissions.

## Migration: `migration_v35_employee_document_permissions.sql`

`ROLE_DEFAULT_MODULES` in code is only the *starting point* copied onto
brand-new user records — it does not retroactively touch existing rows.
This migration backfills the new `employee-documents` key into
`allowed_modules` for every existing `user_permissions` row with
`role = 'HR/Admin'`. Super Admin needs no backfill (computed dynamically,
always every module). Idempotent — safe to run more than once.

## What changed, file by file

- **`src/lib/permissions-core.ts`** — added `"employee-documents"` to
  `ModuleKey` / `ALL_MODULES`, and to `HR/Admin`'s
  `ROLE_DEFAULT_MODULES` entry only.
- **`src/lib/rbac-core.ts`** — added `"employee-documents"` to
  `RbacModuleKey` / `ALL_RBAC_MODULES`; granted `Manage` (full) to the
  "HR Manager" and "Administrator" role templates. CEO already gets
  `Manage` on every module automatically.
- **`src/app/(app)/people/employee-actions.ts`** — replaced the three
  `permissions.role !== "HR/Admin"` checks
  (`setEmployeeDocumentVisibility`, `sendAcknowledgementReminder`,
  `uploadEmployeeDocument`) with real `checkPermissionAction(permissions,
  "employee-documents", <action>)` calls via a new
  `requireEmployeeDocumentAction()` helper. The two unrelated HCM checks
  in this file (`updateIdentity`, `updateEmploymentExtra` — Identity and
  Employment-extra fields, not documents) were deliberately left
  untouched, per "smallest safe change necessary."
- **`src/app/(app)/documents/document-actions.ts`** — added
  `requireDocumentMutationAccess()`: for any document with `employee_id`
  set, `linkDocumentToFile` / `uploadAndLinkDocument` /
  `replaceDocumentVersion` / `removeDocumentLink` / `restoreDocumentVersion`
  now check the `employee-documents` module instead of the general
  `documents` module. `getDocumentVersionsAction` (view history) does the
  same, closing the gap where anyone with ordinary Documents Hub access
  could read another employee's document version history.
- **`src/lib/employee-documents.ts`** — `getEmployeeDocuments()` (the
  HR-side Document Centre list) now filters by classification via the
  already-existing (but previously unused) `canManagerViewByVisibility()`
  from `employee-hub-core.ts`, given the viewer and whether they're this
  employee's direct manager. Previously it returned every document
  regardless of visibility to anyone who could open the profile page at
  all (e.g. a Manager viewing a direct report would see "HR Restricted"
  and "Finance Restricted" documents too) — this was a real gap against
  the brief's classification rules (section 4/5/10).
- **`src/app/(app)/people/[id]/page.tsx`** — computes
  `canViewEmployeeDocuments` / `canUploadEmployeeDocuments` via
  `checkPermissionAction(..., "employee-documents", ...)` and passes
  `isManagerOfThisEmployee` into `getEmployeeDocuments()`.
- **`src/app/(app)/people/[id]/employee-profile-view.tsx`** and
  **`EmployeeDocumentCentre.tsx`** — the Document Centre card now renders
  for `isHR` **or** granular `canViewDocuments`; the "+ Upload Document"
  button specifically checks `isHR` **or** granular
  `canUploadDocuments`, and is hidden entirely (not just disabled) when
  absent — matching the brief's "hidden/disabled for employees without
  employee-document management permission." This is defence-in-depth on
  top of the server-side checks above, never the only gate.
- **`supabase/migration_v35_employee_document_permissions.sql`** — see
  above.
- Tests: `src/lib/permissions.test.ts` and `src/lib/rbac-core.test.ts`
  gained regression coverage for the new module's default grants.

## Unaffected by design (verified, not changed)

- **Employee-specific SharePoint storage** — already correctly isolated
  per employee (`getEmployeeRootFolder`/`getEmployeeSubfolder` in
  `graph.ts`), never the general Documents Hub folder tree. Untouched.
- **Employee's own "My Employment File" view**
  (`getMyEmploymentFile`/`canSeeInEmploymentFile` in
  `employee-hub-core.ts`) — already correctly restricted to
  "Employee Visible" + Published/Approved documents belonging to that
  exact employee. Untouched.
- **Version control** — `document-versions.ts`'s
  `recordNewVersion`/`archivePreviousVersion`/`restoreVersion` already
  never overwrite or destroy history; every version row retains uploader,
  upload date, and archived date. Untouched, just re-gated (above).
- **Acknowledgement workflow** —
  `document_acknowledgements`, matched by `(document_id, version_number)`
  so a prior acknowledgement never silently counts for a new version.
  Untouched.
- **Audit trail** — `document_uploaded`, `document_status_changed`,
  `document_replaced` etc. already record actor, target document,
  before/after classification and timestamps (`src/lib/audit.ts`). Added
  `employeeId` and `version` to a couple of metadata payloads
  (`_linkDocumentToFile`, `replaceDocumentVersion`) for easier auditing
  of which employee record was affected, per the brief's exact examples.

## Test coverage

Automated (this sandbox has no live Supabase/SharePoint/Microsoft
session, so these are unit/logic tests on the actual permission
functions, the same approach already used throughout this app for RBAC —
see `permissions.test.ts`, `rbac-core.test.ts`, `employee-hub-core.test.ts`):

- Super Admin and HR/Admin have `employee-documents` by default;
  Management/Finance/Sales/Marketing/Employee do not (`permissions.test.ts`).
- "HR Manager" and "Administrator" role templates get `Manage` on
  `employee-documents`; "Tender Administrator"/"Marketing" templates do
  not (`rbac-core.test.ts`).
- `canManagerViewByVisibility()` (now wired into `getEmployeeDocuments()`)
  already has full coverage in `employee-hub-core.test.ts` — HR/Admin
  sees "HR Restricted" but not "Super Admin Only"; Finance sees "Finance
  Restricted"; a non-manager colleague sees nothing at "Manager Visible"
  or above.

Manually verified via code inspection (server-side enforcement, not just
UI) for the brief's 11-point checklist:

- **Super Admin**: bypasses every RBAC check (`permissions.isAdmin`) —
  PASS.
- **HR/Admin**: `employee-documents` in default `allowed_modules` (post-
  migration) + no granular per-person override configured →
  `checkPermissionAction` falls back to allow on every action — PASS.
- **Normal Employee**: role default has no `employee-documents` entry, so
  `hasModuleAccess` denies at the coarse gate before any granular check
  even runs — cannot upload/manage. Their own document view goes through
  the separate, already-correct `getMyEmploymentFile`/
  `canSeeInEmploymentFile` path — PASS.
- **Manager**: no `employee-documents` by default; `getEmployeeDocuments`
  now filters by `canManagerViewByVisibility`, so even if granted `people`
  View for a direct report, "HR Restricted"/"Finance Restricted"/"Super
  Admin Only" documents are filtered out server-side — PASS.
- **Employee A vs Employee B**: `getMyEmploymentFile` filters strictly by
  `viewerEmployeeId === documentOwnerEmployeeId` — unchanged, already
  correct — PASS.
- **10-step HR workflow** (open employee → upload → classify → save →
  reopen → new version → see old version in history → enable
  acknowledgement → employee sees only the released document): every step
  now passes through the corrected granular checks above rather than the
  broken role-name comparison, and none of the underlying
  upload/version/acknowledgement mechanics were altered — reasoned through
  step-by-step against the code, consistent with how the rest of this
  app's RBAC has been verified all session (no live deployment available
  in this sandbox).
