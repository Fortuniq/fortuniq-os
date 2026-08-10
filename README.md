# FortunIQ OS — v7 Build — Roles, Audit Logs & Security Hardening

The complete internal operating system for FortunIQ Fuels — now with a
proper **role-based permission system** (Super Admin, Management,
HR/Admin, Finance, Sales/Marketing, Employee), **real audit logging**,
and a full **security hardening pass**, backed by **105 automated tests**
verifying every role sees exactly what it should — nothing more.

Built with **React, Next.js (App Router), TypeScript, Tailwind CSS,
Supabase, Microsoft Login (Entra ID), Microsoft Graph API, Claude for the
AI Assistant, and Vitest for automated testing.**

## What's new in this build

- **Six named, documented roles** replace the old simple admin/non-admin
  toggle — see `docs/ROLES_AND_PERMISSIONS.md` for the full reasoning and
  access matrix. Assigning a role in Team Management sets sensible
  defaults immediately; individual exceptions are still possible.
- **105 automated tests** verify the entire permission system — every
  role against every module — including your exact requirements: Finance
  can't see People, Sales/Marketing can't see Finance, Employee (interns)
  has no path to admin. Run `npm test` any time.
- **Real audit logging**: sign-ins, role/permission changes, document
  status changes, and document views are all recorded and visible to
  Super Admin and HR/Admin only, at the new Audit Logs page. See
  `docs/AUDIT_LOGS.md` for exactly what is and isn't captured, and why.
- **Security hardening**: 8-hour session expiry, deliberately-hardened
  Row Level Security on every table (a real gap found and fixed, not just
  reviewed), rate limiting on the AI Assistant, an environment-variable
  audit (one real bug found and fixed), and step-by-step MFA setup
  instructions. Full details in `docs/SECURITY.md`.

## Setup, in order

1. **Database** — `supabase/SETUP.md` (first time) or the individual
   `migration_v2...` through `migration_v6...` files if adding to an
   existing setup, in numeric order
2. **Microsoft Login** — `docs/MICROSOFT_LOGIN_SETUP.md`
3. **Admin & Permissions** — `docs/PERMISSIONS_SETUP.md`, then
   `docs/ROLES_AND_PERMISSIONS.md` for how the six roles work
