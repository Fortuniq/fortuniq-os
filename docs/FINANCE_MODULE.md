# Finance Module

Replaces Zoho Books functionality inside FortunIQ OS: Quotations, Invoices,
Customers, Payments, Expenses, a Calculation Engine, and a VAT-ready (but
currently OFF) tax layer. Built in phases; this doc is updated as each
phase ships. See `supabase/migration_v27_finance.sql` for the schema.

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Finance schema + Customers integration | ✅ Done |
| 2 | Quotations CRUD | ✅ Done |
| 3 | Calculation Engine (Qty × Rate) | ✅ Done (`finance-core.ts`) — reused by Phase 2/5 |
| 4 | Branded PDF quotation generation | ✅ Done |
| 5 | Invoices CRUD | ✅ Done |
| 6 | Quotation → Invoice conversion | ✅ Done |
| 7 | Payments & outstanding balances | Not started |
| 8 | SharePoint storage + audit trail | Partial — audit logging for every quotation lifecycle event is done (see below); SharePoint document storage is still Phase 8/4 |

## Phase 2 additions (VAT hard block, snapshots, numbering-at-approval, ownership)

**The VAT hard block is enforced server-side, not by trusting a flag.**
`evaluateVatApplicability()` in `finance-core.ts` is the ONLY function
allowed to say VAT may be applied, and every one of these must hold —
checked fresh, every time, never cached:
1. `finance_vat_registered = true` in Finance Settings.
2. A non-blank `finance_vat_registration_number` is on file.
3. A non-blank `finance_vat_effective_date` is on file.
4. The document's own transaction/issue date is on or after that
   effective date (so a document dated before liability began can never
   carry VAT, even once VAT registration exists).
5. The requesting user is Super Admin or holds the Finance role.

Every quotation server action (`createQuotationDraft`,
`updateQuotationDraft`, `approveQuotation`) calls this gate itself and
uses ITS result — a client can send whatever it wants in the form, it is
never trusted. Today, condition 1 alone always fails (FortunIQ Fuels is
not VAT registered), so every document is created with `vat_applied =
false`, `vat_amount = 0`, `total = subtotal`, and carries the required
notice: *"FortunIQ Fuels (Pty) Ltd is currently not registered as a
Value-Added Tax (VAT) vendor. Accordingly, no VAT has been charged or
included in this quotation/invoice."* (`NOT_VAT_REGISTERED_NOTICE`).

