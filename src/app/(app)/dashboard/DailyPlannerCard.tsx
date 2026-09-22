"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Plus, X, Check, GripVertical, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { createCalendarEventAction, deleteCalendarEventAction, rescheduleTimeBlockAction } from "./calendar-actions";
import { PLANNER_BLOCK_CATEGORIES, sortBlocksByTime, totalPlannedMinutes, findOverlappingBlocks, type PlannerBlock } from "@/lib/planner-core";

/**
 * Daily Planner (Project ORION) — today's time-blocked schedule, built
 * on the same calendar_events rows the redesigned Personal Calendar and
 * Outlook two-way sync use (see planner-core.ts / calendar.ts). Native
 * HTML5 drag-and-drop for reordering, same no-new-dependency choice as
 * every other reorderable list in this app.
 */
export function DailyPlannerCard({ blocks: initialBlocks, todayISO }: { blocks: PlannerBlock[]; todayISO: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const blocks = sortBlocksByTime(initialBlocks);
  const overlaps = new Set(findOverlappingBlocks(blocks).map((w) => w.blockId));
  const plannedMinutes = totalPlannedMinutes(blocks);

  function handleAdd(formData: FormData) {
    setError(null);
    const title = String(formData.get("title") ?? "").trim();
    const startTime = String(formData.get("startTime") ?? "");
    const durationMinutes = Number(formData.get("durationMinutes") ?? 30);
    const category = String(formData.get("category") ?? "Task");

    startTransition(async () => {
      const result = await createCalendarEventAction({
        title, eventDate: todayISO, eventTime: startTime, durationMinutes,
        blockCategory: category as PlannerBlock["category"], eventType: "Internal",
      });
      if (result.error) setError(result.error);
      else { setAdding(false); router.refresh(); }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteCalendarEventAction(id);
      router.refresh();
    });
  }

  function handleDrop(targetBlock: PlannerBlock) {
    if (!dragId || dragId === targetBlock.id) { setDragId(null); return; }
    const id = dragId;
    setDragId(null);
    startTransition(async () => {
      await rescheduleTimeBlockAction(id, targetBlock.startTime);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><span className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5 text-orange" /> Daily Planner</span></CardTitle>
        {!adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-semibold text-navy hover:text-orange transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add block
          </button>
        )}
      </CardHeader>
      <CardBody className="space-y-2">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {blocks.length > 0 && <p className="text-xs text-light-grey">{(plannedMinutes / 60).toFixed(1)}h planned today. Drag a block onto another to swap its time.</p>}

        {adding && (
          <form action={handleAdd} className="border border-border rounded-lg p-2.5 space-y-2 bg-surface">
            <input name="title" placeholder="What are you working on?" required className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border" />
            <div className="flex gap-2">
              <input name="startTime" type="time" required defaultValue="09:00" className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-border" />
              <input name="durationMinutes" type="number" min={5} max={720} step={5} defaultValue={30} className="w-24 text-sm px-2.5 py-1.5 rounded-lg border border-border" />
              <select name="category" defaultValue="Task" className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-border">
                {PLANNER_BLOCK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className="flex items-center gap-1 text-xs font-semibold text-white bg-navy px-2.5 py-1.5 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
                <Check className="w-3.5 h-3.5" /> Add
              </button>
              <button type="button" onClick={() => setAdding(false)} className="flex items-center gap-1 text-xs font-semibold text-grey hover:text-navy transition-colors">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </form>
        )}

        {blocks.length === 0 && !adding && <p className="text-sm text-light-grey py-2">Nothing time-blocked for today yet.</p>}

        {blocks.map((b) => (
          <div
            key={b.id}
            draggable
            onDragStart={() => setDragId(b.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(b)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border ${overlaps.has(b.id) ? "border-amber-400 bg-amber-50" : "border-border"}`}
          >
            <GripVertical className="w-3.5 h-3.5 text-light-grey shrink-0 cursor-grab" />
            <div className="w-14 shrink-0">
              <p className="text-xs font-semibold text-navy">{b.startTime}</p>
              <p className="text-[10px] text-light-grey">{b.durationMinutes}m</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-navy truncate">{b.title}</p>
              <p className="text-xs text-light-grey">{b.category}{b.source === "outlook" ? " · Outlook" : ""}</p>
            </div>
            {b.recordUrl && (
              <a href={b.recordUrl} target="_blank" rel="noopener noreferrer" className="text-grey hover:text-orange transition-colors shrink-0">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={() => handleDelete(b.id)} className="text-grey hover:text-red-600 transition-colors shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
