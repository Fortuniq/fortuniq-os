"use client";

import { useState } from "react";
import Link from "next/link";
import { Newspaper, Pin, Star, ChevronDown, ChevronUp, FileText, Link as LinkIcon, Settings2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import type { MarketNewsArticle } from "@/lib/market-news-core";

/**
 * The dashboard's Market News widget (Project ORION Phase 2). Purely a
 * display component — the articles it's given are already the exact
 * set that's currently published, sorted (pinned/high-priority first),
 * via getPublishedMarketNews() in market-news-data.ts. Clicking an
 * article expands it in place to show the full briefing, per the brief
 * ("Clicking an article should open the full briefing").
 */
export function MarketNewsCard({ articles, canManage }: { articles: MarketNewsArticle[]; canManage: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (articles.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <CardTitle>
            <span className="flex items-center gap-1.5">
              <Newspaper className="w-3.5 h-3.5 text-orange" /> Market News
            </span>
          </CardTitle>
          {canManage && (
            <Link href="/market-news/admin" className="flex items-center gap-1 text-xs font-semibold text-grey hover:text-navy transition-colors">
              <Settings2 className="w-3.5 h-3.5" /> Manage
            </Link>
          )}
        </div>
      </CardHeader>
      <CardBody className="space-y-2">
        {articles.map((a) => {
          const expanded = expandedId === a.id;
          return (
            <div key={a.id} className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedId(expanded ? null : a.id)}
                className="w-full flex items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {a.pinned && <Pin className="w-3 h-3 text-orange shrink-0" />}
                    {a.highPriority && <Star className="w-3 h-3 text-orange fill-orange shrink-0" />}
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-light-grey">{a.category}</span>
                  </div>
                  <p className="text-sm font-semibold text-navy mt-0.5">{a.title}</p>
                  {!expanded && <p className="text-xs text-grey mt-0.5 line-clamp-1">{a.summary}</p>}
                </div>
                {expanded ? <ChevronUp className="w-4 h-4 text-grey shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-grey shrink-0 mt-0.5" />}
              </button>

              {expanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border">
                  <p className="text-sm text-navy whitespace-pre-line">{a.body}</p>
                  {a.attachmentUrl && (
                    <a href={a.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-navy hover:text-orange mt-2">
                      {a.attachmentName?.toLowerCase().endsWith(".pdf") ? <FileText className="w-3.5 h-3.5" /> : <LinkIcon className="w-3.5 h-3.5" />}
                      {a.attachmentName ?? "Supporting document"}
                    </a>
                  )}
                  <p className="text-[11px] text-light-grey mt-2">Published {a.publishDate}</p>
                </div>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