**A customer's own VAT registration is completely independent of
FortunIQ's.** `customers.vat_registered`/`customers.vat_number`
(migration_v28) are display-only fields shown in the snapshot's
`customer` block — `evaluateVatApplicability()` never reads them, and no
code path lets a customer's VAT status influence whether VAT is charged.
Covered explicitly in `finance-core.test.ts` ("captures customer VAT
status independently of FortunIQ's own VAT status").

**Document numbers are allocated at Approval, not at Draft creation.**
`quotations.quotation_number` is nullable; Draft and Pending Approval
quotations show as "Draft (unnumbered)" in the UI and are identified
only by their database id. `approveQuotation()` is the single place
`next_finance_number('quotation:<year>')` is ever called for a
quotation. Because the underlying sequence only ever increments, a
cancelled/voided quotation's number (once it has one) is never reused —
the row and its audit trail are simply retained with that permanent
number.

**Issued-document snapshots.** The moment a quotation is Approved,
`buildDocumentSnapshot()` captures customer identity/address/contact/VAT
number, FortunIQ's own company + banking details (`company-info.ts`),
FortunIQ's VAT status for that document, every line item, totals, terms,
notes and a `templateVersion` tag — into `quotations.snapshot` (jsonb),
which is never overwritten again. Phase 4 (PDF generation) must render
an Approved/Sent/etc. quotation from this snapshot, never from live
Customer/Settings tables, so a later edit to a customer's address can
never alter a previously issued document.

**Customer ownership is enforced server-side, at three layers**, not
just hidden in the UI: (1) `getAuthorizedCustomerOptions()` never
returns an unauthorised customer to the client in the first place; (2)
`createQuotationDraft`/`updateQuotationDraft` re-check
`canAccessCustomerForQuotation()` against whatever `customerId` actually
arrives in the form, independent of what the picker showed; (3)
`getQuotations`/`getQuotationDetail` scope reads the same way (Sales
sees only quotations they created; Finance/Management/Super Admin see
everything). An unassigned customer (`account_owner_email` is null) is
open to any Sales user until a Super Admin/Finance/Management person
assigns it via the new "Account Owner" field on the Customer form.

**Lifecycle implemented:** Draft → Pending Approval → Approved → Sent,
plus Revised (superseded by a new revision) and the schema-level outcome
states Accepted/Declined/Expired/Cancelled/Converted for later phases.
Draft/Pending Approval are freely editable in place; anything Approved+
requires `reviseQuotation()`, which creates a fresh Draft copy (new
`revision_number`, `parent_quotation_id` always pointing at the
original) and marks the source row `Revised` — the original's number
and snapshot are untouched forever.

**A pre-existing bug fixed along the way, in the files touched this
phase:** `requirePermissionAction()` calls Next's `redirect()` on access
denial, which works by throwing a special `NEXT_REDIRECT`-digest error.
Every server action in this app wraps its body in `try { } catch (err) {
return { error: ... } }` (to avoid Next's production error-message
redaction — see the app-wide convention). Without care, that generic
catch also swallows the redirect error and shows a confusing message
instead of actually redirecting to `/access-denied`. Added
`isNextRedirectError()` (`src/lib/rbac.ts`) and used it as the first
line of every catch block in `customer-actions.ts` and
`quotation-actions.ts`. **This same latent issue likely exists in older
action files** (`document-actions.ts`, `tender-actions.ts`, etc.) that
predate this fix — worth a follow-up sweep, not done here to keep this
phase's diff focused.

**Operational note on Sales access:** `Sales/Marketing`'s role defaults
(`ROLE_DEFAULT_MODULES`) do not include the `finance` module, so a Sales
user needs to be explicitly granted `finance` module access (Team
Management) before they can reach Quotations at all — and, because
granular RBAC only takes effect once configured per person, an admin
should also explicitly set that Sales user's `finance` actions to
`Create`/`View` only (not `Approve`), otherwise they'll fall back to the
coarse module gate and be able to approve their own quotations.

## Key architectural decisions

**`quotations` is a new table, distinct from the existing `quotes` table.**
`quotes` is the Sales module's CRM pipeline (deal stages: Draft → Sent →
Negotiation → Won/Lost, with a probability-style `owner`/`stage`
tracking). `quotations` (this module) is the formal, numbered,
customer-facing branded document (FQ-2026-0001) with priced line items
that becomes a PDF and can convert into an invoice. They serve different
purposes and are not duplicates of each other — a Sales rep's pipeline
`quote` may eventually lead to a Finance `quotation` being issued, but
the two are not the same record.

**`invoices` was extended in place, not duplicated.** The table already
existed (migration_v2) as a lightweight placeholder (free-text customer,
flat amount, no line items). Migration v27 adds columns additively
(`customer_id`, line items via a new `invoice_line_items` table, VAT
fields, revision control, payment tracking) rather than creating a
parallel `finance_invoices` table. `amount`/`customer` (the original
columns) are kept for backward compatibility and marked deprecated in
favour of `total`/`customer_id`.

**Customers are shared, not duplicated per module.** Quotations and
Invoices reference `customers.id` via foreign key. The `customers` table
(Sales/Customers module) was extended with `customer_code`, `email`,
`phone`, `billing_address`, `notes` rather than each module keeping its
own copy of customer data.

