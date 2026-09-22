# Market News (Project ORION Phase 2)

## What this is

An admin-managed content module that feeds the Dashboard's "Market
News" widget — initially the daily South African petroleum brief
(diesel, petrol, exchange rate, port delays, cross-border, refinery
updates, government notices, supply constraints), published manually.
Per the brief's explicit instruction: **no placeholder content, no
external API integration yet** — this is a real, working CRUD system
from day one, architected so it can later receive articles from an
external API or an AI-generated summary without a database or UI
redesign.

## Who can manage it

"Super Admin and authorised users," enforced with the same real,
granular RBAC layer used by Academy (`requirePermissionAction`), not
just an `isAdmin` check:

- A new `market-news` module was added to `ModuleKey`/`RbacModuleKey`
  (same precedent as `attendance`) so it can be granted independently.
- Super Admin has it automatically (part of `ALL_MODULE_KEYS`).
- Anyone else needs BOTH: the `market-news` module granted via
  **Settings → Team** (module access — the same UI used for every other
  module, no new UI needed), AND the `Manage` action granted via
  **System Access & Permissions** (or it falls back to "allowed" the
  moment they have module access and nothing's been configured yet,
  same rollout behaviour as every other RBAC-gated module in this app —
  see `docs/RBAC.md`).
- "Market News" only appears in the sidebar / dashboard module cards
  for people who actually have the module — everyone else simply
  doesn't see a link, exactly like every other module-gated nav item.

**Reading published articles is NOT gated** — the dashboard widget
shows the latest published articles to anyone with dashboard access,
the same as Live Fuel Prices. Only creating/editing/deleting is
restricted.

## Data model

`market_news_articles` (`supabase/migration_v30_market_news.sql`):

- `title`, `summary` (short teaser for the collapsed card), `body`
  (full briefing text, shown when expanded)
- `category` — one of the ten categories from the brief (Petroleum,
  Diesel, Petrol, Exchange Rate, Logistics, Cross Border, Ports,
  Government, Compliance, Internal Company News), enforced by a CHECK
  constraint
- `status` — Draft / Published / Archived. An article only appears on
  the dashboard when `status = 'Published'` AND `publish_date` has
  arrived AND (`expiry_date` is null or hasn't passed yet) — see
  `isCurrentlyPublished()` in `src/lib/market-news-core.ts`, the single
  function every reader uses so this rule can never drift between the
  widget and the admin list.
- `pinned`, `high_priority` — both affect sort order
  (`sortMarketNewsArticles()`): pinned first, then high-priority, then
  most recently published.
- `publish_date`, `expiry_date` — plain dates (not timestamps), same
  convention as `documents-core.ts`'s expiry handling.
- `attachment_url` / `attachment_name` — either an uploaded PDF's
  SharePoint `webUrl` or a plain external link, admin's choice.
- `source` — `'manual'` (everything created through today's admin UI),
  with `'api'`/`'ai'` reserved and unused. **This is the entire
  future-readiness mechanism the brief asked for**: a later automated
  ingestion pipeline (an external petroleum-market feed, an
  AI-generated summary) writes rows into this exact table with
  `source: 'api'` or `source: 'ai'`, and every existing rule —
  `isCurrentlyPublished`, sort order, the widget, the admin list —
  applies to those rows identically, with zero schema or UI change.

RLS is deny-all (service role only), same pattern as every other table
in this app — enforcement is entirely in the application layer via
`requirePermissionAction`.

## Files

- `src/lib/market-news-core.ts` / `.test.ts` — pure logic: category/
  status validation, `isCurrentlyPublished`, `sortMarketNewsArticles`,
  `validateMarketNewsInput`. Zero DB/Next dependencies, same pattern as
  `finance-core.ts` / `dashboard-widgets.ts`.
- `src/lib/market-news-data.ts` — `getPublishedMarketNews()` (public,
  used by the dashboard), `getAllMarketNewsForAdmin()` /
  `getMarketNewsArticleById()` (admin-only; the RBAC gate is enforced
  by the caller, not this file).
- `src/app/(app)/market-news/admin/` — `market-news-actions.ts` (the
  `{error?: string}`-never-throw server actions: create/update/delete/
  setStatus/togglePin/toggleHighPriority, each gated by
  `requirePermissionAction("market-news", "Manage")`), `page.tsx`,
  `market-news-admin-view.tsx`, `MarketNewsForm.tsx` (shared create/
  edit form, upload-a-PDF-or-paste-a-link attachment picker).
- `src/app/(app)/dashboard/MarketNewsCard.tsx` — the dashboard widget:
  expandable cards (click a title to reveal the full briefing inline),
  with a "Manage" link shown only to people who can actually manage it.
  Registered as the `marketNews` key in the Project ORION Phase 1
  customizable-widget system (`dashboard-widgets.ts`) — like every
  other personal widget, it's only offered when there's something to
  show (at least one currently-published article).
- SharePoint attachments reuse the existing upload plumbing
  (`uploadFileToFolder` in `graph.ts`) into a new, dedicated "Market
  News Attachments" folder — separate from the "FortunIQ Documents"
  library since these aren't document-control records (no versioning/
  classification/approval workflow).

## Known limitations / what's deliberately deferred

- No external API or AI ingestion yet (`source: 'api'`/`'ai'` are
  unused) — Phase 1 per the brief, exactly as instructed.
- No dedicated "remove attachment without replacing it" control in the
  edit form yet — an admin can replace an attachment, but not clear one
  down to none, without deleting and recreating the article.
- Department-specific news feeds (mentioned in the original brief as a
  future direction) aren't built — every article today is shown to
  everyone with dashboard access, regardless of department. The
  category field is ready to support per-department filtering later if
  that's wanted.
