"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePermissionAction, isNextRedirectError } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { validateMarketNewsInput, MARKET_NEWS_STATUSES, type MarketNewsStatus } from "@/lib/market-news-core";
import { getMarketNewsAttachmentsFolder, uploadFileToFolder, isSharePointConfigured } from "@/lib/graph";

// Same {error?: string}-never-throw convention used throughout this app
// (see docs/FINANCE_MODULE.md / docs/DOCUMENT_CONTROL.md) — Next.js
// redacts thrown Server Action error messages in production, so every
// exported action here catches its own errors and returns them as plain
// data instead.
type ActionResult = { error?: string; id?: string };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

/**
 * "Super Admin and authorised users" per the brief — enforced via the
 * real granular RBAC layer (requirePermissionAction), not just an
 * isAdmin check, exactly like Academy's "Manage" gate. An org grants
 * this to specific people via Settings → Team (module access) + System
 * Access & Permissions (the Manage action), same UI used for every
 * other module — no new admin UI was needed for that. See
 * docs/MARKET_NEWS.md.
 */
async function assertCallerCanManageMarketNews() {
  return requirePermissionAction("market-news", "Manage");
}

function readFields(formData: FormData) {
  const expiryDateRaw = String(formData.get("expiryDate") ?? "").trim();
  return {
    title: String(formData.get("title") ?? "").trim(),
    summary: String(formData.get("summary") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
    category: String(formData.get("category") ?? ""),
    status: String(formData.get("status") ?? "Draft") as MarketNewsStatus,
    pinned: formData.get("pinned") === "on" || formData.get("pinned") === "true",
    highPriority: formData.get("highPriority") === "on" || formData.get("highPriority") === "true",
    publishDate: String(formData.get("publishDate") ?? "").trim(),
    expiryDate: expiryDateRaw || null,
    linkUrl: String(formData.get("linkUrl") ?? "").trim() || null,
  };
}

export async function createMarketNewsArticle(formData: FormData): Promise<ActionResult> {
  try {
    const caller = await assertCallerCanManageMarketNews();
    const fields = readFields(formData);

    const validationError = validateMarketNewsInput(fields);
    if (validationError) return { error: validationError };

    let attachmentUrl: string | null = fields.linkUrl;
    let attachmentName: string | null = fields.linkUrl ? fields.linkUrl : null;

    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
      const uploaded = await uploadAttachment(file);
      attachmentUrl = uploaded.webUrl;
      attachmentName = file.name;
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("market_news_articles")
      .insert({
        title: fields.title,
        summary: fields.summary,
        body: fields.body,
        category: fields.category,
        status: fields.status,
        pinned: fields.pinned,
        high_priority: fields.highPriority,
        publish_date: fields.publishDate,
        expiry_date: fields.expiryDate,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        source: "manual",
        created_by_email: caller.email,
        created_by_name: caller.name,
      })
      .select("id")
      .single();
    if (error || !data) return { error: "Couldn't create the article. Please try again." };

    await logAudit({
      actorEmail: caller.email!, actorName: caller.name, action: "market_news_created",
      targetType: "market_news_article", targetId: data.id, targetLabel: fields.title,
      metadata: { category: fields.category, status: fields.status },
    });

    revalidatePath("/market-news/admin");
    revalidatePath("/dashboard");
    return { id: data.id };
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: errorMessage(err) };
  }
}

export async function updateMarketNewsArticle(articleId: string, formData: FormData): Promise<ActionResult> {
  try {
    const caller = await assertCallerCanManageMarketNews();
    const fields = readFields(formData);

    const validationError = validateMarketNewsInput(fields);
    if (validationError) return { error: validationError };

    const supabase = createServiceClient();

    let attachmentUrl: string | null | undefined = fields.linkUrl;
    let attachmentName: string | null | undefined = fields.linkUrl ? fields.linkUrl : null;

    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
      const uploaded = await uploadAttachment(file);
      attachmentUrl = uploaded.webUrl;
      attachmentName = file.name;
    } else if (fields.linkUrl === null && formData.get("keepExistingAttachment") === "true") {
      // Neither a new file nor a link was submitted, but the caller wants
      // to keep whatever attachment is already saved — don't touch those
      // two columns at all rather than nulling them out.
      attachmentUrl = undefined;
      attachmentName = undefined;
    }

    const update: Record<string, unknown> = {
      title: fields.title,
      summary: fields.summary,
      body: fields.body,
      category: fields.category,
      status: fields.status,
      pinned: fields.pinned,
      high_priority: fields.highPriority,
      publish_date: fields.publishDate,
      expiry_date: fields.expiryDate,
      updated_at: new Date().toISOString(),
    };
    if (attachmentUrl !== undefined) update.attachment_url = attachmentUrl;
    if (attachmentName !== undefined) update.attachment_name = attachmentName;

    const { error } = await supabase.from("market_news_articles").update(update).eq("id", articleId);
    if (error) return { error: "Couldn't save your changes. Please try again." };

    await logAudit({
      actorEmail: caller.email!, actorName: caller.name, action: "market_news_updated",
      targetType: "market_news_article", targetId: articleId, targetLabel: fields.title,
      metadata: { category: fields.category, status: fields.status },
    });

    revalidatePath("/market-news/admin");
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: errorMessage(err) };
  }
}