**VAT is OFF today and captured per-document, not computed live from a
global flag.** FortunIQ Fuels is not currently VAT registered. Every
quotation/invoice stores `vat_applied` (boolean) and `vat_rate` as facts
about *that specific document*, decided once at issue time from Finance
Settings' *current* `finance_vat_registered` flag. This means:
- While `finance_vat_registered = false` (today), every new document is
  created with `vat_applied = false`, `vat_amount = 0`, `total =
  subtotal`. No VAT amount, VAT number, or "Tax Invoice"/"VAT Invoice"
  wording is ever shown.
- When VAT registration happens in future, Super Admin/Finance flips
  `finance_vat_registered = true` and sets `finance_vat_registration_number`
  / an effective date in Finance Settings. Only *new* documents created
  after that point pick up `vat_applied = true`. Historical documents are
  never retroactively altered — their stored `vat_applied`/`vat_rate`
  values are permanent.
- `finance_vat_rate` (currently "15", the SA standard rate) is kept on
  file for readiness but is never applied while `finance_vat_registered`
  is false — see `calculateDocumentTotals()` in `finance-core.ts`, which
  takes an explicit `vatApplied` flag rather than reading any "current"
  setting itself.

**The Calculation Engine, today, is intentionally simple: Quantity ×
Rate = Line Total, summed to a Grand Total.** Per the clarified brief,
this is unrelated to the user's separate Excel workbook (a different,
not-yet-built future Calculation Tool). All money math lives in
`src/lib/finance-core.ts` (pure functions, zero DB dependency, rounds
through cents to avoid floating-point drift) with full test coverage in
`finance-core.test.ts`. `quantity` supports 3 decimal places (fractional
litres) and `unitPrice` supports 4 decimal places (sub-cent per-unit
rates like R18.875/litre); all stored/display totals round to 2 decimals
(cents).

**Sequential numbering is atomic, not a read-then-write.** A dedicated
`finance_number_sequences` table + `next_finance_number(seq_key)`
Postgres function reserves the next number in a single UPSERT statement,
so two people issuing a quotation/invoice at the same moment can never
receive the same number. Used for quotation numbers (`quotation:2026`),
invoice numbers (`invoice:2026`), and customer codes (`customer`). This
is deliberately a separate mechanism from the generic `app_settings`
key/value table (reused for VAT/company config, which is low-frequency
and admin-edited, not concurrency-sensitive).

**Revision control:** once a quotation/invoice leaves Draft status, it
is never edited in place — editing creates a new row
(`revision_number + 1`, `parent_quotation_id`/`parent_invoice_id`
pointing back to the original), and the original is marked `Revised`
and permanently retained. See `requiresRevisionToEdit()` in
`finance-core.ts`.

**Audit trail reuses the existing `audit_logs` table**, not a new
Finance-specific table — consistent with how every other module in this
app records audit events. New `AuditAction` values were added in
`src/lib/audit.ts`: `customer_created`, `customer_updated`,
`quotation_created`, `quotation_issued`, `quotation_revised`,
`quotation_accepted`, `quotation_declined`, `quotation_converted`,
`invoice_created`, `invoice_issued`, `invoice_revised`,
`invoice_cancelled`, `payment_recorded`, `finance_settings_changed`.

**Permissions reuse the existing granular RBAC layer**
(`requirePermissionAction("finance"|"sales"|"customers", action)` from
`src/lib/rbac.ts`) — no parallel permission system. `finance`, `sales`,
and `customers` were already first-class module keys with role defaults
(Finance role: full finance access; Sales/Marketing role: customers +
sales) before this module existed.

## Phase 4: Branded PDF generation

**One renderer, two callers, never two competing layouts.**
`generateFinancePdf()` (`src/lib/finance-pdf.ts`) takes a
`DocumentSnapshotInput` (the exact same shape `buildDocumentSnapshot()`
produces) plus a small `isPreview` flag — it never fetches anything
itself. `GET /api/finance/quotations/[id]/pdf`
(`src/app/api/finance/quotations/[id]/pdf/route.ts`) is the only caller
today, and it picks the input two ways:
- **Approved/Sent/Accepted/etc.** — passes `quotations.snapshot`
  straight through. The PDF can never drift from what was actually
  approved, because nothing here re-reads Customer/Settings tables.
