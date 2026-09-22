"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Pencil, Pin, Star, FileText, Link as LinkIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import type { MarketNewsArticle, MarketNewsStatus } from "@/lib/market-news-core";
import { MarketNewsForm } from "./MarketNewsForm";
import {
  createMarketNewsArticle, updateMarketNewsArticle, deleteMarketNewsArticle,
  setMarketNewsStatus, toggleMarketNewsPin, toggleMarketNewsHighPriority,
} from "./market-news-actions";

const STATUS_STYLES: Record<MarketNewsStatus, string> = {
  Draft: "bg-surface text-grey border-border",
  Published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Archived: "bg-grey/10 text-grey border-border",
};

export function MarketNewsAdminView({ articles }: { articles: MarketNewsArticle[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<MarketNewsArticle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createMarketNewsArticle(formData);
      if (result?.error) setError(result.error);
      else setShowAdd(false);
    });
  }

  function handleUpdate(articleId: string, formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateMarketNewsArticle(articleId, formData);
      if (result?.error) setError(result.error);
      else setEditing(null);
    });
  }

  function handleDelete(articleId: string, title: string) {
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
    startTransition(async () => {
      await deleteMarketNewsArticle(articleId);
    });
  }

  return (
    <div>
      <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-grey hover:text-navy transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-black text-navy">Manage Market News</h1>
          <p className="text-sm text-grey mt-1">
            Publish the FortunIQ Intelligence news briefing shown on everyone&apos;s dashboard. Only people explicitly granted Market News access can see this page.
          </p>
        </div>
        {!showAdd && (
          <button onClick={() => { setShowAdd(true); setEditing(null); setError(null); }} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors shrink-0">
            <Plus className="w-4 h-4" /> New Article
          </button>
        )}
      </div>

      {showAdd && (
        <MarketNewsForm
          onSubmit={handleCreate}
          onCancel={() => { setShowAdd(false); setError(null); }}
          submitting={isPending}
          error={error}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Articles ({articles.length})</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {articles.length === 0 && !showAdd && (
            <p className="text-sm text-light-grey py-4 text-center">No articles yet — create the first briefing above.</p>
          )}

          {articles.map((a) =>
            editing?.id === a.id ? (
              <MarketNewsForm
                key={a.id}
                article={a}
                onSubmit={(fd) => handleUpdate(a.id, fd)}
                onCancel={() => { setEditing(null); setError(null); }}
                submitting={isPending}
                error={error}
              />
            ) : (
              <div key={a.id} className="border border-border rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-navy">{a.title}</p>
                      {a.pinned && <Pin className="w-3.5 h-3.5 text-orange" />}
                      {a.highPriority && <Star className="w-3.5 h-3.5 text-orange fill-orange" />}
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                    </div>
                    <p className="text-xs text-light-grey mt-1">
                      {a.category} · Publishes {a.publishDate}{a.expiryDate ? ` · Expires ${a.expiryDate}` : ""}
                      {a.source !== "manual" && ` · Source: ${a.source}`}
                    </p>
                    <p className="text-sm text-grey mt-1.5 line-clamp-2">{a.summary}</p>
                    {a.attachmentUrl && (
                      <a href={a.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-navy hover:text-orange mt-1.5">
                        {a.attachmentName?.toLowerCase().endsWith(".pdf") ? <FileText className="w-3.5 h-3.5" /> : <LinkIcon className="w-3.5 h-3.5" />}
                        {a.attachmentName ?? "Attachment"}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startTransition(() => toggleMarketNewsPin(a.id, !a.pinned))} title={a.pinned ? "Unpin" : "Pin"} className="text-grey hover:text-orange transition-colors p-1">
                      <Pin className="w-4 h-4" />
                    </button>
                    <button onClick={() => startTransition(() => toggleMarketNewsHighPriority(a.id, !a.highPriority))} title={a.highPriority ? "Remove High Priority" : "Mark High Priority"} className="text-grey hover:text-orange transition-colors p-1">
                      <Star className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setEditing(a); setShowAdd(false); setError(null); }} title="Edit" className="text-grey hover:text-navy transition-colors p-1">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(a.id, a.title)} title="Delete" className="text-grey hover:text-red-600 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {a.status !== "Published" && (
                  <button onClick={() => startTransition(() => setMarketNewsStatus(a.id, "Published"))} className="text-xs font-semibold text-emerald-700 mt-2 hover:underline">
                    Publish now
                  </button>
                )}
                {a.status === "Published" && (
                  <button onClick={() => startTransition(() => setMarketNewsStatus(a.id, "Archived"))} className="text-xs font-semibold text-grey mt-2 hover:underline">
                    Archive
                  </button>
                )}
              </div>
            )
          )}
        </CardBody>
      </Card>
    </div>
  );
}
