"use client";

import { useState } from "react";
import { MARKET_NEWS_CATEGORIES, MARKET_NEWS_STATUSES, type MarketNewsArticle } from "@/lib/market-news-core";

/**
 * Shared create/edit form for a single article. Deliberately a plain
 * <form action={onSubmit}> (a FormData-taking function), not a
 * server-action-bound form directly — MarketNewsAdminView wraps the real
 * server action in a startTransition so it can close the form / clear
 * errors on completion, same pattern as AcademyAdminView's SchoolForm.
 */
export function MarketNewsForm({
  article,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  article?: MarketNewsArticle;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  submitting: boolean;
  error?: string | null;
}) {
  const existingAttachmentIsLink = !!article?.attachmentUrl && !article.attachmentName?.toLowerCase().endsWith(".pdf");
  const [hasLink, setHasLink] = useState(existingAttachmentIsLink);

  return (
    <form
      action={(fd) => {
        if (!hasLink) fd.delete("linkUrl");
        if (article?.attachmentUrl) fd.set("keepExistingAttachment", "true");
        onSubmit(fd);
      }}
      className="border border-border rounded-xl p-4 mb-4 space-y-3 bg-surface"
    >
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <label className="text-xs font-medium text-grey block mb-1">Title</label>
        <input name="title" defaultValue={article?.title} required maxLength={200} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-grey block mb-1">Category</label>
          <select name="category" defaultValue={article?.category ?? MARKET_NEWS_CATEGORIES[0]} className="w-full text-sm px-3 py-2 rounded-lg border border-border">
            {MARKET_NEWS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-grey block mb-1">Status</label>
          <select name="status" defaultValue={article?.status ?? "Draft"} className="w-full text-sm px-3 py-2 rounded-lg border border-border">
            {MARKET_NEWS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-grey block mb-1">Short Summary (shown on the dashboard card)</label>
        <textarea name="summary" defaultValue={article?.summary} required rows={2} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
      </div>

      <div>
        <label className="text-xs font-medium text-grey block mb-1">Full Briefing</label>
        <textarea name="body" defaultValue={article?.body} required rows={8} className="w-full text-sm px-3 py-2 rounded-lg border border-border font-mono" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-grey block mb-1">Publish Date</label>
          <input type="date" name="publishDate" defaultValue={article?.publishDate ?? new Date().toISOString().slice(0, 10)} required className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
        </div>
        <div>
          <label className="text-xs font-medium text-grey block mb-1">Expiry Date (optional)</label>
          <input type="date" name="expiryDate" defaultValue={article?.expiryDate ?? ""} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
        </div>
      </div>

      <div className="flex items-center gap-5">
        <label className="flex items-center gap-1.5 text-sm text-navy">
          <input type="checkbox" name="pinned" defaultChecked={article?.pinned} /> Pinned
        </label>
        <label className="flex items-center gap-1.5 text-sm text-navy">
          <input type="checkbox" name="highPriority" defaultChecked={article?.highPriority} /> High Priority
        </label>
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-xs font-medium text-grey mb-2">Supporting Attachment (optional)</p>
        <div className="flex gap-2 mb-2">
          <button type="button" onClick={() => setHasLink(false)} className={`text-xs px-3 py-1.5 rounded-full border ${!hasLink ? "bg-navy text-white border-navy" : "border-border text-grey"}`}>Upload PDF</button>
          <button type="button" onClick={() => setHasLink(true)} className={`text-xs px-3 py-1.5 rounded-full border ${hasLink ? "bg-navy text-white border-navy" : "border-border text-grey"}`}>Link</button>
        </div>
        {hasLink ? (
          <input name="linkUrl" type="url" placeholder="https://…" defaultValue={existingAttachmentIsLink ? article?.attachmentUrl ?? "" : ""} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
        ) : (
          <input type="file" name="file" accept="application/pdf" className="w-full text-sm" />
        )}
        {article?.attachmentName && <p className="text-[11px] text-light-grey mt-1">Currently attached: {article.attachmentName}. Choosing a new file or link replaces it; leaving both blank keeps it.</p>}
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={submitting} className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
          {submitting ? "Saving…" : article ? "Save Changes" : "Create Article"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-grey px-4 py-2 rounded-lg hover:text-navy transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
