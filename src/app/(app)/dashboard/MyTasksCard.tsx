"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, Briefcase, User } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { completeMyTaskAction } from "./task-actions";
import { PersonalTaskList } from "./PersonalTaskList";
import type { MyTask } from "@/lib/tasks-core";

/**
 * "My Tasks split into Company Tasks (manager/workflow-assigned) and
 * Personal Tasks (employee-created, private)" — Project ORION. Company
 * tasks keep the exact read-only-except-complete behaviour this card
 * always had (they represent real assigned work — see tasks.ts). Full
 * create/edit/delete/reorder only exists for Personal tasks, in
 * PersonalTaskList.tsx.
 */
export function MyTasksCard({ companyTasks, personalTasks }: { companyTasks: MyTask[]; personalTasks: MyTask[] }) {
  const [tab, setTab] = useState<"company" | "personal">("company");
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

  const visibleCompany = companyTasks.filter((t) => !completedIds.has(t.id)).slice(0, 8);
  const companyOpenCount = Math.max(0, companyTasks.length - completedIds.size);
  const personalOpenCount = personalTasks.filter((t) => t.status !== "Completed").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Tasks</CardTitle>
        <div className="flex items-center gap-1 bg-surface rounded-full p-0.5">
          <button
            onClick={() => setTab("company")}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${tab === "company" ? "bg-navy text-white" : "text-grey hover:text-navy"}`}
          >
            <Briefcase className="w-3 h-3" /> Company {companyOpenCount > 0 && `(${companyOpenCount})`}
          </button>
          <button
            onClick={() => setTab("personal")}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${tab === "personal" ? "bg-navy text-white" : "text-grey hover:text-navy"}`}
          >
            <User className="w-3 h-3" /> Personal {personalOpenCount > 0 && `(${personalOpenCount})`}
          </button>
        </div>
      </CardHeader>
      <CardBody className="space-y-1">
        {tab === "company" ? (
          <>
            {visibleCompany.length === 0 && <p className="text-sm text-light-grey py-2">Nothing assigned to you right now.</p>}
            {visibleCompany.map((t) => (
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
          </>
        ) : (
          <PersonalTaskList tasks={personalTasks} />
        )}
      </CardBody>
    </Card>
  );
}
