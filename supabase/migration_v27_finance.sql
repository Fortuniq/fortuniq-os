-- =========================================================================
-- FortunIQ OS — Migration: Finance Module (Quotations, Invoices, Payments)
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v26.
-- See docs/FINANCE_MODULE.md for the full architecture, including why
-- "quotations" (this migration) is a separate concept from the existing
-- "quotes" table (Sales CRM pipeline — deal stages, not numbered
-- customer-facing documents). They are not duplicates of each other.
--
-- VAT DESIGN: FortunIQ Fuels is NOT currently VAT registered. Every
-- vat_applied / vat_rate / vat_amount column below defaults to "off" and
-- is captured PER DOCUMENT at issue time, never computed live from a
-- global flag — so a historical document permanently preserves the rules
-- that applied when it was issued, even after VAT is switched on later.
-- =========================================================================

-- ---------- CUSTOMERS: extend (additive, do not duplicate) ----------
-- The customers table already exists (migration_v2). Quotations and
-- invoices must reference it by id, not free-text — see PART A below —
-- so it needs a stable short code and proper contact/billing fields.
alter table customers
  add column if not exists customer_code text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists billing_address text,
  add column if not exists notes text;

create unique index if not exists customers_customer_code_idx on customers (customer_code) where customer_code is not null;

comment on column customers.contact is 'Primary contact person''s name at the customer (kept from the original schema). See email/phone for their contact details.';
comment on column customers.customer_code is 'Short stable code (e.g. CUST-0001), shown on quotations/invoices instead of a raw UUID. Assigned once at creation, never reused.';

-- ---------- ATOMIC SEQUENTIAL NUMBERING ----------
-- A dedicated, race-safe counter — deliberately NOT stored in the generic
-- app_settings key/value table, because numbering must be correct even
-- under concurrent requests (two people issuing a quotation at the same
-- moment must never receive the same number), and a plain
-- read-then-write against a jsonb column cannot guarantee that. This
-- table + function give that guarantee with a single atomic UPSERT.
create table if not exists finance_number_sequences (
  seq_key text primary key,       -- e.g. 'quotation:2026', 'invoice:2026'
  last_number int not null default 0,
  updated_at timestamptz not null default now()
);

alter table finance_number_sequences enable row level security;
create policy "No public access to finance_number_sequences" on finance_number_sequences for all using (false);

-- Returns the next number to use for seq_key and atomically reserves it,
-- via a single UPSERT (no separate read-then-write, so two concurrent
-- callers can never receive the same number). Numbers start at 1 and are
-- never reused, even if a document is later voided/cancelled — matches
-- how sequential invoice numbering must behave for audit/compliance.
create or replace function next_finance_number(p_seq_key text)
returns int
language plpgsql
as $$
declare
  v_number int;
begin
  insert into finance_number_sequences (seq_key, last_number, updated_at)
  values (p_seq_key, 1, now())
  on conflict (seq_key) do update
    set last_number = finance_number_sequences.last_number + 1,
        updated_at = now()
  returning last_number into v_number;
  return v_number;
end;
$$;

comment on function next_finance_number is
  'Atomically reserves and returns the next sequential number for a given key (e.g. next_finance_number(''quotation:2026'')). Race-safe under concurrent callers via a single UPSERT statement. Never call twice for the same document — a reserved number is considered used even if the document creation is later aborted in the app layer, to avoid ever issuing a duplicate.';

-- ---------- PART A: QUOTATIONS (formal, numbered, customer-facing) ----------
-- Distinct from the existing "quotes" table (Sales pipeline/CRM deal
-- tracking — Lead/Qualified/Proposal/Negotiation/Won stages). A
-- quotation here is the actual branded PDF document sent to a customer
-- with priced line items, per Project ORION's Finance Module brief.
create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null unique,       -- e.g. FQ-2026-0001
  customer_id uuid not null references customers(id),
  status text not null default 'Draft'
    check (status in ('Draft', 'Issued', 'Revised', 'Accepted', 'Declined', 'Expired', 'Converted')),

  -- Revision control: an issued quotation is never silently edited.
  -- Editing after issue creates a new row with revision_number + 1 and
  -- parent_quotation_id pointing back to the original; the original row
  -- is marked status = 'Revised' and kept forever.
  revision_number int not null default 1,
  parent_quotation_id uuid references quotations(id),

  issue_date date,
  valid_until date,

  subtotal numeric(14, 2) not null default 0,   -- sum of line totals
  vat_applied boolean not null default false,    -- locked at issue time
  vat_rate numeric(5, 2) not null default 0,      -- rate actually applied (0 while not VAT registered)
  vat_amount numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,        -- subtotal + vat_amount

  non_vat_notice text,                            -- e.g. "FortunIQ Fuels is currently not registered as a VAT vendor. No VAT has been charged."
  notes text,
  terms text,

  created_by_name text,
  created_by_email text not null,

  sharepoint_file_id text,
  sharepoint_file_url text,

  converted_to_invoice_id uuid,                   -- set when this quotation becomes an invoice (Phase 6)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotations_customer_idx on quotations (customer_id);
create index if not exists quotations_status_idx on quotations (status);
create index if not exists quotations_created_by_idx on quotations (created_by_email);
create index if not exists quotations_parent_idx on quotations (parent_quotation_id);

alter table quotations enable row level security;
create policy "No public access to quotations" on quotations for all using (false);

comment on table quotations is
  'Formal, numbered, branded quotations sent to customers. NOT the same table as "quotes" (Sales CRM pipeline). VAT is captured per-row at issue time and never recalculated retroactively. See docs/FINANCE_MODULE.md.';

