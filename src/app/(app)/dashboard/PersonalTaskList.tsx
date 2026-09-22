"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, Circle, CheckCircle2, GripVertical, X, Check } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/Badge";
import {
  createPersonalTaskAction, updatePersonalTaskAction, deletePersonalTaskAction,
  reorderPersonalTasksAction, completeMyTaskAction, reopenMyTaskAction,
} from "./task-actions";
import type { MyTask, TaskPriority } from "@/lib/tasks-core";

/**
 * Full create/edit/delete/reorder/complete for an employee's own private
 * tasks — Project ORION's "My Tasks split." Nobody but this employee
 * ever sees this list (canSeeTask in tasks-core.ts already guarantees
 * that server-side; this component doesn't need its own privacy logic).
 *
 * Drag-and-drop reordering uses the native HTML5 DnD API, same choice
 * as CustomizableDashboardGrid.tsx — no new npm dependency.
 */
export function PersonalTaskList({ tasks }: { tasks: MyTask[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [order, setOrder] = useState<(string | number)[]>(tasks.map((t) => t.id));

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ordered = order.map((id) => byId.get(id)).filter((t): t is MyTask => !!t);
  // A task created/deleted since the last render (order state is stale
  // for one tick) — fall back to the fresh prop list rather than drop it.
  for (const t of tasks) if (!order.includes(t.id)) ordered.push(t);

  const open = ordered.filter((t) => t.status !== "Completed");
  const completed = ordered.filter((t) => t.status === "Completed");

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createPersonalTaskAction(formData);
      if (result?.error) setError(result.error);
      else { setAdding(false); router.refresh(); }
    });
  }

  function handleUpdate(taskId: string, formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updatePersonalTaskAction(taskId, formData);
      if (result?.error) setError(result.error);
      else { setEditingId(null); router.refresh(); }
    });
  }

  function handleDelete(taskId: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    startTransition(async () => {
      await deletePersonalTaskAction(taskId);
      router.refresh();
    });
  }

  function handleComplete(taskId: string) {
    startTransition(async () => {
      await completeMyTaskAction(taskId);
      router.refresh();
    });
  }

  function handleReopen(taskId: string) {
    startTransition(async () => {
      await reopenMyTaskAction(taskId);
      router.refresh();
    });
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); return; }
    const openIds = open.map((t) => t.id);
    const [moved] = openIds.splice(dragIndex, 1);
    openIds.splice(targetIndex, 0, moved);
    const newOrder = [...openIds, ...completed.map((t) => t.id)];
    setOrder(newOrder);
    setDragIndex(null);
    startTransition(async () => {
      await reorderPersonalTasksAction(newOrder.map(String));
    });
  }

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {!adding && (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-semibold text-navy hover:text-orange transition-colors mb-2">
          <Plus className="w-3.5 h-3.5" /> Add a personal task
        </button>
      )}
      {adding && <TaskForm onSubmit={handleCreate} onCancel={() => { setAdding(false); setError(null); }} submitting={isPending} />}

      {open.length === 0 && !adding && <p className="text-sm text-light-grey py-2">No personal tasks — this is just for you.</p>}

      {open.map((t, index) =>
        editingId === t.id ? (
          <TaskForm
            key={t.id}
            task={t}
            onSubmit={(fd) => handleUpdate(String(t.id), fd)}
            onCancel={() => { setEditingId(null); setError(null); }}
            submitting={isPending}
          />
        ) : (
          <div
            key={t.id}
            className="flex items-center gap-2 py-2 border-b border-border last:border-0"
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(index)}
          >
            <GripVertical className="w-3.5 h-3.5 text-light-grey cursor-move shrink-0" />
            <button onClick={() => handleComplete(String(t.id))} disabled={isPending} title="Mark complete" className="shrink-0">
              <Circle className="w-4 h-4 text-light-grey hover:text-emerald-600 transition-colors" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-navy truncate">{t.title}</p>
              <p className="text-xs text-light-grey">Due {t.dueDate ?? "—"}</p>
            </div>
            <Badge tone={statusTone(t.priority as string)}>{t.priority}</Badge>
            <button onClick={() => { setEditingId(t.id); setAdding(false); setError(null); }} title="Edit" className="text-grey hover:text-navy transition-colors shrink-0">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDelete(String(t.id), t.title)} title="Delete" className="text-grey hover:text-red-600 transition-colors shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      )}

      {completed.length > 0 && (
        <div className="pt-2 mt-1 border-t border-border">
          {completed.slice(0, 3).map((t) => (
            <div key={t.id} className="flex items-center gap-2 py-1.5">
              <button onClick={() => handleReopen(String(t.id))} title="Reopen" className="shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </button>
              <p className="text-sm text-light-grey line-through truncate flex-1">{t.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskForm({
  task, onSubmit, onCancel, submitting,
}: {
  task?: MyTask;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  return (
    <form action={onSubmit} className="border border-border rounded-lg p-2.5 mb-2 space-y-2 bg-surface">
      <input name="title" defaultValue={task?.title} placeholder="What do you need to do?" required maxLength={200} autoFocus className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border" />
      <div className="flex gap-2">
        <input type="date" name="dueDate" defaultValue={task?.dueDate ?? ""} className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-border" />
        <select name="priority" defaultValue={(task?.priority as TaskPriority) ?? "Medium"} className="text-xs px-2 py-1.5 rounded-lg border border-border">
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
      <div>
        <label className="text-[11px] text-light-grey block mb-0.5">Reminder (optional)</label>
        <input type="datetime-local" name="reminderAt" defaultValue={task?.reminderAt ? task.reminderAt.slice(0, 16) : ""} className="w-full text-xs px-2 py-1.5 rounded-lg border border-border" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="flex items-center gap-1 text-xs font-semibold text-white bg-navy px-2.5 py-1.5 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
          <Check className="w-3.5 h-3.5" /> {submitting ? "Saving…" : task ? "Save" : "Add"}
        </button>
        <button type="button" onClick={onCancel} className="flex items-center gap-1 text-xs font-semibold text-grey hover:text-navy transition-colors">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </form>
  );
}
