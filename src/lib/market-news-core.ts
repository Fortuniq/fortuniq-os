// Pure logic for the Market News module (Project ORION Phase 2 — see
// docs/MARKET_NEWS.md). Zero DB/Next dependencies, same pattern as every
// other *-core.ts file in this app (finance-core.ts, dashboard-widgets.ts,
// documents-core.ts) so the rules here are fully unit-testable in
// isolation.
//
// WHY THIS EXISTS (per the brief, verbatim intent): ship a real,
// admin-managed CRUD module now — no placeholder content, no external
// API — while keeping the shape ready for external/AI-generated content
// to plug in later WITHOUT a schema or UI redesign. That future-readiness
// lives entirely in the `source` field below: every article created
// through today's admin UI is `source: "manual"`; a later automation
// pipeline can insert `source: "api"` or `source: "ai"` rows into the
// exact same table, and every rule in this file (what counts as
// "published," how articles sort, how they render) applies identically
// regardless of source. The dashboard widget, the admin list, and the
// database never need to change shape when that day comes.

export const MARKET_NEWS_CATEGORIES = [
  "Petroleum",
  "Diesel",
  "Petrol",
  "Exchange Rate",
  "Logistics",
  "Cross Border",
  "Ports",
  "Government",
  "Compliance",
  "Internal Company News",
] as const;

export type MarketNewsCategory = (typeof MARKET_NEWS_CATEGORIES)[number];

export function isValidMarketNewsCategory(value: unknown): value is MarketNewsCategory {
  return typeof value === "string" && (MARKET_NEWS_CATEGORIES as readonly string[]).includes(value);
}

// "Draft" lets an admin prepare an article before its publish date
// arrives (or before it's ready at all) without it ever appearing on
// anyone's dashboard. "Archived" is a deliberate manual retirement,
// distinct from simply letting an article expire — both keep the row
// (and its history) rather than deleting it.
export type MarketNewsStatus = "Draft" | "Published" | "Archived";
export const MARKET_NEWS_STATUSES: MarketNewsStatus[] = ["Draft", "Published", "Archived"];

// Where an article's content came from. "manual" is everything created
// through today's admin UI (Phase 1 of the brief). "api" and "ai" are not
// used by any code yet — they exist purely so Phase 2 (external
// APIs/AI-generated summaries, per the brief) has somewhere to write
// without a migration. See module comment above.
export type MarketNewsSource = "manual" | "api" | "ai";
export const MARKET_NEWS_SOURCES: MarketNewsSource[] = ["manual", "api", "ai"];

export interface MarketNewsArticle {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: MarketNewsCategory;
  status: MarketNewsStatus;
  pinned: boolean;
  highPriority: boolean;
  publishDate: string; // "YYYY-MM-DD" — when it may start appearing (still gated by status === "Published")
  expiryDate: string | null; // "YYYY-MM-DD" — null means it never expires on its own
  attachmentUrl: string | null;
  attachmentName: string | null;
  source: MarketNewsSource;
  createdByEmail: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Whether this article should actually be visible on the dashboard
 * widget right now — the single gate every reader of this table must
 * apply. Requires ALL THREE independently: explicit "Published" status
 * (an admin decision, not implied by dates alone), a publish date that
 * has arrived, and no expiry date that has already passed. Mirrors the
 * date-comparison convention used by documents-core.ts's isExpired().
 */
export function isCurrentlyPublished(
  article: Pick<MarketNewsArticle, "status" | "publishDate" | "expiryDate">,
  today: Date = new Date()
): boolean {
  if (article.status !== "Published") return false;
  const todayMs = new Date(today.toDateString()).getTime();
  const publishMs = new Date(article.publishDate + "T00:00:00").getTime();
  if (publishMs > todayMs) return false;
  if (article.expiryDate) {
    const expiryMs = new Date(article.expiryDate + "T00:00:00").getTime();
    if (expiryMs < todayMs) return false;
  }
  return true;
}

/** Filters a list down to only what's currently visible — the function every dashboard-facing reader should call rather than re-deriving the isCurrentlyPublished logic inline. */
export function filterPublishedArticles<T extends Pick<MarketNewsArticle, "status" | "publishDate" | "expiryDate">>(
  articles: T[],
  today: Date = new Date()
): T[] {
  return articles.filter((a) => isCurrentlyPublished(a, today));
}

/**
 * Widget/admin display order: pinned first, then High Priority, then
 * most recently published. Stable beyond that (original array order
 * preserved for ties) since callers already fetch in a sensible base
 * order (e.g. by publish_date desc) from the database.
 */
export function sortMarketNewsArticles<T extends Pick<MarketNewsArticle, "pinned" | "highPriority" | "publishDate">>(
  articles: T[]
): T[] {
  return [...articles].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.highPriority !== b.highPriority) return a.highPriority ? -1 : 1;
    return b.publishDate.localeCompare(a.publishDate);
  });
}

export interface MarketNewsInput {
  title?: unknown;
  summary?: unknown;
  body?: unknown;
  category?: unknown;
  status?: unknown;
  pinned?: unknown;
  highPriority?: unknown;
  publishDate?: unknown;
  expiryDate?: unknown;
}

/**
 * Validates a proposed create/edit before it ever reaches the database
 * — the server action calls this first, so a malformed request never
 * gets as far as a Supabase insert/update. Returns an error string, or
 * null when the input is good to save.
 */
export function validateMarketNewsInput(input: MarketNewsInput): string | null {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";

  if (!title) return "A title is required.";
  if (title.length > 200) return "Title must be 200 characters or fewer.";
  if (!summary) return "A short summary is required (shown on the dashboard card before it's expanded).";
  if (!body) return "The full briefing text is required.";
  if (!isValidMarketNewsCategory(input.category)) return "Choose a valid category.";
  if (input.status !== undefined && !MARKET_NEWS_STATUSES.includes(input.status as MarketNewsStatus)) return "Invalid status.";

  const publishDate = typeof input.publishDate === "string" ? input.publishDate : "";
  if (!publishDate || Number.isNaN(new Date(publishDate + "T00:00:00").getTime())) return "A valid publish date is required.";

  if (input.expiryDate) {
    const expiryDate = typeof input.expiryDate === "string" ? input.expiryDate : "";
    if (Number.isNaN(new Date(expiryDate + "T00:00:00").getTime())) return "Expiry date isn't valid.";
    if (expiryDate < publishDate) return "Expiry date can't be before the publish date.";
  }

  return null;
}