/** Quick status change from the admin list (e.g. Draft -> Published, or -> Archived) without opening the full edit form. */
export async function setMarketNewsStatus(articleId: string, status: MarketNewsStatus): Promise<ActionResult> {
  try {
    const caller = await assertCallerCanManageMarketNews();
    if (!MARKET_NEWS_STATUSES.includes(status)) return { error: "Invalid status." };

    const supabase = createServiceClient();
    const { data: before } = await supabase.from("market_news_articles").select("title").eq("id", articleId).maybeSingle();
    const { error } = await supabase.from("market_news_articles").update({ status, updated_at: new Date().toISOString() }).eq("id", articleId);
    if (error) return { error: "Couldn't update the article's status." };

    await logAudit({
      actorEmail: caller.email!, actorName: caller.name,
      action: status === "Published" ? "market_news_published" : status === "Archived" ? "market_news_archived" : "market_news_updated",
      targetType: "market_news_article", targetId: articleId, targetLabel: before?.title, metadata: { status },
    });

    revalidatePath("/market-news/admin");
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: errorMessage(err) };
  }
}

export async function toggleMarketNewsPin(articleId: string, pinned: boolean): Promise<ActionResult> {
  try {
    await assertCallerCanManageMarketNews();
    const supabase = createServiceClient();
    const { error } = await supabase.from("market_news_articles").update({ pinned, updated_at: new Date().toISOString() }).eq("id", articleId);
    if (error) return { error: "Couldn't update the article." };
    revalidatePath("/market-news/admin");
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: errorMessage(err) };
  }
}

export async function toggleMarketNewsHighPriority(articleId: string, highPriority: boolean): Promise<ActionResult> {
  try {
    await assertCallerCanManageMarketNews();
    const supabase = createServiceClient();
    const { error } = await supabase.from("market_news_articles").update({ high_priority: highPriority, updated_at: new Date().toISOString() }).eq("id", articleId);
    if (error) return { error: "Couldn't update the article." };
    revalidatePath("/market-news/admin");
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: errorMessage(err) };
  }
}

export async function deleteMarketNewsArticle(articleId: string): Promise<ActionResult> {
  try {
    const caller = await assertCallerCanManageMarketNews();
    const supabase = createServiceClient();
    const { data: before } = await supabase.from("market_news_articles").select("title").eq("id", articleId).maybeSingle();
    const { error } = await supabase.from("market_news_articles").delete().eq("id", articleId);
    if (error) return { error: "Couldn't delete the article." };

    await logAudit({
      actorEmail: caller.email!, actorName: caller.name, action: "market_news_deleted",
      targetType: "market_news_article", targetId: articleId, targetLabel: before?.title,
    });

    revalidatePath("/market-news/admin");
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: errorMessage(err) };
  }
}

async function uploadAttachment(file: File): Promise<{ webUrl: string }> {
  if (!isSharePointConfigured) throw new Error("SharePoint isn't connected yet — paste a link instead, or see docs/SHAREPOINT_SETUP.md.");
  const session = await auth();
  if (!session?.accessToken) throw new Error("Your Microsoft session needs refreshing — try signing out and back in.");
  const accessToken = session.accessToken as string;

  const folder = await getMarketNewsAttachmentsFolder(accessToken);
  const bytes = await file.arrayBuffer();
  const uploaded = await uploadFileToFolder(accessToken, folder.id, file.name, bytes, file.type);
  return { webUrl: uploaded.webUrl };
}
