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
| 4 | Branded PDF quotation generation | Not started |
| 5 | Invoices CRUD | Not started |
| 6 | Quotation → Invoice conversion | Not started |
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

## Known limitations (honest, as of Phase 2)

- Invoices UI, PDF generation, SharePoint document storage, and payment
  recording are **not yet built** (Phases 4–8). Quotations are fully
  functional end-to-end (create → submit → approve → send → revise);
  Invoices will reuse the same schema, patterns and `finance-core.ts`
  functions already in place.
- Quotation approval/decline/expiry OUTCOMES (Accepted/Declined/Expired)
  exist in the schema's status list but have no UI action yet — Phase 2
  only wires the create→approve→send workflow explicitly asked for; a
  customer's actual accept/decline response is not yet capturable.
- No branding logo image file is on hand yet for PDF generation (Phase
  4) — only textual brand facts (colours, registration numbers,
  tagline), now centralised in `src/lib/company-info.ts`. PDFs can be
  built with accurate text/colour branding now; the actual logo graphic
  slots in once supplied.
- Full banking account number/branch code are not on file (only bank
  name/account type/holder name, in `company-info.ts`) — needed before
  quotations/invoices can display complete banking details.
- There is no admin UI yet to flip `finance_vat_registered` on, enter a
  VAT registration number/effective date, or set customer account
  owners in bulk — the backend (`finance-settings.ts`,
  `updateFinanceVatSettings()`) and the Customer form's new "Account
  Owner" field support this today; a dedicated Finance Settings screen
  is future work.
- `isNextRedirectError()` was added and used in this phase's new files
  only (see above) — older action files elsewhere in the app likely
  share the same latent bug and haven't been swept.
