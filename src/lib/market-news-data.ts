import { createServiceClient } from "@/lib/supabase/service";
import { filterPublishedArticles, sortMarketNewsArticles, type MarketNewsArticle } from "@/lib/market-news-core";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): MarketNewsArticle {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    body: row.body,
    category: row.category,
    status: row.status,
    pinned: row.pinned,
    highPriority: row.high_priority,
    publishDate: row.publish_date,
    expiryDate: row.expiry_date,
    attachmentUrl: row.attachment_url,
    attachmentName: row.attachment_name,
    source: row.source,
    createdByEmail: row.created_by_email,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The dashboard widget's content source — anyone with dashboard access
 * can call this (no market-news module gating), same as fuel prices:
 * this is what's meant to be SEEN by everyone, only editing is
 * restricted. Fails safe to an empty list on any error rather than
 * throwing, so a Market News outage never breaks the whole dashboard —
 * matching every other dashboard data source in data.ts.
 */
export async function getPublishedMarketNews(limit = 8): Promise<MarketNewsArticle[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const todayStr = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("market_news_articles")
      .select("*")
      .eq("status", "Published")
      .lte("publish_date", todayStr)
      .order("publish_date", { ascending: false })
      .limit(50); // over-fetch a little, then filter/sort precisely in pure logic below
    if (error || !data) return [];
    const articles = filterPublishedArticles(data.map(mapRow));
    return sortMarketNewsArticles(articles).slice(0, limit);
  } catch {
    return [];
  }
}

/** Every article, any status — for the admin list. Caller is responsible for the requirePermissionAction("market-news", "Manage") gate; this function does not check it itself. */
export async function getAllMarketNewsForAdmin(): Promise<MarketNewsArticle[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("market_news_articles").select("*").order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map(mapRow);
  } catch {
    return [];
  }
}

export async function getMarketNewsArticleById(id: string): Promise<MarketNewsArticle | null> {
  if (!supabaseConfigured) return null;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("market_news_articles").select("*").eq("id", id).maybeSingle();
    if (error || !data) return null;
    return mapRow(data);
  } catch {
    return null;
  }
}

export const isMarketNewsSupabaseConfigured = supabaseConfigured;
