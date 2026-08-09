// Service-role Supabase client — for trusted server-side code only.
//
// Why this exists: FortunIQ OS handles its own sign-in via Microsoft Login
// (Auth.js), not Supabase's own authentication system. That means Supabase
// never sees your users as "authenticated" from its own point of view, so
// any table policy written as `using (auth.role() = 'authenticated')` was
// silently blocking real access when queried with the public anon key.
//
// The fix: server-side code (page.tsx files, API routes) uses this
// service-role client instead, which bypasses Row Level Security entirely.
// Real access control now happens in Next.js itself — the proxy.ts route
// protection, plus the permissions system in lib/permissions.ts — before
// any Supabase query is ever made. This key must NEVER be exposed to the
// browser (it has full database access) — that's why it deliberately has
// no NEXT_PUBLIC_ prefix, and this file must only ever be imported from
// server-side code (page.tsx, route.ts, or files under lib/ called by them).
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}
