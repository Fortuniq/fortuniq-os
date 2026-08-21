# Enterprise Document Control System

## What this is

The Documents Hub is now a full document control system: every document
record can be linked to a physical file in SharePoint, replacing a file
automatically archives the superseded version, documents move through a
5-state approval lifecycle, and every meaningful action is audited.
SharePoint remains the actual file repository — FortunIQ OS is the
control layer on top of it, per the brief's stated final objective.

## SharePoint folder structure

A single library, created automatically (idempotently — safe to call on
every "Attach Document" action) the first time anyone links a document:

```
FortunIQ Documents/
  Policies/
  SOPs/
  Legal/
  Brand/
  Certificates/
  Licences/
  Tax/
  Insurance/
  Company Profile/
  Marketing/
  Finance/
  Operations/
  HR/
  Templates/
  Archive/
    Policies/
    SOPs/
    ... (one subfolder per category, mirrored)
```

New/current versions are filed in the live category folder. Superseded
versions are moved into `Archive/{category}` — never deleted. See
`DOCUMENT_CATEGORIES` and `ensureDocumentLibraryStructure()` in
`src/lib/graph.ts`.

## Linking a document

Every document record (a row in the `documents` table) can be linked to
a SharePoint file three ways, all ending at the same place — the
document's `sharepoint_item_id`/`sharepoint_web_url` get set and a
`document_versions` row is created as version 1:

- **Browse SharePoint** — lists files already sitting in that
  document's category folder (`/api/sharepoint/documents-browse`)
- **Upload New Document** — uploads bytes straight from the browser into
  the category folder, then links the result
- **Link Existing Document** — searches the whole SharePoint site
  (reuses the existing site-wide search) and links whichever file is
  picked

Once linked, the "➕ Attach Document" control becomes "📎 Linked
Document," and the available actions become Replace Current Version,
View Version History, Remove Link, and Open in SharePoint — see
`DocumentLinkModal.tsx`.

## Automatic version control

`replaceDocumentVersion()` in `document-actions.ts` is the whole
sequence, in order:

1. The new file is either uploaded fresh or was already chosen (an
   existing SharePoint file).
2. The **old** file is renamed (e.g. `Company Profile v4 (superseded
   2026-08-17).docx` — see `archivedFileName()` in `documents-core.ts`)
   and moved into `Archive/{category}`.
3. The old `document_versions` row is marked archived
   (`archivePreviousVersion()`).
4. A new `document_versions` row is created for the new file.
5. The `documents` row itself is updated: new
   `sharepoint_item_id`/`sharepoint_web_url`, `version` and
   `current_version_number` incremented, `modified_by` and `updated_at`
   set automatically — none of this requires manual intervention, per
   the brief.

### Why a separate versions table

SharePoint's own native version history (already used elsewhere in this
app for live preview) can't hold a `comments` field, and can't
represent "this specific version now lives in a different folder" the
way our archive-by-moving model needs. `document_versions` is FortunIQ
OS's own ledger: one row per physical file ever linked to a document
record, whether current or archived. Because a Graph *move* preserves a
file's item id, an archived version's row keeps pointing at the exact
same SharePoint item — only its physical location, name, and
`is_current`/`archived_at`/`archived_by` fields change.

### Replacing an approved/published document

If a document was `Approved` or `Published` and its file is replaced,
it automatically reverts to `Draft` — the content changed, so the prior
approval no longer applies. This is logged as its own audit entry
separate from the replacement itself. Same logic applies to restoring
an archived version (see below) — restored content also needs fresh
approval before it can become the active version again.

## Archive permissions

Only Super Admin, HR/Admin, or anyone explicitly granted the Documents
**Manage** RBAC action can:

- See the "Archive" category filter/chip in the Documents Hub
- See archived versions in a document's Version History (everyone else
  sees only the current version — `getDocumentVersionsAction()` filters
  server-side, not just in the UI)

