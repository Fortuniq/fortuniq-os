# FortunIQ OS — v3 Build

Internal operating system for FortunIQ Fuels. Built with **React, Next.js (App Router), TypeScript, Tailwind CSS, Supabase, and Microsoft Login (Entra ID / Auth.js v5).**

This build covers **5 of the planned 12 modules**, each database-connected, and now sits behind **real Microsoft 365 authentication** — nobody can see any page without signing in with a genuine FortunIQ Fuels Microsoft account.

## What's in this build

| Module | Status |
|---|---|
| Dashboard | ✅ Built, database-connected |
| People | ✅ Built, database-connected |
| Academy | ✅ Built, database-connected |
| Documents | ✅ Built, database-connected |
| Tenders | ✅ Built, database-connected |
| Finance / Operations / Customers / Sales / Reports / AI Assistant / Settings | Not built |

## Setup, in order

1. **Database** — see `supabase/SETUP.md` (create tables, add starter data)
2. **Microsoft Login** — see `docs/MICROSOFT_LOGIN_SETUP.md` (register the app, get your credentials)
3. Copy `.env.local.example` to `.env.local` and fill in both sets of values
4. `npm install && npm run dev`

**Until both are set up**, the app still runs — data falls back to realistic
placeholders, and if no Microsoft credentials are present, the sign-in
button will show an error when clicked (expected, until Part 1 of the
Microsoft Login guide is complete).

## Running it locally

You'll need [Node.js](https://nodejs.org) 18+ installed.

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**.

## What's real vs. what's still a placeholder

- **All UI, layout, navigation, and styling is real, working code.**
- **Data is real**, once Supabase is connected — editable directly in Supabase's Table Editor, with Row Level Security already configured.
- **Sign-in is real Microsoft 365 authentication**, once the Entra ID app registration is complete — restricted to your own organisation's accounts only, nobody else can sign in.
- **The floating AI button** links to `/ai`, which doesn't exist yet.

## Project structure

```
src/
  app/
    (app)/               → every page that requires sign-in (dashboard, people, academy, ...)
    auth/signin/          → the standalone Microsoft sign-in page (no sidebar/topbar)
    api/auth/              → Auth.js's login/logout/callback handling
    actions.ts             → sign-out server action
  components/
    layout/               → Sidebar, TopBar, AppShell
    ui/                   → Card, Badge, StatCard, DataTable, PageHeader
  lib/
    nav.ts                → the 12-module sidebar configuration
    data.ts               → the data access layer — tries Supabase, falls back to mock data
    mock-data.ts          → placeholder data, used automatically until Supabase is connected
    format.ts             → currency/date formatting helpers
    supabase/              → Supabase client setup (browser + server)
  auth.ts                 → Microsoft Login configuration
  proxy.ts                 → route protection — redirects signed-out visitors to /auth/signin
  fonts/                  → Montserrat & Inter, self-hosted (brand fonts)
public/brand/             → your approved logo files
supabase/
  schema.sql               → run this first, in Supabase's SQL Editor
  seed.sql                 → run this second, to populate starter data
  SETUP.md                  → full step-by-step guide
docs/
  MICROSOFT_LOGIN_SETUP.md  → full step-by-step guide for real Microsoft sign-in
```

## Brand system

Colors, fonts, and logo are pulled directly from the approved FortunIQ Fuels brand identity — near-black (`#1c1b1c`), flame-orange (`#F05A28`), Montserrat for display type, Inter for body text.

## Adding one of the remaining modules

1. Add a table to `supabase/schema.sql` (and a matching `get...()` function to `src/lib/data.ts`, following the existing pattern — try Supabase, fall back to mock data).
2. Create `src/app/<module-name>/page.tsx` (server component, calls the data function) and `<module-name>-view.tsx` (the actual UI, receives data as props).
3. Compose the view from the existing shared components: `PageHeader`, `StatCard`, `Card`/`CardHeader`/`CardBody`, `DataTable`, `Badge`.

The sidebar link already exists for every module in `src/lib/nav.ts`.
