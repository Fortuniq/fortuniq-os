"use client";

import { useEffect, useRef, useState } from "react";
import type { Column } from "./DataTable";

/**
 * A drop-in alternative to DataTable — same Column<T>/data props — for
 * wide tables that need to stay usable at scale (see
 * docs/TENDER_REGISTER.md and docs/TENDER_DASHBOARD.md). Three things
 * DataTable doesn't do:
 *
 * 1. The FIRST column is always sticky on the left during horizontal
 *    scroll, with a solid background and a right-edge divider.
 * 2. The LAST column is ALSO sticky, on the right, when `stickyLast` is
 *    true (opt-in — most tables using this component don't need it;
 *    the Tender Register's Actions column does, so identity AND
 *    actions both stay reachable no matter how far you've scrolled).
 * 3. A floating horizontal scrollbar stays pinned near the bottom of
 *    the viewport while the table is on screen, synced bidirectionally
 *    with the table's own scroll position. Hidden entirely when the
 *    table doesn't overflow horizontally.
 *
 * Deliberately a SEPARATE component from DataTable rather than a
 * modification to it — this opt-in behaviour would be visual noise on
 * the many other tables in this app that don't need it.
 */
export function StickyScrollDataTable<T extends { id: string | number }>({
  columns,
  data,
  stickyLast = false,
}: {
  columns: Column<T>[];
  data: T[];
  stickyLast?: boolean;
}) {
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const floatingScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef<"table" | "floating" | null>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [showFloatingScrollbar, setShowFloatingScrollbar] = useState(false);
  const [inView, setInView] = useState(true);

  const firstCol = columns[0];
  const lastCol = stickyLast && columns.length > 1 ? columns[columns.length - 1] : null;
  const middleCols = lastCol ? columns.slice(1, -1) : columns.slice(1);

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

  function cellClass(col: Column<T>) {
    return `px-4 py-3 whitespace-nowrap ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`;
  }

  return (
    <div className="relative">
      <div ref={tableWrapperRef} onScroll={handleTableScroll} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className={`sticky left-0 z-10 bg-white text-xs font-semibold uppercase tracking-wide text-grey text-left shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${cellClass(firstCol)}`}>
                {firstCol.header}
              </th>
              {middleCols.map((col) => (
                <th key={String(col.key)} className={`text-xs font-semibold uppercase tracking-wide text-grey ${cellClass(col)}`}>
                  {col.header}
                </th>
              ))}
              {lastCol && (
                <th className={`sticky right-0 z-10 bg-white text-xs font-semibold uppercase tracking-wide text-grey shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)] ${cellClass(lastCol)}`}>
                  {lastCol.header}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surface/60 transition-colors group">
                <td className={`sticky left-0 z-10 bg-white group-hover:bg-surface/60 text-navy shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] transition-colors ${cellClass(firstCol)}`}>
                  {firstCol.render ? firstCol.render(row) : String((row as Record<string, unknown>)[firstCol.key as string] ?? "")}
                </td>
                {middleCols.map((col) => (
                  <td key={String(col.key)} className={`text-navy ${cellClass(col)}`}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key as string] ?? "")}
                  </td>
                ))}
                {lastCol && (
                  <td className={`sticky right-0 z-10 bg-white group-hover:bg-surface/60 text-navy shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)] transition-colors ${cellClass(lastCol)}`}>
                    {lastCol.render ? lastCol.render(row) : String((row as Record<string, unknown>)[lastCol.key as string] ?? "")}
                  </td>
                )}
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