- **Draft/Pending Approval** — no snapshot exists yet, so the route
  builds an equivalent structure from current live data (same
  `buildDocumentSnapshot()` call the approval action uses) and sets
  `isPreview: true`, which adds a diagonal "DRAFT — NOT ISSUED"
  watermark and skips the document number. This is a genuine preview,
  never mistakable for the issued document.

**Uses `pdfkit`, not a headless browser.** Puppeteer/Playwright-style
HTML-to-PDF rendering typically doesn't fit Netlify's serverless
function size/cold-start constraints (a full Chromium binary). `pdfkit`
is pure JS, so PDF generation runs as an ordinary serverless function
with no extra runtime dependency.

**Turbopack build note.** `pdfkit`'s font-handling dependency
`fontkit` ships a prebuilt `dist/module.mjs` that imports a decorator
helper from `@swc/helpers` under a name (`applyDecoratedDescriptor`)
this project's resolved `@swc/helpers` no longer exports (it's now
`_apply_decorated_descriptor`), which surfaced as a Turbopack build
failure the first time this route was built. It's a bundling-only
issue — `finance-pdf.ts` only ever runs server-side, in the Node.js
runtime, so it never needs to be bundled at all. `next.config.ts` lists
`pdfkit`/`fontkit` under `serverExternalPackages`, which tells Next to
leave them external and `require()` them natively at runtime instead of
pulling them through Turbopack/webpack — the mismatch never triggers
because the file is never bundled. If a future dependency bump changes
this, the fallback options are pinning `@swc/helpers` via a
`package.json` "overrides" entry, or swapping `pdfkit` for a lighter PDF
library that doesn't pull in `fontkit`.

**What's on the PDF:** letterhead (trading name, tagline, brand orange
accent bar — text/colour treatment, since no logo image file is on hand
yet, see `company-info.ts`), registration/licence/tax reference numbers,
registered address, contact details, the `QUOTATION`/`INVOICE` heading
(never "Tax Invoice"/"VAT Invoice" — see `documentHeading()` in
finance-core.ts), document number + status + issue date + revision,
customer "Bill To" block (including the customer's OWN VAT number when
they have one, clearly independent of whether VAT was actually charged
on the document), the line-item table, subtotal/VAT/grand total, the
exact required non-VAT notice when VAT wasn't applied, terms, notes, and
whatever banking detail lines are actually on file (never a fabricated
account number/branch code — `company-info.ts`'s `accountNumber`/
`branchCode` are `null` today, so those lines are simply omitted).

**Access control is the same as the detail page, not a second check.**
The route calls `getQuotationDetail()` — the identical function the
`/finance/quotations/[id]` page uses — so a Sales user can only ever
download a PDF for a quotation they created, and a disallowed id 404s
exactly like a nonexistent one (no probing signal).

## Phase 5: Invoices CRUD

**Same six hard controls as Quotations, reusing the same pure logic.**
Invoices are built entirely on the `finance-core.ts` / `finance-pdf.ts`
/ `finance-settings.ts` / `company-info.ts` infrastructure from Phases
1–4 — no duplicated business logic, only a parallel data layer
(`src/lib/invoices-data.ts`), server actions
(`src/app/(app)/finance/invoices/invoice-actions.ts`), and UI
(`src/app/(app)/finance/invoices/**`), plus a mirrored PDF route
(`src/app/api/finance/invoices/[id]/pdf/route.ts`).

