# FortunIQ OS — v14 Build — RBAC Enforcement Expanded

The complete internal operating system for FortunIQ Fuels — the granular
Role-Based Access Control system now has **real, backend enforcement
across four modules**: Tenders, Documents, Academy, and Employee Hub —
not just Tenders alone. Still backed by **175 automated tests**.

## What's new in this build

- **Documents, Academy, and Employee Hub now check specific granular
  actions**, the same real, backend-enforced way Tenders already did —
  not just module-level access.
- **Employee Hub's restricted fields (banking, tax number) get their own,
  separate layer of protection** even from someone who's been granted
  general edit rights on People — "can edit this record" and "can see
  this person's bank account number" are kept genuinely distinct
  questions, checked independently.
- **A privilege-escalation safeguard**: System Access & Permissions
  itself stays Super-Admin-only no matter what granular grants someone
  else holds — nobody can use an "Edit People" permission to grant
  themselves or anyone else broader system access.
- **A consistency fix**: Academy's "Manage Content" link and the page it
  leads to now use the exact same permission check — previously the link
  could show for someone the page itself would then block.
- **An honest update to the scope note**: Finance, Operations, Customers,
  and Sales still have no Add/Edit forms at all (a separate, earlier gap
  — see `docs/EMPLOYEE_HUB.md`), so there's nothing yet to wire RBAC into
  there. See `docs/RBAC.md` for the full, current picture.

## Previous build (v13): Role-Based Access Control (RBAC)

The core RBAC engine: a granular View/Create/Edit/Delete/Approve/Export/
Manage permission matrix per module, System Access & Permissions on every
Employee Hub profile, 10 Role Templates, and real backend enforcement
first proven out on Tenders.

## Previous build (v12): Employee Hub & Tenders Add/Edit

Add/Edit forms for Employee Hub and Tenders, matching the pattern already
established for Academy, Documents, and Team Management.

## Previous build (v11): Academy Content Expansion & Admin UI

School of Corporate Excellence and School of Compliance & Governance
fully built with real content, plus an in-app Add/Edit screen for
managing Academy Schools, Courses, Lessons, and Assessments.

- **7 more real courses**, 19 more lessons, 32 more assessment questions
  — School of Corporate Excellence is now fully complete (5/5 courses),
  and School of Compliance & Governance is fully complete (5/5 courses).
- **A real Academy admin screen** at Academy → Manage Content (Super
  Admin only): add/edit Schools, add/edit/delete Courses, and — expanding
  any course — add/edit/delete its Lessons and Assessment Questions,
  right from the app. See the "Add School" / "Add Course" forms and the
  expandable per-course lesson/question editor.
- **Two schools remaining**: Petroleum Operations and Business Excellence
  and Leadership — structurally ready, content not yet written. Continuing
  next.

## Previous build (v10): Academy Schools (Skillsoft-style)

- **Five Schools**: Corporate Excellence, Compliance & Governance,
  Petroleum Operations, Business Excellence, and Leadership — a proper
  faculty structure, not a flat course list.
- **A real, video-ready course player** — every lesson has a proper
  video area that plays a real video automatically the moment one's
  added (just paste a URL), and displays clean, substantive written
  content in the meantime, not a placeholder.
- **Real, secure quiz scoring** — correct answers are never sent to the
  browser before submission; scoring happens entirely server-side.
- **Passing a course creates a real certification** on that person's
  Employee Hub profile automatically. See `docs/ACADEMY_SCHOOLS.md`.

## Previous build (v9): Employee Hub (Phase 1) & FortunIQ Intelligence

- **Employee Hub** replaces the old simple People list — a searchable,
  card-based directory, and a full profile per employee at `/people/[id]`
  covering every field from your brief: employment details, contact info,
  restricted financial data, skills, certifications, equipment, performance,
  leave balance, and system access.
- **Real, server-enforced protection on banking details and tax numbers**
  — not a UI toggle. Verified directly during development that an
  unauthorised person's browser never receives the actual values at all.
  Visible only to the employee themselves, HR/Admin, Finance, and Super
  Admin. See `docs/EMPLOYEE_HUB.md`.
- **The AI Assistant is now "FortunIQ Intelligence"** throughout the app,
  matching your brand.

## Previous build (v8): AI Security & Information Classification

- **Document classification**: every document is General, Internal,
  Confidential, or Highly Confidential. Confidential and above require
  explicit authorisation — by role, by named individual, or both — set
  by Super Admins from Documents → Manage Access. This applies to the
  Documents module itself, not just the AI. See `docs/AI_SECURITY.md`.
- **AI permission inheritance, enforced twice**: classification/role
  filtering happens before anything reaches the model, *and* a live,
  real-time SharePoint accessibility check runs using the asker's own
  Microsoft token — so the AI can never disclose something the person
  couldn't actually open themselves, even if FortunIQ OS's own records
  say otherwise.
- **A hard "exclude from AI" switch** per document — for material that
  should stay human-readable but never touch the model, regardless of
  classification or who's asking.
- **Prompt-injection defences**: retrieved document content is wrapped
  in explicit untrusted-data markers, with system-level rules against
  following instructions found inside a document.
