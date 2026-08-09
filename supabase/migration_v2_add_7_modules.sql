-- =========================================================================
-- FortunIQ OS — Migration: Add tables for the 7 new modules
-- (Finance, Operations, Customers, Sales)
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor. It only adds new tables —
-- it does not touch your existing employees/courses/tenders/etc. tables,
-- so there's no risk of an "already exists" error like the first time.
-- =========================================================================

create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer text not null,
  amount numeric(14, 2) not null default 0,
  status text not null check (status in ('Draft', 'Sent', 'Paid', 'Overdue')),
  due_date date not null,
  created_at timestamptz default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount numeric(14, 2) not null default 0,
  expense_date date not null,
  created_at timestamptz default now()
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  terms text,
  status text not null default 'Active',
  created_at timestamptz default now()
);

create table fuel_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer text not null,
  product text not null,
  volume int not null default 0,
  status text not null check (status in ('Scheduled', 'Loading', 'In Transit', 'Delivered')),
  eta text,
  created_at timestamptz default now()
);

create table fleet (
  id uuid primary key default gen_random_uuid(),
  vehicle_code text not null unique,
  vehicle text not null,
  capacity text,
  driver text,
  status text not null check (status in ('Available', 'Loading', 'On Route', 'Maintenance')),
  created_at timestamptz default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  account_value numeric(14, 2) not null default 0,
  status text not null default 'Active',
  contact text,
  created_at timestamptz default now()
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  customer text not null,
  value numeric(14, 2) not null default 0,
  stage text not null check (stage in ('Draft', 'Sent', 'Negotiation', 'Won', 'Lost')),
  owner text,
  created_at timestamptz default now()
);

create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  stage text not null,
  stage_order int not null default 0,
  deal_count int not null default 0,
  total_value numeric(14, 2) not null default 0,
  created_at timestamptz default now()
);

alter table invoices enable row level security;
alter table expenses enable row level security;
alter table suppliers enable row level security;
alter table fuel_orders enable row level security;
alter table fleet enable row level security;
alter table customers enable row level security;
alter table quotes enable row level security;
alter table pipeline_stages enable row level security;

create policy "Authenticated read invoices" on invoices for select using (auth.role() = 'authenticated');
create policy "Authenticated write invoices" on invoices for all using (auth.role() = 'authenticated');

create policy "Authenticated read expenses" on expenses for select using (auth.role() = 'authenticated');
create policy "Authenticated write expenses" on expenses for all using (auth.role() = 'authenticated');

create policy "Authenticated read suppliers" on suppliers for select using (auth.role() = 'authenticated');
create policy "Authenticated write suppliers" on suppliers for all using (auth.role() = 'authenticated');

create policy "Authenticated read fuel_orders" on fuel_orders for select using (auth.role() = 'authenticated');
create policy "Authenticated write fuel_orders" on fuel_orders for all using (auth.role() = 'authenticated');

create policy "Authenticated read fleet" on fleet for select using (auth.role() = 'authenticated');
create policy "Authenticated write fleet" on fleet for all using (auth.role() = 'authenticated');

create policy "Authenticated read customers" on customers for select using (auth.role() = 'authenticated');
create policy "Authenticated write customers" on customers for all using (auth.role() = 'authenticated');

create policy "Authenticated read quotes" on quotes for select using (auth.role() = 'authenticated');
create policy "Authenticated write quotes" on quotes for all using (auth.role() = 'authenticated');

create policy "Authenticated read pipeline_stages" on pipeline_stages for select using (auth.role() = 'authenticated');
create policy "Authenticated write pipeline_stages" on pipeline_stages for all using (auth.role() = 'authenticated');

-- Starter data, same pattern as before
insert into invoices (invoice_number, customer, amount, status, due_date) values
('INV-2451', 'Kgomotso Logistics', 184200, 'Overdue', '2026-07-24'),
('INV-2452', 'Rustenburg Mining Group', 512000, 'Paid', '2026-07-15'),
('INV-2453', 'Tshwane Metro', 298500, 'Sent', '2026-08-10'),
('INV-2454', 'Agri Co-op Ltd', 76300, 'Paid', '2026-07-20'),
('INV-2455', 'Vaal Transport Group', 145900, 'Draft', '2026-08-18');

insert into expenses (category, amount, expense_date) values
('Fleet Maintenance', 62400, '2026-07-28'),
('Depot Rent — Fourways', 48000, '2026-07-01'),
('Fuel Testing & Compliance', 12800, '2026-07-15'),
('IT & Software Licences', 9600, '2026-07-05');

insert into suppliers (name, category, terms, status) values
('Sasol', 'Refinery', '30 days', 'Active'),
('Puma Energy', 'Refinery', '30 days', 'Active'),
('Engen', 'Refinery', '45 days', 'Active'),
('Volvo Trucks SA', 'Fleet', '60 days', 'Active');

insert into fuel_orders (order_number, customer, product, volume, status, eta) values
('FO-3301', 'Rustenburg Mining Group', 'Diesel 50ppm', 40000, 'Loading', 'Today, 14:00'),
('FO-3302', 'Tshwane Metro', 'Diesel 50ppm', 25000, 'In Transit', 'Today, 16:30'),
('FO-3303', 'Kgomotso Logistics', 'ULP 95', 10000, 'Delivered', 'Completed'),
('FO-3304', 'Agri Co-op Ltd', 'Diesel 50ppm', 18000, 'Scheduled', 'Tomorrow, 08:00');

insert into fleet (vehicle_code, vehicle, capacity, driver, status) values
('FL-01', 'Volvo FH — Tanker A', '40,000L', 'S. Nkosi', 'On Route'),
('FL-02', 'Volvo FH — Tanker B', '40,000L', 'P. Mahlangu', 'Loading'),
('FL-03', 'Scania — Tanker C', '30,000L', 'T. Zulu', 'Available'),
('FL-04', 'Scania — Tanker D', '30,000L', null, 'Maintenance');

insert into customers (name, industry, account_value, status, contact) values
('Rustenburg Mining Group', 'Mining', 8100000, 'Active', 'M. van der Merwe'),
('Tshwane Metro', 'Government', 2900000, 'Active', 'N. Mokgatle'),
('Kgomotso Logistics', 'Logistics', 1840000, 'Active', 'K. Sebeko'),
('Agri Co-op Ltd', 'Agriculture', 620000, 'Active', 'J. Botha'),
('Vaal Transport Group', 'Logistics', 410000, 'Prospect', 'R. Naidoo');

insert into quotes (quote_number, customer, value, stage, owner) values
('Q-0410', 'Vaal Transport Group', 410000, 'Sent', 'Katlego D.'),
('Q-0411', 'Rustenburg Mining Group', 1200000, 'Negotiation', 'Katlego D.'),
('Q-0412', 'Kgomotso Logistics', 230000, 'Sent', 'Thabo M.'),
('Q-0413', 'New Prospect — Free State Grain', 890000, 'Draft', 'Katlego D.');

insert into pipeline_stages (stage, stage_order, deal_count, total_value) values
('Lead', 1, 8, 3100000),
('Qualified', 2, 5, 2400000),
('Proposal', 3, 4, 2730000),
('Negotiation', 4, 2, 1600000),
('Won', 5, 3, 4540000);