4. **SharePoint** — `docs/SHAREPOINT_SETUP.md`
5. **Security** — `docs/SECURITY.md` (includes MFA setup — do this one,
   it's quick and important)
6. **AI Assistant** (optional) — `docs/AI_ASSISTANT_SETUP.md`
5. Copy `.env.local.example` to `.env.local` and fill in your values,
   **including the new `SUPABASE_SERVICE_ROLE_KEY`**
6. `npm install && npm run dev`

## Important technical note

FortunIQ OS uses Microsoft Login for authentication, not Supabase's own
login system. That means Supabase itself never "sees" your users as
signed in, so any database rule written as "allow authenticated users"
was actually blocking real access when checked that way. The fix:
server-side code now uses a separate, private **service role key** that
bypasses those checks entirely, and all real access control happens in
the app itself — first via Microsoft Login, then via the new permissions
system. This is why `.env.local` now needs one more value than before
(`SUPABASE_SERVICE_ROLE_KEY`) — find it in Supabase under Settings → API.
This key is powerful (full database access) and must never be shared
publicly or committed anywhere visible — treat it like a master password.

## What's in this build

| Module | Status |
|---|---|
| Dashboard | ✅ Built, database-connected |
| People | ✅ Built, database-connected |
| Academy | ✅ Built, database-connected |
| Documents | ✅ Built, database-connected |
| Tenders | ✅ Built, database-connected |
| Finance | ✅ Built, database-connected |
| Operations | ✅ Built, database-connected |
| Customers | ✅ Built, database-connected |
| Sales | ✅ Built, database-connected |
| Reports | ✅ Built, cross-module analytics |
| AI Assistant | ✅ Built, real Claude-powered chat |
| Settings | ✅ Built, live integration status |

The whole app sits behind real Microsoft 365 sign-in — nobody outside your
organisation can access any page or data.

## Setup, in order

1. **Database** — see `supabase/SETUP.md` (first time) or
   `supabase/migration_v2_add_7_modules.sql` (if you already set up the
   database for the first 5 modules — this adds just the new tables,
   no risk of "already exists" errors)
2. **Microsoft Login** — see `docs/MICROSOFT_LOGIN_SETUP.md`
3. **AI Assistant** (optional) — see `docs/AI_ASSISTANT_SETUP.md`
4. Copy `.env.local.example` to `.env.local` and fill in your values
5. `npm install && npm run dev`

Every piece degrades gracefully if not yet connected — the app never
crashes, it just shows placeholder data or a friendly "not connected yet"
message until each integration is wired up.

## Running it locally

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**.

## Running the automated tests

```bash
npm test
```

105 tests, running in well under a second, verifying every role sees
exactly the modules it should. See `docs/ROLES_AND_PERMISSIONS.md` for
what these tests cover and what they can't tell you (a real, live
walkthrough is still worth doing once — see that doc's "Manual
verification checklist").

## What's real vs. what's still a placeholder

- **All UI, layout, navigation, and styling is real, working code**, across
  all 12 business modules plus Audit Logs.
- **Data is real**, once Supabase is connected.
- **Sign-in is real Microsoft 365 authentication**, with real, tested
  role-based permissions on top.
- **The AI Assistant makes real calls to Claude**, once an Anthropic API
  key is added — it isn't a scripted demo.
- **Documents is genuinely SharePoint-backed** — see `docs/SHAREPOINT_SETUP.md`.
- **Audit logging is real** for the actions that can currently happen
  in-app (sign-ins, permission changes, document actions) — see
  `docs/AUDIT_LOGS.md` for the honest gap around customer/employee record
  changes, which needs Add/Edit forms to exist first.
- **Not yet built**: in-app Add/Edit forms for People/Customers/etc.
  (still uses Supabase's Table Editor directly), a live Power BI/Metabase
  embed (Reports has its own built-in charts), and a general file upload
  feature (SharePoint governs its own uploads for now).

## Project structure

```
src/
  app/
    (app)/                → every page that requires sign-in
      dashboard/ people/ academy/ documents/ tenders/
      finance/ operations/ customers/ sales/ reports/ ai/ audit/ settings/
    auth/signin/            → standalone Microsoft sign-in page
    auth/pending/           → shown to signed-in people an Admin hasn't provisioned yet
    api/
      auth/                 → Auth.js login/logout/callback handling
      ai/chat/               → the AI Assistant's backend, calls Claude
      sharepoint/             → SharePoint browse/search/preview/versions
    actions.ts               → sign-out server action
  components/
    layout/                 → Sidebar, TopBar, AppShell
    ui/                     → Card, Badge, StatCard, DataTable, PageHeader
  lib/
    nav.ts                  → the sidebar configuration
    data.ts                 → data access layer — tries Supabase, falls back to mock data
    mock-data.ts             → placeholder data
    format.ts                → currency/date formatting helpers
    supabase/                → Supabase client setup (browser, server, and privileged service-role)
    graph.ts                 → Microsoft Graph API client (SharePoint), delegated per-user
    permissions-core.ts       → pure, unit-tested role/module logic — no auth or database dependency
    permissions.ts            → session-aware permission checks, built on permissions-core.ts
    permissions.test.ts       → 105 automated tests — run with `npm test`
    audit.ts                  → the logAudit() helper used throughout the app
    rate-limit.ts             → Supabase-backed rate limiting, used by the AI Assistant
  auth.ts                   → Microsoft Login configuration, session expiry, sign-in audit logging
  middleware.ts               → route protection (kept as "middleware", not renamed to "proxy" —
                                 the new Next.js 16 name breaks on Netlify; see the file's own comments)
  fonts/                    → Montserrat & Inter, self-hosted
public/brand/               → approved logo files
supabase/
  schema.sql                              → full schema (first-time setup)
  seed.sql                                 → full starter data (first-time setup)
  migration_v2_add_7_modules.sql           → Finance/Operations/Customers/Sales tables
  migration_v3_add_permissions.sql          → the original admin/permissions table
  migration_v4_add_sharepoint.sql           → SharePoint metadata columns on Documents
  migration_v5_add_roles_and_audit.sql      → the six named roles + audit_logs table
  migration_v6_security_hardening.sql        → deliberate RLS deny-all + rate limiting table
  SETUP.md                                  → step-by-step guide
docs/
  MICROSOFT_LOGIN_SETUP.md    → step-by-step guide
  PERMISSIONS_SETUP.md         → step-by-step guide (first Admin bootstrap)
  ROLES_AND_PERMISSIONS.md      → the six roles, the full access matrix, testing
  AUDIT_LOGS.md                 → what's logged, what isn't, and why
  SECURITY.md                    → session expiry, MFA setup, RLS, rate limiting, API keys
  SHAREPOINT_SETUP.md            → step-by-step guide
  AI_ASSISTANT_SETUP.md           → step-by-step guide
```

## Brand system

Colors, fonts, and logo are pulled directly from the approved FortunIQ
Fuels brand identity — near-black (`#1c1b1c`), flame-orange (`#F05A28`),
Montserrat for display type, Inter for body text.

## What's genuinely left to do

This is a complete, working v1 of every module — not a finished ERP. A few
honest next steps worth knowing about:

- **Add/Edit forms**: right now, adding a new invoice, tender, or customer
  means using Supabase's Table Editor directly. Building proper in-app
  forms is the natural next step so your team never needs to open Supabase.
- **Real SharePoint integration**: Documents currently tracks metadata
  (name, version, owner) but doesn't store or serve actual files yet.
- **Role-based permissions**: everyone signed in can currently see and
  edit everything. Restricting, say, Finance data to the Finance team is a
  policy change in Supabase, not a rebuild — but it isn't done yet.
- **The AI Assistant doesn't yet read your live data** — it answers from
  what you type it, not automatically from your real tenders/invoices. See
  `docs/AI_ASSISTANT_SETUP.md` for more on this.
