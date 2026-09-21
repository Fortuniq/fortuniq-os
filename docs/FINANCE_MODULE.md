# Finance Module

Replaces Zoho Books functionality inside FortunIQ OS: Quotations, Invoices,
Customers, Payments, Expenses, a Calculation Engine, and a VAT-ready (but
currently OFF) tax layer. Built in phases; this doc is updated as each
phase ships. See `supabase/migration_v27_finance.sql` for the schema.

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Finance schema + Customers integration | ✅ Done |
| 2 | Quotations CRUD | Not started |
| 3 | Calculation Engine (Qty × Rate) | ✅ Done (`finance-core.ts`) — reused by Phase 2/5 |
| 4 | Branded PDF quotation generation | Not started |
| 5 | Invoices CRUD | Not started |
| 6 | Quotation → Invoice conversion | Not started |
| 7 | Payments & outstanding balances | Not started |
| 8 | SharePoint storage + audit trail | Not started |

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

## Known limitations (honest, as of Phase 1)

- Quotations/Invoices UI, PDF generation, SharePoint storage, and
  payment recording are **not yet built** — Phase 1 only lays the schema
  and upgrades the Customers page to create/edit real customer records
  with a stable customer code, which Quotations/Invoices will reference.
- The "Sales: draft-only for their own customers" restriction from the
  brief needs an ownership-scoping check beyond what the generic
  `View/Create/Edit/Delete/Approve/Export/Manage` RBAC actions express on
  their own (similar to how `documents.employee_id` ownership is checked
  before classification elsewhere in this app) — this will be added
  alongside the Quotations server actions in Phase 2, not deferred
  silently.
- No branding logo image file is on hand yet for PDF generation (Phase
  4) — only textual brand facts (colours, registration numbers,
  tagline). PDFs can be built with accurate text/colour branding now; the
  actual logo graphic slots in once supplied.
- Full banking account number/branch code are not on file (only bank
  name/account type/holder name) — needed before invoices can display
  complete banking details.
