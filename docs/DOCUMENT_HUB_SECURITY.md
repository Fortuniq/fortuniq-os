# Document Hub Security & Manual Document Creation

## The core fix: employee-document ownership trimming

`canAccessDocumentByClassification()` in `ai-security-core.ts` now
checks TWO things, in order:

1. **Employee-document ownership** (new): if `documents.employee_id` is
   set, the document is only visible to that specific employee, HR/Admin,
   or Super Admin — regardless of classification. An Employment Contract
   classified "General" is still invisible to Marketing, Sales, or any
   other employee. This check runs BEFORE classification and overrides
   it — classification answers "who can see this kind of document,"
   ownership answers "does this document belong to someone specific,"
   and the second question, when it applies, wins.
2. **Classification + explicit authorisation** (pre-existing, unchanged):
   Public/General/Internal are visible to anyone with Documents access;
   Confidential/Highly Confidential need Super Admin or explicit
   `authorizedRoles`/`authorizedEmails`.

## Why this is a single choke point, not a patchwork of filters

Every consumer of document data — the Documents Hub listing, its
category counts, its "recent documents," the AI Assistant's document
context — goes through `getDocuments()` and then this one function
(`canAccessDocumentByClassification`, or its AI-specific wrapper
`filterDocumentsForAI`). Fixing the rule in this one place means it's
correct everywhere at once, and there's only one place to verify or
extend later — not five separate places that could drift out of sync.

**SharePoint search** (`/api/sharepoint/search`) is different: it uses
the SIGNED-IN PERSON'S OWN Microsoft delegated token, so Microsoft's own
SharePoint permissions are the real enforcement there, not this app's
code — matching the brief's "SharePoint permissions remain
authoritative" and "never use an elevated application credential."
**Important caveat, unchanged from earlier work**: the SharePoint folder
permissions themselves (e.g. locking `HR Restricted`/`Payroll Restricted`
down at the SharePoint level) still require a one-time manual step by a
site admin — creating folders via Graph doesn't automatically restrict
who can browse them directly in SharePoint. FortunIQ OS's own access
control is real and independent of that step, but it's worth doing for
full defence-in-depth.

## "Public" classification

Added as a new value alongside the existing General/Internal/
Confidential/Highly Confidential, matching the brief's exact list for
the Add Document form. Treated identically to "General" in every access
check — both are universally visible to anyone with Documents access.
Existing rows using "General" were NOT migrated; both values are
accepted going forward, avoiding a data migration for a naming change.

## "+ Add Document"

`createDocumentRecord()` creates the FortunIQ OS record, and optionally
uploads a new file or links an existing SharePoint file, in one step —
reusing the same `uploadFileToFolder()` (with its 8MB chunked-upload
ceiling) and category-folder resolution already built for the Document
Control System, rather than a separate upload path. "SharePoint Folder"
in the form is the Category selection itself — the folder is derived
from category via the existing `getCategoryFolder()` logic, not a
separate arbitrary folder picker, to avoid a second way of expressing
the same thing.

## New fields

`description` and `review_date` (migration_v22) — genuinely new.
Everything else the Add Document form needs (name, category, owner,
classification, version, status, expiry_date) already existed from
earlier migrations.

## Known limitations

- Site-wide SharePoint search doesn't filter out employee-document
  paths the way the Supabase-side catalogue now does — it relies
  entirely on the signed-in person's own SharePoint permissions, which
  requires the manual SharePoint folder-locking step above to be fully
  equivalent.
- No UI yet for bulk re-classifying existing employee documents that
  predate this fix (e.g. any Employee Hub document created before this
  migration that doesn't have `employee_id` set correctly).
