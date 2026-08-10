-- =========================================================================
-- FortunIQ OS — Database Schema
-- =========================================================================
-- HOW TO USE:
-- 1. Create a Supabase project at supabase.com (see /supabase/SETUP.md)
-- 2. Open your project's SQL Editor (left sidebar)
-- 3. Paste this entire file and click "Run"
-- 4. Then paste and run seed.sql
-- =========================================================================

create table employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  dept text not null,
  type text not null check (type in ('Employee', 'Intern')),
  status text not null check (status in ('Active', 'Onboarding', 'On Leave', 'Terminated')),
  start_date date not null,
  email text,
  created_at timestamptz default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  modules int not null default 0,
  duration text,
  enrolled int not null default 0,
  completion int not null default 0 check (completion between 0 and 100),
  created_at timestamptz default now()
);

create table learning_paths (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  course_count int not null default 0,
  for_role text,
  created_at timestamptz default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  version text,
  owner text,
  file_url text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table tenders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  title text not null,
  closing_date date not null,
  status text not null check (status in ('Open', 'Awarded', 'Lost')),
  stage text,
  value numeric(14, 2) not null default 0,
  compliance int not null default 0 check (compliance between 0 and 100),
  created_at timestamptz default now()
);

create table tender_checklist_items (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid references tenders(id) on delete cascade,
  item text not null,
  done boolean not null default false,
  created_at timestamptz default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_label text,
  priority text check (priority in ('High', 'Medium', 'Low')),
  owner text,
  done boolean not null default false,
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  type text,
  created_at timestamptz default now()
);

create table fuel_prices (
  id uuid primary key default gen_random_uuid(),
  product text not null,
  price numeric(6, 2) not null,
  change numeric(5, 2) not null default 0,
  updated_at timestamptz default now()
);

-- =========================================================================
-- ROW LEVEL SECURITY
-- Internal tool: any authenticated (logged-in) user can read and write.
-- Tighten per-table once role-based permissions are needed.
-- =========================================================================

alter table employees enable row level security;
alter table courses enable row level security;
alter table learning_paths enable row level security;
alter table documents enable row level security;
alter table tenders enable row level security;
alter table tender_checklist_items enable row level security;
alter table tasks enable row level security;
alter table notifications enable row level security;
alter table fuel_prices enable row level security;

create policy "No public access to employees" on employees for all using (false);

create policy "No public access to courses" on courses for all using (false);

create policy "No public access to learning_paths" on learning_paths for all using (false);

create policy "No public access to documents" on documents for all using (false);

create policy "No public access to tenders" on tenders for all using (false);

create policy "No public access to tender_checklist_items" on tender_checklist_items for all using (false);

create policy "No public access to tasks" on tasks for all using (false);

create policy "No public access to notifications" on notifications for all using (false);

create policy "No public access to fuel_prices" on fuel_prices for all using (false);

-- ---------- FINANCE ----------
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

-- ---------- OPERATIONS ----------
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

-- ---------- CUSTOMERS ----------
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  account_value numeric(14, 2) not null default 0,
  status text not null default 'Active',
  contact text,
  created_at timestamptz default now()
);

-- ---------- SALES ----------
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

-- ---------- SECURITY ----------
alter table invoices enable row level security;
alter table expenses enable row level security;
alter table suppliers enable row level security;
alter table fuel_orders enable row level security;
alter table fleet enable row level security;
alter table customers enable row level security;
alter table quotes enable row level security;
alter table pipeline_stages enable row level security;

create policy "No public access to invoices" on invoices for all using (false);

create policy "No public access to expenses" on expenses for all using (false);

create policy "No public access to suppliers" on suppliers for all using (false);

create policy "No public access to fuel_orders" on fuel_orders for all using (false);

create policy "No public access to fleet" on fleet for all using (false);

create policy "No public access to customers" on customers for all using (false);

create policy "No public access to quotes" on quotes for all using (false);

create policy "No public access to pipeline_stages" on pipeline_stages for all using (false);
