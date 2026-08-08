# FortunIQ OS — v2 Build

Internal operating system for FortunIQ Fuels. Built with the stack you specified: **React, Next.js (App Router), TypeScript, Tailwind CSS, Supabase.**

This build covers **5 of the planned 12 modules**, and every one of them now runs on a **real database** (Supabase/PostgreSQL), not mock data. The remaining 7 modules (Finance, Operations, Customers, Sales, Reports, AI Assistant, Settings) follow the same patterns established here.

## What's in this build

| Module | Status |
|---|---|
| Dashboard | ✅ Built, database-connected |
| People | ✅ Built, database-connected |
| Academy | ✅ Built, database-connected |
| Documents | ✅ Built, database-connected |
| Tenders | ✅ Built, database-connected |
| Finance | Not built |
| Operations | Not built |
| Customers | Not built |
| Sales | Not built |
| Reports | Not built |
| AI Assistant | Not built |
| Settings | Not built |

## Connecting the database (do this first)

**See `supabase/SETUP.md` for the full 10-minute walkthrough.** Short version:

1. Create a free project at supabase.com
2. Run `supabase/schema.sql` then `supabase/seed.sql` in Supabase's SQL Editor
3. Copy `.env.local.example` to `.env.local` and fill in your project's URL and key

**Until you do this, the app keeps working using realistic mock data** — every page tries Supabase first, and gracefully falls back to the same placeholder data you've already seen if no database is connected yet. Nothing breaks either way.

## Running it locally

You'll need [Node.js](https://nodejs.org) 18+ installed.

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**.

## What's real vs. what's still a placeholder

- **All UI, layout, navigation, and styling is real, working code.**
- **Data is now real**, once you've completed the Supabase setup above — editable directly in Supabase's Table Editor, with proper security rules (Row Level Security) already configured.
- **"Signed in via Microsoft"** in the top bar is still a visual placeholder — that's the next piece to wire up (needs your Microsoft 365 admin to register the app in Entra ID).
- **The floating AI button** links to `/ai`, which doesn't exist yet.

## Project structure

```
src/
  app/                  → one folder per module; each has page.tsx (fetches data) + a -view.tsx (renders it)
  components/
    layout/             → Sidebar, TopBar, AppShell
    ui/                 → Card, Badge, StatCard, DataTable, PageHeader
  lib/
    nav.ts              → the 12-module sidebar configuration
    data.ts             → the data access layer — tries Supabase, falls back to mock data
    mock-data.ts        → placeholder data, used automatically until Supabase is connected
    format.ts           → currency/date formatting helpers
    supabase/           → Supabase client setup (browser + server)
  fonts/                → Montserrat & Inter, self-hosted (brand fonts)
public/brand/           → your approved logo files
supabase/
  schema.sql            → run this first, in Supabase's SQL Editor
  seed.sql              → run this second, to populate starter data
  SETUP.md              → full step-by-step guide
```

## Brand system

Colors, fonts, and logo are pulled directly from the approved FortunIQ Fuels brand identity — near-black (`#1c1b1c`), flame-orange (`#F05A28`), Montserrat for display type, Inter for body text.

## Adding one of the remaining modules

1. Add a table to `supabase/schema.sql` (and a matching `get...()` function to `src/lib/data.ts`, following the existing pattern — try Supabase, fall back to mock data).
2. Create `src/app/<module-name>/page.tsx` (server component, calls the data function) and `<module-name>-view.tsx` (the actual UI, receives data as props).
3. Compose the view from the existing shared components: `PageHeader`, `StatCard`, `Card`/`CardHeader`/`CardBody`, `DataTable`, `Badge`.

The sidebar link already exists for every module in `src/lib/nav.ts`.
