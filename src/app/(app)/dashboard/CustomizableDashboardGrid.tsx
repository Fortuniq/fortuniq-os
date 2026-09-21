"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Settings2, GripVertical, Eye, EyeOff, Maximize2, Minimize2, Square, Check, RotateCcw, X } from "lucide-react";
import { DASHBOARD_WIDGET_REGISTRY, type DashboardWidgetKey, type DashboardWidgetLayoutEntry, type DashboardWidgetSize } from "@/lib/dashboard-widgets";
import { saveDashboardLayout, resetDashboardLayout } from "./dashboard-layout-actions";

const LABEL_BY_KEY = new Map(DASHBOARD_WIDGET_REGISTRY.map((w) => [w.key, w.label]));

const SIZE_CLASSES: Record<DashboardWidgetSize, string> = {
  compact: "col-span-6 md:col-span-3 xl:col-span-2",
  standard: "col-span-6 md:col-span-3 xl:col-span-3",
  wide: "col-span-6",
};

const NEXT_SIZE: Record<DashboardWidgetSize, DashboardWidgetSize> = {
  compact: "standard",
  standard: "wide",
  wide: "compact",
};

const SIZE_ICON: Record<DashboardWidgetSize, ReactNode> = {
  compact: <Square className="w-3.5 h-3.5" />,
  standard: <Minimize2 className="w-3.5 h-3.5" />,
  wide: <Maximize2 className="w-3.5 h-3.5" />,
};

/**
 * The customizable "personal productivity" section of the Employee
 * Dashboard (Project ORION Phase 1 — see docs/EMPLOYEE_DASHBOARD.md and
 * src/lib/dashboard-widgets.ts). Deliberately does NOT include the
 * Clock In / Attendance widget or the Calendar preview above it — those
 * stay exactly where they've always been, untouched, per the brief.
 *
 * `content` carries every AVAILABLE widget's already-rendered React
 * output (server-rendered, including client components like
 * MyTasksCard) — this component only ever decides layout (visible,
 * size, order), never data. A hidden widget's content is still passed
 * in so it can be shown again in edit mode without a page reload.
 */
export function CustomizableDashboardGrid({
  initialLayout,
  content,
}: {
  initialLayout: DashboardWidgetLayoutEntry[];
  content: Partial<Record<DashboardWidgetKey, ReactNode>>;
}) {
  const router = useRouter();
  const [layout, setLayout] = useState<DashboardWidgetLayoutEntry[]>(initialLayout);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const ordered = [...layout].sort((a, b) => a.order - b.order);
  const visibleForDisplay = editing ? ordered : ordered.filter((w) => w.visible);

  function renumber(entries: DashboardWidgetLayoutEntry[]): DashboardWidgetLayoutEntry[] {
    return entries.map((e, i) => ({ ...e, order: i }));
  }

  function toggleVisible(key: DashboardWidgetKey) {
    setLayout((prev) => prev.map((e) => (e.key === key ? { ...e, visible: !e.visible } : e)));
  }

  function cycleSize(key: DashboardWidgetKey) {
    setLayout((prev) => prev.map((e) => (e.key === key ? { ...e, size: NEXT_SIZE[e.size] } : e)));
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); return; }
    const currentOrdered = [...layout].sort((a, b) => a.order - b.order);
    const [moved] = currentOrdered.splice(dragIndex, 1);
    currentOrdered.splice(targetIndex, 0, moved);
    setLayout(renumber(currentOrdered));
    setDragIndex(null);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveDashboardLayout(layout);
      if (result?.error) { setError(result.error); return; }
      setEditing(false);
      router.refresh();
    });
  }

  function handleCancel() {
    setLayout(initialLayout);
    setError(null);
    setEditing(false);
  }

  function handleReset() {
    setError(null);
    startTransition(async () => {
      const result = await resetDashboardLayout();
      if (result?.error) { setError(result.error); return; }
      setEditing(false);
      router.refresh();
    });
  }

  if (visibleForDisplay.length === 0 && !editing) {
    return (
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-light-grey">All your widgets are hidden.</p>
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs font-semibold text-navy hover:text-orange">
          <Settings2 className="w-3.5 h-3.5" /> Customize
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-end gap-2 mb-2">
        {error && <span className="text-xs text-red-600 mr-auto">{error}</span>}
        {editing ? (
          <>
            <button onClick={handleReset} disabled={isPending} className="flex items-center gap-1.5 text-xs font-semibold text-grey hover:text-navy disabled:opacity-50">
              <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
            </button>
            <button onClick={handleCancel} disabled={isPending} className="flex items-center gap-1.5 text-xs font-semibold text-grey hover:text-navy disabled:opacity-50">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button onClick={handleSave} disabled={isPending} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> {isPending ? "Saving…" : "Save Layout"}
            </button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs font-semibold text-navy hover:text-orange">
            <Settings2 className="w-3.5 h-3.5" /> Customize
          </button>
        )}
      </div>

      <div className="grid grid-cols-6 gap-4">
        {visibleForDisplay.map((entry, index) => (
          <div
            key={entry.key}
            className={`${SIZE_CLASSES[entry.size]} ${editing ? "relative rounded-xl ring-2 ring-dashed ring-border p-1" : ""} ${editing && !entry.visible ? "opacity-40" : ""}`}
            draggable={editing}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => editing && e.preventDefault()}
            onDrop={() => editing && handleDrop(index)}
          >
            {editing && (
              <div className="flex items-center justify-between px-2 py-1 mb-1">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-light-grey cursor-move">
                  <GripVertical className="w-3.5 h-3.5" /> {LABEL_BY_KEY.get(entry.key) ?? entry.key}
                </span>
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => cycleSize(entry.key)} title={`Size: ${entry.size} (click to change)`} className="text-light-grey hover:text-navy p-0.5">
                    {SIZE_ICON[entry.size]}
                  </button>
                  <button type="button" onClick={() => toggleVisible(entry.key)} title={entry.visible ? "Hide widget" : "Show widget"} className="text-light-grey hover:text-navy p-0.5">
                    {entry.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </span>
              </div>
            )}
            {content[entry.key] ?? null}
          </div>
        ))}
      </div>
    </div>
  );
}