**A simpler lifecycle than Quotations — no separate approval step.**
`InvoiceStatus` (`finance-core.ts`) is `Draft | Sent | Paid | Partially
Paid | Overdue | Cancelled` — there is no `Pending Approval`/`Approved`
split. A Draft invoice uses live Customer/Company data, has no
`INV-YYYY-XXXX` number, and is freely editable
(`createInvoiceDraft`/`updateInvoiceDraft`). `issueInvoice()` is the one
place a number is allocated and a snapshot is taken — it allocates the
number via `next_finance_number('invoice:<year>')`, re-evaluates the VAT
hard block using the issuer's own permissions (never trusting what was
last previewed on the Draft), calls `buildDocumentSnapshot()`, and moves
the row straight to `Sent` in a single action — matching how invoices
actually work (there's no internal approval step to model; issuing
*is* sending). `isPreIssueInvoiceStatus()` (`finance-core.ts`) is the
Invoice equivalent of `isPreIssueQuotationStatus()` — true only for
`Draft`.

**No revision workflow for invoices, unlike quotations.** `Quotation
Status` includes `Revised`; `InvoiceStatus` deliberately does not — a
sent invoice isn't silently "revised" in the same way a negotiable
quotation is; correcting an issued invoice is a credit-note/reissue
business process, not a schema-level revision chain. The
`revision_number`/`parent_invoice_id` columns already exist on
`invoices` (migration_v27) for when that's built, but Phase 5 doesn't
wire a `reviseInvoice()` action. `cancelInvoice()` is the only
post-issue state change Phase 5 ships, and it deliberately refuses once
`paid_amount > 0` — cancelling a paid invoice needs a credit note, not a
silent status flip.

**Customer ownership reuses `canAccessCustomerForQuotation()` as-is.**
The function name still says "Quotation" (kept rather than renamed, to
avoid an unrelated diff across Phase 2 files), but its behaviour is
generic — Sales users can only bill customers they're authorised to
access, exactly as with quotations — so `invoices-data.ts` and
`invoice-actions.ts` call it directly rather than duplicating the rule.

**PDF reuses `generateFinancePdf()` unchanged**, with `kind: "invoice"`
and a new optional `dueDate` field (mirrors quotations' `validUntil` —
printed in the heading block only when the document is an invoice). A
Draft invoice's PDF is a watermarked live-data preview, exactly like a
Draft/Pending Approval quotation's; a Sent+ invoice's PDF renders
straight from its immutable `snapshot`.

**Legacy Finance dashboard widget kept in sync, not replaced.** The
existing `/finance` page's "Invoices" table (`src/lib/data.ts`'s
`getInvoices()`, feeding the generic `FinanceView`) reads the same
`invoices` table, so real invoices created here now appear there too —
`invoice-actions.ts` keeps the legacy `customer`/`amount` columns in
sync with `customer_id`/`total` on every write for exactly this reason.
`getInvoices()` was given a one-line defensive fallback so a Draft
invoice (no `invoice_number` yet) shows a short id-based label instead
of a blank row in that widget. The real, full-featured invoices list
lives at `/finance/invoices` (`InvoiceListRow`, `invoices-data.ts`) —
deliberately a separate type/query from the legacy widget's simple
`{id, customer, amount, status, due}` shape, not a shared one.

## Phase 6: Quotation → Invoice conversion

**One-way, one-time, and never trusts the quotation's own totals.**
`convertQuotationToInvoice()` (`quotation-actions.ts`) creates a new
Draft invoice from an issued quotation's line items — copying
`product_service`/`description`/`quantity`/`unit`/`unit_price` verbatim,
but always re-running them through `calculateDocumentTotals()` with a
**freshly evaluated** VAT gate (today's date, the converting user's own
permissions), never copying the quotation's stored `subtotal`/`vat_*`/
`total` columns. The two documents can legitimately end up with
different VAT treatment if Finance Settings changed in between — that's
correct, not a bug, per the VAT hard block's own rule that every
document's VAT status is decided independently at ITS OWN issue time
(see `evaluateVatApplicability()`).

