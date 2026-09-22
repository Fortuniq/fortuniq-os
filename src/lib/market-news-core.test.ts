import { describe, it, expect } from "vitest";
import {
  isValidMarketNewsCategory,
  isCurrentlyPublished,
  filterPublishedArticles,
  sortMarketNewsArticles,
  validateMarketNewsInput,
  MARKET_NEWS_CATEGORIES,
} from "./market-news-core";

const TODAY = new Date("2026-09-22T10:00:00");

function article(overrides: Partial<{ status: "Draft" | "Published" | "Archived"; publishDate: string; expiryDate: string | null; pinned: boolean; highPriority: boolean }> = {}) {
  return {
    status: "Published" as const,
    publishDate: "2026-09-20",
    expiryDate: null as string | null,
    pinned: false,
    highPriority: false,
    ...overrides,
  };
}

describe("isValidMarketNewsCategory", () => {
  it("accepts every listed category", () => {
    for (const c of MARKET_NEWS_CATEGORIES) expect(isValidMarketNewsCategory(c)).toBe(true);
  });
  it("rejects unknown strings and non-strings", () => {
    expect(isValidMarketNewsCategory("Weather")).toBe(false);
    expect(isValidMarketNewsCategory(null)).toBe(false);
    expect(isValidMarketNewsCategory(undefined)).toBe(false);
    expect(isValidMarketNewsCategory(42)).toBe(false);
  });
});

describe("isCurrentlyPublished", () => {
  it("is false for Draft even with dates in range", () => {
    expect(isCurrentlyPublished(article({ status: "Draft" }), TODAY)).toBe(false);
  });
  it("is false for Archived", () => {
    expect(isCurrentlyPublished(article({ status: "Archived" }), TODAY)).toBe(false);
  });
  it("is false when the publish date hasn't arrived yet", () => {
    expect(isCurrentlyPublished(article({ publishDate: "2026-09-25" }), TODAY)).toBe(false);
  });
  it("is true when the publish date is today", () => {
    expect(isCurrentlyPublished(article({ publishDate: "2026-09-22" }), TODAY)).toBe(true);
  });
  it("is true with no expiry date set", () => {
    expect(isCurrentlyPublished(article({ expiryDate: null }), TODAY)).toBe(true);
  });
  it("is true when expiry date is today", () => {
    expect(isCurrentlyPublished(article({ expiryDate: "2026-09-22" }), TODAY)).toBe(true);
  });
  it("is false once the expiry date has passed", () => {
    expect(isCurrentlyPublished(article({ expiryDate: "2026-09-21" }), TODAY)).toBe(false);
  });
});

describe("filterPublishedArticles", () => {
  it("keeps only currently-published articles", () => {
    const list = [
      article({ status: "Published" }),
      article({ status: "Draft" }),
      article({ status: "Published", publishDate: "2026-12-01" }),
      article({ status: "Archived" }),
    ];
    expect(filterPublishedArticles(list, TODAY)).toHaveLength(1);
  });
});

describe("sortMarketNewsArticles", () => {
  it("puts pinned articles first", () => {
    const list = [article({ publishDate: "2026-09-20" }), article({ pinned: true, publishDate: "2026-09-10" })];
    expect(sortMarketNewsArticles(list)[0].pinned).toBe(true);
  });
  it("puts high-priority above normal when neither is pinned", () => {
    const list = [article({ publishDate: "2026-09-20" }), article({ highPriority: true, publishDate: "2026-09-10" })];
    expect(sortMarketNewsArticles(list)[0].highPriority).toBe(true);
  });
  it("falls back to most recent publish date", () => {
    const list = [article({ publishDate: "2026-09-01" }), article({ publishDate: "2026-09-20" })];
    expect(sortMarketNewsArticles(list)[0].publishDate).toBe("2026-09-20");
  });
  it("does not mutate the input array", () => {
    const list = [article({ publishDate: "2026-09-01" }), article({ pinned: true, publishDate: "2026-09-02" })];
    const copy = [...list];
    sortMarketNewsArticles(list);
    expect(list).toEqual(copy);
  });
});

describe("validateMarketNewsInput", () => {
  const valid = { title: "SA Fuel Price Brief", summary: "A short teaser", body: "Full briefing text.", category: "Petroleum", publishDate: "2026-09-22" };

  it("accepts a well-formed input", () => {
    expect(validateMarketNewsInput(valid)).toBeNull();
  });
  it("rejects a missing title", () => {
    expect(validateMarketNewsInput({ ...valid, title: "  " })).toMatch(/title/i);
  });
  it("rejects a missing summary", () => {
    expect(validateMarketNewsInput({ ...valid, summary: "" })).toMatch(/summary/i);
  });
  it("rejects a missing body", () => {
    expect(validateMarketNewsInput({ ...valid, body: "" })).toMatch(/briefing/i);
  });
  it("rejects an invalid category", () => {
    expect(validateMarketNewsInput({ ...valid, category: "Weather" })).toMatch(/category/i);
  });
  it("rejects a missing publish date", () => {
    expect(validateMarketNewsInput({ ...valid, publishDate: "" })).toMatch(/publish date/i);
  });
  it("rejects an expiry date before the publish date", () => {
    expect(validateMarketNewsInput({ ...valid, publishDate: "2026-09-22", expiryDate: "2026-09-01" })).toMatch(/expiry/i);
  });
  it("accepts an expiry date on or after the publish date", () => {
    expect(validateMarketNewsInput({ ...valid, publishDate: "2026-09-22", expiryDate: "2026-09-22" })).toBeNull();
  });
  it("rejects an unreasonably long title", () => {
    expect(validateMarketNewsInput({ ...valid, title: "x".repeat(201) })).toMatch(/200/);
  });
});
