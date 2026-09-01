"use client";

import { useEffect, useRef, useState } from "react";
import type { Column } from "./DataTable";

/**
 * A drop-in alternative to DataTable — same Column<T>/data props — for
 * wide tables that need to stay usable at scale (see
 * docs/TENDER_REGISTER.md). Two things DataTable doesn't do:
 *
 * 1. The FIRST column is sticky on the left during horizontal scroll,
 *    with a solid background and a right-edge divider, so the row's
 *    identity stays visible no matter how far right you've scrolled.
 * 2. A floating horizontal scrollbar stays pinned near the bottom of
 *    the viewport while the table is on screen, synced bidirectionally
 *    with the table's own scroll position — so reaching the scrollbar
 *    never requires scrolling to the bottom of a long register first.
 *    It's hidden entirely when the table doesn't overflow horizontally.
 *
 * Deliberately a SEPARATE component from DataTable rather than a
 * modification to it — DataTable is used across many pages in this app
 * where sticky-column/floating-scrollbar behaviour isn't wanted or
 * would be visual noise; this is opt-in, only for tables that actually
 * need it at scale.
 */
export function StickyScrollDataTable<T extends { id: string | number }>({
  columns,
  data,
}: {
  columns: Column<T>[];
  data: T[];
}) {
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const floatingScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef<"table" | "floating" | null>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [showFloatingScrollbar, setShowFloatingScrollbar] = useState(false);
  const [inView, setInView] = useState(true);

  const [firstCol, ...restCols] = columns;

  // Keep the floating scrollbar's inner "track" the same width as the
  // real table, and only show it when there's actually overflow to
  // scroll — recalculated on data/column changes and on window resize.
  useEffect(() => {
    function measure() {
      const el = tableWrapperRef.current;
      if (!el) return;
      setScrollWidth(el.scrollWidth);
      setShowFloatingScrollbar(el.scrollWidth > el.clientWidth + 1);
    }
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    if (tableWrapperRef.current) ro.observe(tableWrapperRef.current);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [data, columns]);

  // Only keep the floating scrollbar visible while the table itself is
  // actually on screen — "remain visible near the bottom of the user's
  // viewport while the Tender Register is on screen," per the brief.
  useEffect(() => {
    const el = tableWrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handleTableScroll() {
    if (isSyncingRef.current === "floating") { isSyncingRef.current = null; return; }
    isSyncingRef.current = "table";
    if (floatingScrollRef.current && tableWrapperRef.current) {
      floatingScrollRef.current.scrollLeft = tableWrapperRef.current.scrollLeft;
    }
  }

  function handleFloatingScroll() {
    if (isSyncingRef.current === "table") { isSyncingRef.current = null; return; }
    isSyncingRef.current = "floating";
    if (floatingScrollRef.current && tableWrapperRef.current) {
      tableWrapperRef.current.scrollLeft = floatingScrollRef.current.scrollLeft;
    }
  }

  return (
    <div className="relative">
      <div ref={tableWrapperRef} onScroll={handleTableScroll} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th
                className="sticky left-0 z-10 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-wide text-grey text-left shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
              >
                {firstCol.header}
              </th>
              {restCols.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-grey whitespace-nowrap ${
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surface/60 transition-colors group">
                <td className="sticky left-0 z-10 bg-white group-hover:bg-surface/60 px-4 py-3 text-navy shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] transition-colors">
                  {firstCol.render ? firstCol.render(row) : String((row as Record<string, unknown>)[firstCol.key as string] ?? "")}
                </td>
                {restCols.map((col) => (
                  <td
                    key={String(col.key)}
                    className={`px-4 py-3 text-navy whitespace-nowrap ${
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                    }`}
                  >
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key as string] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showFloatingScrollbar && inView && (
        <div
          ref={floatingScrollRef}
          onScroll={handleFloatingScroll}
          className="sticky bottom-0 left-0 right-0 overflow-x-auto overflow-y-hidden h-3.5 bg-white/95 backdrop-blur-sm border-t border-border z-20"
          aria-label="Tender Register horizontal scroll"
        >
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>
      )}
    </div>
  );
}
