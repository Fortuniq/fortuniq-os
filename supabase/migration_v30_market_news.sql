-- =========================================================================
-- FortunIQ OS — Migration: Market News module
-- (Project ORION, "My Workspace" redesign, Phase 2)
-- =========================================================================
-- Run this ONCE in your Supabase SQL Editor, after migration_v29.
-- See docs/MARKET_NEWS.md for the full design.
--
-- Admin-managed content module (create/edit/delete/pin/categorise/
-- publish+expiry dates/high-priority/PDF-or-link attachments), built to
-- be the dashboard widget's content source now, and to later accept
-- external-API or AI-generated articles WITHOUT a schema or UI redesign
-- — see the `source` column below, and the module comment at the top of
-- src/lib/market-news-core.ts.
-- =========================================================================

create table if not exists market_news_articles (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  summary text not null,       -- short teaser shown on the collapsed dashboard card
  body text not null,          -- full briefing text, shown when the card is expanded

  category text not null check (category in (
    'Petroleum', 'Diesel', 'Petrol', 'Exchange Rate', 'Logistics',
    'Cross Border', 'Ports', 'Government', 'Compliance', 'Internal Company News'
  )),
  status text not null default 'Draft' check (status in ('Draft', 'Published', 'Archived')),

  pinned boolean not null default false,
  high_priority boolean not null default false,

  publish_date date not null default current_date,
  expiry_date date,             -- null = never expires on its own

  attachment_url text,          -- either a SharePoint file's webUrl (uploaded PDF) or an external link
  attachment_name text,

  -- Future-automation readiness (Phase 2 of the brief): every article
  -- created through today's admin UI is 'manual'. 'api' and 'ai' are not
  -- written by any code yet, but exist so a later ingestion pipeline can
  -- insert rows here directly — the dashboard widget and admin list
  -- already read every row the same way regardless of source.
  source text not null default 'manual' check (source in ('manual', 'api', 'ai')),
  external_source_name text,    -- e.g. a future feed/provider name — unused today

  created_by_email text,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_news_articles_status_publish_idx
  on market_news_articles (status, publish_date desc);
create index if not exists market_news_articles_category_idx
  on market_news_articles (category);

alter table market_news_articles enable row level security;
create policy "No public access to market_news_articles" on market_news_articles for all using (false);

comment on table market_news_articles is
  'Admin-managed Market News content (FortunIQ Intelligence news widget). CRUD is gated by requirePermissionAction("market-news", "Manage") in market-news-actions.ts — Super Admin plus anyone explicitly granted the "market-news" module + Manage action (see docs/RBAC.md). Reading PUBLISHED articles for the dashboard widget is open to anyone with dashboard access, same as fuel prices — see getPublishedMarketNews() in market-news-data.ts. "Currently published" is never just status = Published — always go through isCurrentlyPublished()/filterPublishedArticles() in src/lib/market-news-core.ts, which also checks publish_date and expiry_date.';
comment on column market_news_articles.source is
  'Where this article''s content came from. "manual" = created via the admin UI (all rows today). "api"/"ai" are reserved for a future automated ingestion pipeline (external petroleum-market feeds, AI-generated summaries) — see the brief''s explicit two-phase instruction. No code writes these values yet; adding that pipeline later requires no schema change, just new rows.';
