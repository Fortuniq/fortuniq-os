# FortunIQ OS — v6 Build — SharePoint Document Management

The complete internal operating system for FortunIQ Fuels — now with
**SharePoint as its real document management system.** Actual files live
in SharePoint; FortunIQ OS stores only metadata and a link, and every
document request uses each signed-in person's own Microsoft identity —
if someone can't open a file in SharePoint, they can't see it here either.

Built with **React, Next.js (App Router), TypeScript, Tailwind CSS,
Supabase, Microsoft Login (Entra ID), Microsoft Graph API, and Claude for
the AI Assistant.**

## What's new in this build

- **Documents is now genuinely SharePoint-backed**: browse your SharePoint
  library from inside FortunIQ OS, catalogue files with one click, preview
  them in-app, view SharePoint's own version history, and search across
  the whole library — all using your own real Microsoft permissions.
- **Draft / Approved / Archived status** on every document, set right from
  the Documents table.
- **The AI Assistant now knows about your Approved documents** — it can
  reference them by name always, and read the actual content of
  plain-text approved files directly (Word/PDF/Excel content-reading is a
  documented next step, not yet built — see `docs/SHAREPOINT_SETUP.md`).

## Setup, in order

1. **Database** — `supabase/SETUP.md` (first time) or the individual
   `migration_v2...` / `migration_v3...` files if adding to an existing setup
2. **Microsoft Login** — `docs/MICROSOFT_LOGIN_SETUP.md`
3. **Admin & Permissions** — `docs/PERMISSIONS_SETUP.md` (do this right
   after connecting the database — the first person to sign in becomes Admin)
4. **SharePoint** — `docs/SHAREPOINT_SETUP.md` (needed for Documents to
   show real files, previews, and version history)
5. **AI Assistant** (optional) — `docs/AI_ASSISTANT_SETUP.md`
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

## What's real vs. what's still a placeholder

- **All UI, layout, navigation, and styling is real, working code**, across
  all 12 modules.
- **Data is real**, once Supabase is connected.
- **Sign-in is real Microsoft 365 authentication.**
- **The AI Assistant makes real calls to Claude**, once an Anthropic API
  key is added — it isn't a scripted demo.
- **Not yet built**: SharePoint document storage (Documents currently
  stores metadata only, not actual files), and a live Power BI/Metabase
  embed (Reports has its own built-in charts now, but an external BI tool
  connecting directly to the database is a good next step for deeper
  analysis).

## Project structure

```
src/
  app/
    (app)/                → every page that requires sign-in
      dashboard/ people/ academy/ documents/ tenders/
      finance/ operations/ customers/ sales/ reports/ ai/ settings/
    auth/signin/            → standalone Microsoft sign-in page
    api/
      auth/                 → Auth.js login/logout/callback handling
      ai/chat/               → the AI Assistant's backend, calls Claude
    actions.ts               → sign-out server action
  components/
    layout/                 → Sidebar, TopBar, AppShell
    ui/                     → Card, Badge, StatCard, DataTable, PageHeader
  lib/
    nav.ts                  → the 12-module sidebar configuration
    data.ts                 → data access layer — tries Supabase, falls back to mock data
    mock-data.ts             → placeholder data
    format.ts                → currency/date formatting helpers
    supabase/                → Supabase client setup (browser + server)
  auth.ts                   → Microsoft Login configuration
  proxy.ts                   → route protection
  fonts/                    → Montserrat & Inter, self-hosted
public/brand/               → approved logo files
supabase/
  schema.sql                       → full schema (first-time setup)
  seed.sql                          → full starter data (first-time setup)
  migration_v2_add_7_modules.sql    → adds only the 7 new modules' tables
  SETUP.md                          → step-by-step guide
docs/
  MICROSOFT_LOGIN_SETUP.md   → step-by-step guide
  AI_ASSISTANT_SETUP.md       → step-by-step guide
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