This is the mechanism for granting Compliance or Legal team members
archive visibility without inventing new top-level roles: grant them
the Documents module with the "Manage" action via the existing granular
RBAC system (Settings → Team Management), same as any other
fine-grained permission in this app.

**Not fully automated**: creating the SharePoint folders via Graph does
not, by itself, restrict who can open the `Archive` folder *directly in
SharePoint* — that requires breaking permission inheritance on that
folder, a site-admin action beyond what `Sites.ReadWrite.All` safely
automates here. A site admin should do this once, manually, in
SharePoint's own sharing settings, to fully lock it down at the
SharePoint level too. FortunIQ OS's own access control (above) is real
and independent of that manual step.

**Search filtering**: category-scoped "Browse SharePoint" structurally
can't surface archived files (`Archive/{category}` is a sibling folder,
never nested under the live category folder). Site-wide "Link Existing
Document" search is not currently filtered to exclude Archive paths —
see "Known limitations" below.

## Version History

`VersionHistoryModal.tsx` shows Current Version and (for authorised
roles) every Archived Version, each with uploader, upload date, and
comments. **Restore Previous Version** (`restoreDocumentVersion()`):
moves the archived file back into the live category folder in
SharePoint, marks that version current again (and the version that was
current a moment ago archived instead), and resets the document to
`Draft` pending re-approval. Nothing is ever deleted from
`document_versions` — restoring back and forth any number of times
keeps the full chain intact.

## Approval workflow

Five states, with real server-side transition validation
(`canTransitionStatus()` in `documents-core.ts`) — not a free dropdown
that implies any status reaches any other:

```
Draft → Pending Approval → Approved → Published
  ↑___________|                ↑          |
              |________________|__________|
                                            ↓
                                        Archived → Draft (restore)
```

- **Draft → Pending Approval**: anyone with Documents Edit access
  (`submitDocumentForApproval`)
- **Pending Approval → Approved or back to Draft**: only someone with
  Documents **Approve** access (`reviewDocumentApproval`) — "Only
  Approved documents become active" is enforced here, not just
  suggested
- **Approved → Published**: also Approve-gated (`publishDocument`) —
  Published is the one status the brief and `isActiveDocument()` treat
  as the organisation's active version of record
- **Anything → Archived**: Edit access (`archiveDocument`)

`DocumentWorkflowControl.tsx` shows the status badge plus only the one
valid next action for the signed-in person's permissions.

## Expiry management

`expiry_date` already existed on `documents` (from an earlier
migration) — reused as-is, no new column needed. `isExpiringSoon()` /
`isExpired()` in `documents-core.ts` (default 30-day window) power two
things:

- A warning banner at the top of the Documents Hub
- A `Document Expiry` card on the personalised dashboard
  (`DocumentExpiryCard.tsx`), computed live from `getExpiringDocuments()`
  rather than persisted as tasks — always accurate without a background
  job, and only shown to people with Documents module access.

## AI Assistant behaviour