create table if not exists quotation_line_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  line_order int not null default 0,
  product_service text not null,
  description text,
  quantity numeric(14, 3) not null,               -- supports fractional litres
  unit text,                                       -- e.g. "litres", "each", "hours"
  unit_price numeric(14, 4) not null,              -- supports sub-cent rates, e.g. R18.875/litre
  line_total numeric(14, 2) not null,              -- quantity * unit_price, rounded to cents — computed in finance-core.ts, never trusted from the client as a raw value
  created_at timestamptz not null default now()
);

create index if not exists quotation_line_items_quotation_idx on quotation_line_items (quotation_id);

alter table quotation_line_items enable row level security;
create policy "No public access to quotation_line_items" on quotation_line_items for all using (false);

-- ---------- PART B: INVOICES (extend existing table, additive) ----------
-- The invoices table already exists (migration_v2) as a lightweight
-- placeholder (free-text customer, flat amount). Extend it in place
-- rather than creating a parallel table.
alter table invoices
  add column if not exists customer_id uuid references customers(id),
  add column if not exists quotation_id uuid references quotations(id),
  add column if not exists revision_number int not null default 1,
  add column if not exists parent_invoice_id uuid references invoices(id),
  add column if not exists subtotal numeric(14, 2),
  add column if not exists vat_applied boolean not null default false,
  add column if not exists vat_rate numeric(5, 2) not null default 0,
  add column if not exists vat_amount numeric(14, 2) not null default 0,
  add column if not exists total numeric(14, 2),
  add column if not exists paid_amount numeric(14, 2) not null default 0,
  add column if not exists issue_date date,
  add column if not exists non_vat_notice text,
  add column if not exists notes text,
  add column if not exists terms text,
  add column if not exists created_by_name text,
  add column if not exists created_by_email text,
  add column if not exists sharepoint_file_id text,
  add column if not exists sharepoint_file_url text;

comment on column invoices.customer is 'Legacy free-text customer name from the original placeholder schema. Kept for backward compatibility with old mock rows only — new invoices must set customer_id instead and should leave this populated with the customer''s name for convenience/display.';
comment on column invoices.amount is 'Legacy total from the original placeholder schema. New invoices should use total instead; amount is kept in sync with total for backward compatibility.';
comment on column invoices.total is 'Canonical total (subtotal + vat_amount). Use this, not amount, for all new Finance Module logic.';

-- Widen the status workflow (Partially Paid, Cancelled) without breaking
-- existing rows. Postgres requires dropping and recreating a check
-- constraint to widen it.
alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check
  check (status in ('Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'));

create index if not exists invoices_customer_idx on invoices (customer_id);
create index if not exists invoices_quotation_idx on invoices (quotation_id);
create index if not exists invoices_status_idx on invoices (status);
create index if not exists invoices_created_by_idx on invoices (created_by_email);

create table if not exists invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  line_order int not null default 0,
  product_service text not null,
  description text,
  quantity numeric(14, 3) not null,
  unit text,
  unit_price numeric(14, 4) not null,
  line_total numeric(14, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists invoice_line_items_invoice_idx on invoice_line_items (invoice_id);

alter table invoice_line_items enable row level security;
create policy "No public access to invoice_line_items" on invoice_line_items for all using (false);

-- ---------- PART C: PAYMENTS ----------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric(14, 2) not null,
  payment_date date not null,
  method text not null default 'EFT' check (method in ('EFT', 'Cash', 'Card', 'Cheque', 'Other')),
  reference text,
  notes text,
  recorded_by_name text,
  recorded_by_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists payments_invoice_idx on payments (invoice_id);

alter table payments enable row level security;
create policy "No public access to payments" on payments for all using (false);

comment on table payments is
  'Payments recorded against an invoice. invoices.paid_amount is a denormalized running total kept in sync transactionally whenever a payment is recorded/removed — same pattern used elsewhere in this app (e.g. tenders.current_priority) to avoid per-row aggregation at scale. Outstanding balance = invoices.total - invoices.paid_amount, computed at read time, never stored.';

-- ---------- PART D: FINANCE SETTINGS (seeded into existing app_settings) ----------
-- Reuses the generic app_settings key/value table (introduced in
-- migration_v23 for tender config) rather than creating a new settings
-- table — this is low-concurrency, admin-edited configuration, unlike
-- the numbering counters above which need atomicity.
insert into app_settings (key, value) values
  ('finance_vat_registered', 'false'),
  ('finance_vat_rate', '15'),
  ('finance_vat_registration_number', '""'),
  ('finance_vat_effective_date', 'null'),
  ('finance_non_vat_notice', '"FortunIQ Fuels is currently not registered as a VAT vendor. No VAT has been charged."'),
  ('finance_quotation_number_prefix', '"FQ"'),
  ('finance_invoice_number_prefix', '"INV"')
on conflict (key) do nothing;

comment on table app_settings is
  'Generic app-wide key/value settings store (tender deadline config, Finance VAT/numbering config, etc.). Low write-frequency, admin-edited only — for anything requiring atomic concurrent increments (e.g. document numbering), use a dedicated table like finance_number_sequences instead.';

-- ---------- PART E: AUDIT ----------
-- No new table — Finance actions are recorded via the existing
-- audit_logs table / logAudit() helper (src/lib/audit.ts). The
-- AuditAction union type there is extended in the same app-layer change
-- that adds the Finance server actions, listing: quotation_created,
-- quotation_issued, quotation_revised, quotation_accepted,
-- quotation_declined, quotation_converted, invoice_created,
-- invoice_issued, invoice_revised, invoice_cancelled, payment_recorded,
-- customer_created, customer_updated, finance_settings_changed.