**Eligibility is a pure function, `isConvertibleQuotationStatus()`**
(`finance-core.ts`) — true only for `Approved`, `Sent`, `Accepted`.
Blocked before issue (`Draft`/`Pending Approval` — nothing issued yet)
and after `Declined`/`Expired`/`Cancelled`/`Revised`/`Converted`. A
quotation can only ever be converted once: the action checks BOTH
`isConvertibleQuotationStatus()` AND `quotations.converted_to_invoice_id
IS NULL`, so a second attempt (even racing the first) is refused with a
pointer to the invoice that already exists rather than creating a
duplicate.

**The link is bidirectional and permanent.** The quotation is marked
`status = 'Converted'` with `converted_to_invoice_id` set (its own
`quotation_number`/snapshot/history are untouched — Converted is just
another terminal status, like Declined or Expired); the new invoice
carries `quotation_id` pointing back. Both detail pages show a "View
invoice" / "Converted from FQ-…" link using these — no separate join
table, no denormalized copy of the quotation number onto the invoice
beyond what the `quotations(quotation_number)` select already resolves
at read time in `invoices-data.ts`.

**If the invoice is created but the quotation's own status update
fails** (a genuine two-write operation — Postgres doesn't give this app
a cross-table transaction here), the action does NOT roll back the
invoice: it's real, usable data at that point, and destroying it to
"undo" a bookkeeping failure would be worse than a temporarily
inconsistent status. The error message says exactly that, so it's never
silently swallowed.

## Known limitations (honest, as of Phase 6)

- SharePoint document storage (saving generated PDFs into
  `Finance/Quotations/{year}` / `Finance/Invoices/{year}`) and payment
  recording are **not yet built** (Phases 7–8). An invoice's
  `Paid`/`Partially Paid`/`Overdue` statuses can't yet be reached —
  Phase 7 (payments) is what will actually move an invoice out of
  `Sent`.
- No revision workflow for invoices (see the Phase 5 section above) —
  only `cancelInvoice()`, which refuses once anything has been paid.
- Converting a quotation copies its line items and terms/notes, but NOT
  its `valid_until` (quotations concept, doesn't apply to an invoice) —
  the new Draft invoice's `due_date` is left blank for Finance to set
  explicitly, since a quotation's validity window and an invoice's
  payment terms are different business concepts that shouldn't be
  silently conflated.
- Quotation approval/decline/expiry OUTCOMES (Accepted/Declined/Expired)
  exist in the schema's status list but have no UI action yet — Phase 2
  only wires the create→approve→send workflow explicitly asked for; a
  customer's actual accept/decline response is not yet capturable.
- No branding logo IMAGE file is on hand yet — only textual brand facts
  (colours, registration numbers, tagline), centralised in
  `src/lib/company-info.ts`. The PDF ships with an accurate text/colour
  letterhead treatment (a coloured accent bar + trading name/tagline in
  brand fonts-equivalent) rather than a placeholder box; once a logo
  image is supplied, `finance-pdf.ts` can embed it with `doc.image(...)`.
- Full banking account number/branch code are not on file (only bank
  name/account type/holder name, in `company-info.ts`) — those two lines
  are simply omitted from the PDF today rather than shown blank or
  fabricated; they'll appear automatically once added to
  `company-info.ts`.
- **`pdfkit` and `@types/pdfkit` were added to `package.json` but are
  not yet installed in this sandbox** (no network access to npm here) —
  run `npm install` locally before building/testing; this is the same
  "please build locally before deploying" caveat as always, now also
  covering this new dependency specifically.
- There is no admin UI yet to flip `finance_vat_registered` on, enter a
  VAT registration number/effective date, or set customer account
  owners in bulk — the backend (`finance-settings.ts`,
  `updateFinanceVatSettings()`) and the Customer form's new "Account
  Owner" field support this today; a dedicated Finance Settings screen
  is future work.
- `isNextRedirectError()` was added and used in this phase's new files
  only (see above) — older action files elsewhere in the app likely
  share the same latent bug and haven't been swept.