Unchanged and already correct: the existing `ai_excluded` flag and
classification system (from earlier work) already restrict what the AI
Assistant can reference. The approval-status filtering that already
existed (only `Approved` documents were surfaced) needed one update:
now that `Published` is the true "active version" status, **both**
`Approved` and `Published` are treated as current for AI purposes —
`Archived` documents are never referenced unless a person explicitly
asks about historical versions, which the AI Assistant does not have a
tool to retrieve (archived version content isn't fetched by the
Assistant's existing document tools) — this is a deliberate, documented
limitation, not an oversight; see "Known limitations."

## Audit Log

New action types added to `AuditAction` in `src/lib/audit.ts`, mapped
directly to the brief's list:

| Brief's event | Audit action |
|---|---|
| Upload | `document_uploaded` |
| Replacement | `document_replaced` |
| Archive | `document_archived` |
| Restore | `document_restored` |
| Approval | `document_approved` (+ `document_status_changed` for submit/reject) |
| Deletion | `document_deleted` |
| Download / View | `document_previewed` (already existed) |
| Link Changes | `document_catalogued` (first link), `document_link_removed` |
| Version Changes | `document_replaced`, `document_restored` |

## Deleting a document record

`deleteDocumentRecord()` deletes the FortunIQ OS catalog row (and its
`document_versions` rows) **only** — it never deletes the actual
SharePoint file. This is a deliberate enterprise-DMS safety choice: a
single click in a document control system should not be able to
permanently destroy a real, possibly legally significant file. The file
remains exactly where it is in SharePoint, under SharePoint's own
separate deletion controls if that's genuinely needed. Restricted to
Documents Delete permission **and** Super Admin, as an extra guardrail.

## Upload size limit

FortunIQ OS supports files up to **8MB** — comfortably covering the
overwhelming majority of policy/SOP/certificate/licence/contract
documents. A larger file raises a clear, friendly error rather than
failing silently.

**How this actually works, technically**: Microsoft Graph's simple
upload endpoint (`PUT .../content`) has a hard 4MB limit — this is a
genuine Microsoft constraint, not a number FortunIQ OS chose, and
simply raising an application-level size check without more would not
have worked, since SharePoint itself rejects anything larger sent that
way. `uploadFileToFolder()` in `graph.ts` handles this transparently:
files 4MB and under use the simple upload; anything from 4MB up to the
8MB ceiling automatically uses Microsoft's documented chunked "upload
session" mechanism instead (`createUploadSession` + sequential 5MB PUT
requests to the pre-authenticated `uploadUrl` it returns). Every caller
— Documents Hub, Employee Document Centre, Leave request attachments —
gets this transparently through the one function; none of them know or
need to know which underlying Graph mechanism actually ran.

Going beyond 8MB would mean raising `MAX_UPLOAD_SIZE` in `graph.ts` and
possibly the chunk size/count — Graph itself supports files far larger
than 8MB via the same upload-session mechanism (SharePoint's own ceiling
is around 250MB), so 8MB is a FortunIQ OS product decision, not a
technical ceiling, should this need to grow further.

**Next.js Server Action body limit**: independent of the above,
Next.js caps every Server Action's raw request body at 1MB by default.
`next.config.ts` sets `experimental.serverActions.bodySizeLimit: "10mb"`
— comfortable headroom above the real 8MB file ceiling for
multipart/form-data overhead and the other form fields submitted
alongside a file. Without this, files over 1MB were rejected at the
Next.js framework level before ever reaching the application's own
size check, and on Netlify's Next.js runtime specifically, that
rejection surfaced as a raw crash (`Cannot set property socket of
#<ComputeJsIncomingMessage>...`) instead of a clean error. If this
recurs on Netlify even with the raised limit, some reports suggest
`bodySizeLimit` doesn't reliably take effect on every serverless/edge
runtime — the fallback would be moving file bytes off Server Actions
entirely into a dedicated API Route Handler (this app already has a
working precedent: `/api/sharepoint/documents-browse`), which isn't
subject to the same Server-Action-specific body limit.

## Known limitations / deliberate scope boundaries

- **Site-wide search doesn't exclude Archive paths.** Category-scoped
  Browse structurally can't reach Archive (see above), but "Link
  Existing Document" search currently can still surface an archived
  file if SharePoint's search index returns it. A follow-up: filter
  search results by URL path the same way category browsing is
  structurally excluded.
- **No chunked upload beyond 8MB** — files over 8MB raise a clear error rather than failing silently; see "Upload size limit" above for what raising this further would take.
- **Outlook/Teams notifications for approvals** aren't wired up —
  approval requests currently only surface via the Documents Hub itself,
  not a notification.
- **The AI Assistant has no explicit "show me the archived version"
  tool** — the brief says the AI should ignore archived versions unless
  asked; today it simply never sees archived content, which correctly
  satisfies the default case but doesn't yet support the explicit-request
  exception.
