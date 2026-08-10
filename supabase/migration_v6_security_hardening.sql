-- =========================================================================
-- FortunIQ OS — Migration: Security Hardening
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after the earlier migrations.
--
-- WHAT THIS FIXES:
-- Most tables were protected by a policy like:
--   using (auth.role() = 'authenticated')
-- This happened to work correctly, but only by accident of how FortunIQ OS
-- is built: because sign-in happens through Microsoft (Auth.js), not
-- Supabase's own authentication system, requests using the public anon
-- key are never actually "authenticated" from Supabase's point of view —
-- so this policy was always evaluating to false and blocking access,
-- which is the right outcome, but for a coincidental reason rather than a
-- deliberate one.
--
-- This migration replaces every one of those policies with an explicit,
-- unambiguous "using (false)" — deny all access via the public anon key,
-- full stop — on every table. This is exactly the same real-world result,
-- but it no longer depends on that coincidence, so it stays correct even
-- if Supabase's behaviour or your setup changes later.
--
-- None of this affects the app itself: all real reads and writes already
-- go through a separate, private service-role connection
-- (src/lib/supabase/service.ts) that bypasses these policies entirely —
-- see docs/SECURITY.md for the full explanation of why that's the
-- correct design here, not a workaround.
-- =========================================================================

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'employees', 'courses', 'learning_paths', 'documents', 'tenders',
      'tender_checklist_items', 'tasks', 'notifications', 'fuel_prices',
      'invoices', 'expenses', 'suppliers', 'fuel_orders', 'fleet',
      'customers', 'quotes', 'pipeline_stages'
    ])
  loop
    execute format('drop policy if exists "Authenticated read %s" on %I;', t, t);
    execute format('drop policy if exists "Authenticated write %s" on %I;', t, t);
    execute format('drop policy if exists "No public access to %s" on %I;', t, t);
    execute format('create policy "No public access to %s" on %I for all using (false);', t, t);
  end loop;
end $$;

-- ---------- RATE LIMITING ----------
-- Backs a simple per-person request counter for rate-limited endpoints
-- (currently the AI Assistant — see src/lib/rate-limit.ts). Old rows are
-- cheap to leave in place; a periodic cleanup isn't required for this to
-- work correctly, but you could add one later if the table grows large.
create table rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_events_lookup_idx on rate_limit_events (actor_email, bucket, created_at);

alter table rate_limit_events enable row level security;
create policy "No public access to rate_limit_events" on rate_limit_events for all using (false);
