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

create policy "Authenticated read employees" on employees for select using (auth.role() = 'authenticated');
create policy "Authenticated write employees" on employees for all using (auth.role() = 'authenticated');

create policy "Authenticated read courses" on courses for select using (auth.role() = 'authenticated');
create policy "Authenticated write courses" on courses for all using (auth.role() = 'authenticated');

create policy "Authenticated read learning_paths" on learning_paths for select using (auth.role() = 'authenticated');
create policy "Authenticated write learning_paths" on learning_paths for all using (auth.role() = 'authenticated');

create policy "Authenticated read documents" on documents for select using (auth.role() = 'authenticated');
create policy "Authenticated write documents" on documents for all using (auth.role() = 'authenticated');

create policy "Authenticated read tenders" on tenders for select using (auth.role() = 'authenticated');
create policy "Authenticated write tenders" on tenders for all using (auth.role() = 'authenticated');

create policy "Authenticated read tender_checklist_items" on tender_checklist_items for select using (auth.role() = 'authenticated');
create policy "Authenticated write tender_checklist_items" on tender_checklist_items for all using (auth.role() = 'authenticated');

create policy "Authenticated read tasks" on tasks for select using (auth.role() = 'authenticated');
create policy "Authenticated write tasks" on tasks for all using (auth.role() = 'authenticated');

create policy "Authenticated read notifications" on notifications for select using (auth.role() = 'authenticated');
create policy "Authenticated write notifications" on notifications for all using (auth.role() = 'authenticated');

create policy "Authenticated read fuel_prices" on fuel_prices for select using (auth.role() = 'authenticated');
create policy "Authenticated write fuel_prices" on fuel_prices for all using (auth.role() = 'authenticated');
