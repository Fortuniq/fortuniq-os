-- =========================================================================
-- FortunIQ OS — Migration: Finance Phase 2 (Quotations lifecycle, VAT
-- hard-block support, issued-document snapshots, customer ownership)
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v27.
-- See docs/FINANCE_MODULE.md for the full architecture.
-- =========================================================================

-- ---------- CUSTOMER: own VAT status (independent of FortunIQ's) ----------
-- IMPORTANT: these two columns describe the CUSTOMER's own VAT
-- registration, purely for display on customer-facing documents (e.g.
-- showing their VAT number in the "Bill To" block). They must NEVER be
-- read by any VAT calculation — see evaluateVatApplicability() in
-- finance-core.ts, which only ever looks at FortunIQ's own
-- finance_vat_registered setting, never at a customer row.
alter table customers
  add column if not exists vat_registered boolean not null default false,
  add column if not exists vat_number text;

comment on column customers.vat_registered is 'Whether this CUSTOMER (not FortunIQ Fuels) is VAT registered. Display-only — never drives VAT calculation on quotations/invoices.';
comment on column customers.vat_number is 'This CUSTOMER''s own VAT registration number, for display on documents when they have one. Independent of FortunIQ Fuels'' own VAT status.';

-- ---------- CUSTOMER OWNERSHIP (for Sales draft-only-own-customers) ----------
alter table customers
  add column if not exists account_owner_email text;

create index if not exists customers_account_owner_idx on customers (account_owner_email);

comment on column customers.account_owner_email is
  'The Sales rep this account is assigned to. NULL means unassigned — visible/usable by any Sales user until claimed. Finance/Management/Super Admin always bypass this scoping. Enforced server-side in quotation-actions.ts via canAccessCustomerForQuotation(), never only in the UI.';

-- ---------- QUOTATIONS: numbers allocated at Approval, not at creation ----------
-- A Draft (and Pending Approval) quotation is identified only by its
-- internal database id — no FQ-YYYY-XXXX number is burned until it is
-- actually Approved. This avoids gaps in the sequence for quotations
-- that are drafted and abandoned, while still guaranteeing that once a
-- number IS issued, it is never reused (see next_finance_number()).
alter table quotations alter column quotation_number drop not null;
alter table quotations drop constraint if exists quotations_quotation_number_key;
create unique index if not exists quotations_quotation_number_unique_idx
  on quotations (quotation_number) where quotation_number is not null;

-- Widen the lifecycle to Draft / Pending Approval / Approved / Sent,
-- keeping the later outcome states from migration_v27.
alter table quotations drop constraint if exists quotations_status_check;
alter table quotations add constraint quotations_status_check
  check (status in ('Draft', 'Pending Approval', 'Approved', 'Sent', 'Accepted', 'Declined', 'Expired', 'Revised', 'Cancelled', 'Converted'));

alter table quotations
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by_name text,
  add column if not exists submitted_by_email text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_name text,
  add column if not exists approved_by_email text,
  add column if not exists sent_at timestamptz,
  -- Immutable snapshot of every customer-facing fact used on the issued
  -- document (customer details, company details, banking, VAT status,
  -- line items, totals, terms, notes, template/branding version). Taken
  -- ONCE at Approval and never regenerated from live data afterwards —
  -- later edits to Customer or Company/Finance Settings records must
  -- never change a previously issued PDF. NULL while still Draft/Pending
  -- Approval (those may legitimately show live data, since nothing has
  -- been issued to a customer yet).
  add column if not exists snapshot jsonb;

comment on column quotations.snapshot is
  'Immutable copy of all customer-facing data as it existed at the moment this quotation was Approved (customer identity/address/contact/VAT number, FortunIQ company + banking details, FortunIQ VAT status, line items, totals, terms, notes, branding/template version). Populated once, in approveQuotation(), and never overwritten afterwards. PDF generation for an Approved/Sent/Accepted/etc. quotation must always render from this snapshot, never from live Customer/Settings tables.';

-- ---------- INVOICES: same numbering-at-issue + snapshot model ----------
alter table invoices alter column invoice_number drop not null;
alter table invoices drop constraint if exists invoices_invoice_number_key;
create unique index if not exists invoices_invoice_number_unique_idx
  on invoices (invoice_number) where invoice_number is not null;

alter table invoices
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_name text,
  add column if not exists approved_by_email text,
  add column if not exists sent_at timestamptz,
  add column if not exists snapshot jsonb;

comment on column invoices.snapshot is
  'Same purpose as quotations.snapshot — immutable copy of everything customer-facing at the moment this invoice was issued (approved). Never overwritten afterwards.';

-- ---------- AUDIT ----------
-- No new table. New AuditAction values added in src/lib/audit.ts:
-- quotation_submitted_for_approval, quotation_approved, quotation_sent,
-- quotation_cancelled.