- **The AI is architecturally read-and-assist only** — no tools, no
  function-calling, no ability to take any action. Documented human-in-
  the-loop architecture for whenever write features get built.
- **A dedicated AI Security Log**, separate from the general audit
  trail — who asked, when, which documents were in scope — deliberately
  never the prompt text or document content itself.
- **22 automated tests** covering every classification level against
  every role, including the exact HR/payroll scenario. See `docs/AI_SECURITY.md`.

## Previous build (v7): Roles, Audit Logs & Security Hardening

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
   `migration_v2...` through `migration_v12...` files if adding to an
   existing setup, in numeric order
2. **Microsoft Login** — `docs/MICROSOFT_LOGIN_SETUP.md`
3. **Admin & Permissions** — `docs/PERMISSIONS_SETUP.md`, then
   `docs/ROLES_AND_PERMISSIONS.md` for how the six roles work, then
   `docs/RBAC.md` for the granular per-module permission system
4. **SharePoint** — `docs/SHAREPOINT_SETUP.md`
5. **Security** — `docs/SECURITY.md` (includes MFA setup — do this one,
   it's quick and important)
6. **AI Assistant** (optional) — `docs/AI_ASSISTANT_SETUP.md`, then
   **`docs/AI_SECURITY.md`** — read this one before turning the AI
   Assistant on for your whole team, since it explains exactly what the
   AI can and can't see and how document classification works
7. Copy `.env.local.example` to `.env.local` and fill in your values,
   **including `SUPABASE_SERVICE_ROLE_KEY`**
8. `npm install && npm run dev`

Every piece degrades gracefully if not yet connected — the app never
crashes, it just shows placeholder data or a friendly "not connected yet"
message until each integration is wired up.

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

105 tests verify every role sees exactly the modules it should (see
`docs/ROLES_AND_PERMISSIONS.md`), 22 verify document classification and
AI access control (see `docs/AI_SECURITY.md`), 11 verify restricted
employee data access — banking and tax details (see
`docs/EMPLOYEE_HUB.md`), 7 verify Academy quiz scoring (see
`docs/ACADEMY_SCHOOLS.md`), and 30 verify the granular RBAC system,
including your exact worked examples (see `docs/RBAC.md`) — **175 in
total**, running in well under two seconds. All docs also include a
"Manual verification checklist" for the parts that genuinely need a
real, live account to confirm — automated tests can't replace that
entirely, only reduce how often you need to redo it.

## What's real vs. what's still a placeholder

- **All UI, layout, navigation, and styling is real, working code**, across
  all 12 business modules plus Audit Logs.
- **Data is real**, once Supabase is connected.
- **Sign-in is real Microsoft 365 authentication**, with real, tested
  role-based permissions on top.
- **The AI Assistant makes real calls to Claude**, once an Anthropic API
  key is added — it isn't a scripted demo.
- **Documents is genuinely SharePoint-backed** — see `docs/SHAREPOINT_SETUP.md`.
- **The AI Assistant respects document classification and real Microsoft
  permissions** — see `docs/AI_SECURITY.md`. This isn't prompt wording;
  it's enforced in code before the model is ever called.
- **Audit logging is real** for the actions that can currently happen
  in-app (sign-ins, permission changes, document actions, Academy content
  changes, employee and tender edits) — see `docs/AUDIT_LOGS.md`.
- **In-app Add/Edit now exists for**: Team Management, Documents
  (classification/status), Academy (Schools/Courses/Lessons/Questions),
  **Employee Hub** (full profile, equipment, certifications), and
  **Tenders**. See `docs/ADD_EDIT_COVERAGE.md` for exactly which pages
  have this and which still need Supabase's Table Editor directly.
- **Not yet built**: Add/Edit for Finance, Operations, Customers, and
  Sales (still uses Supabase's Table Editor directly), a live Power
  BI/Metabase embed (Reports has its own built-in charts), and a general
  file upload feature (SharePoint governs its own uploads for now).

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
    ai-security-core.ts        → pure, unit-tested document classification/authorisation logic
    ai-security-core.test.ts   → 22 automated tests covering classification × role scenarios
    ai-security.ts              → logAISecurityEvent() — the AI-specific security log
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
  migration_v7_ai_security.sql               → document classification + ai_security_logs table
  migration_v8_employee_hub.sql               → Employee Directory, full profiles, restricted fields
  SETUP.md                                  → step-by-step guide
docs/
  MICROSOFT_LOGIN_SETUP.md    → step-by-step guide
  PERMISSIONS_SETUP.md         → step-by-step guide (first Admin bootstrap)
  ROLES_AND_PERMISSIONS.md      → the six roles, the full access matrix, testing
  AUDIT_LOGS.md                 → what's logged, what isn't, and why
  SECURITY.md                    → session expiry, MFA setup, RLS, rate limiting, API keys
  SHAREPOINT_SETUP.md            → step-by-step guide
  AI_ASSISTANT_SETUP.md           → step-by-step guide
  AI_SECURITY.md                   → the full AI security architecture, requirement-by-requirement
  EMPLOYEE_HUB.md                    → what Phase 1 built, restricted field security, and the full roadmap
  RBAC.md                             → granular permissions, role templates, and the honest scope of real enforcement
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
