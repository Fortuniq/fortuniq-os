-- =========================================================================
-- FortunIQ OS — Migration: Admin & Permissions System
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
-- This adds one new table that controls who can sign in and what each
-- person can see.
--
-- IMPORTANT: after running this, the FIRST person to sign in via Microsoft
-- automatically becomes the first Admin, with access to every module.
-- That should be you. From then on, only Admins can add people or change
-- anyone's access, from Settings -> Team Management in the app.
-- =========================================================================

create table user_permissions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  is_admin boolean not null default false,
  allowed_modules text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Row Level Security is enabled for defense-in-depth, but note that the
-- app itself talks to this table using a privileged service-role
-- connection that bypasses these policies (see src/lib/supabase/service.ts
-- for why). These policies matter only if the public anon key is ever
-- used directly against this table.
alter table user_permissions enable row level security;

create policy "No public access to permissions" on user_permissions
  for all using (false);
