"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { completeMyTaskAction } from "./task-actions";
import type { MyTask } from "@/lib/tasks-core";

export function MyTasksCard({ tasks, openCount }: { tasks: MyTask[]; openCount: number }) {
  const [completedIds, setCompletedIds] = useState<Set<string | number>>(new Set());
  const [isPending, startTransition] = useTransition();

  function handleComplete(id: string | number) {
    startTransition(async () => {
      const result = await completeMyTaskAction(String(id));
      if (!result.error) {
        setCompletedIds((prev) => new Set(prev).add(id));
      }
    });
  }

  const visible = tasks.filter((t) => !completedIds.has(t.id)).slice(0, 8);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Tasks</CardTitle>
        <span className="text-xs text-orange font-semibold">{Math.max(0, openCount - completedIds.size)} open</span>
      </CardHeader>
      <CardBody className="space-y-1">
        {visible.length === 0 && <p className="text-sm text-light-grey py-2">Nothing on your plate right now.</p>}
        {visible.map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
            <button onClick={() => handleComplete(t.id)} disabled={isPending} title="Mark complete" className="shrink-0">
              <Circle className="w-4 h-4 text-light-grey hover:text-emerald-600 transition-colors" />
            </button>
            <div className="flex-1 min-w-0">
              {t.recordUrl ? (
                <a href={t.recordUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-navy truncate hover:text-orange transition-colors block">
                  {t.title}
                </a>
              ) : (
                <p className="text-sm text-navy truncate">{t.title}</p>
              )}
              <p className="text-xs text-light-grey">
                {t.moduleKey ? `${t.moduleKey} · ` : ""}Due {t.dueDate ?? t.dueLabel ?? "—"}
              </p>
            </div>
            <Badge tone={statusTone(t.priority as string)}>{t.priority}</Badge>
          </div>
        ))}
        {completedIds.size > 0 && (
          <p className="text-xs text-emerald-600 flex items-center gap-1 pt-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> {completedIds.size} completed just now
          </p>
        )}
      </CardBody>
    </Card>
  );
}
