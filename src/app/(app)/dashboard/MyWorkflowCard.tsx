import Link from "next/link";
import { Workflow, ArrowRight, History } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import type { WorkflowItem, WorkflowHistoryEntry } from "@/lib/workflow-core";

/**
 * Redesigned My Workflow widget (Project ORION): "show current
 * workflow/stage/owner/progress/due date, a 'Continue Working' button,
 * and recent workflow history." One card per module with live workflow
 * work, built on the existing unified task layer (a "workflow item" is
 * just an open Company task carrying a workflow_stage — see
 * workflow-core.ts), not a new tracking system.
 */
export function MyWorkflowCard({
  workflowItems,
  workflowHistory,
  moduleCards,
}: {
  workflowItems: WorkflowItem[];
  workflowHistory: WorkflowHistoryEntry[];
  moduleCards: { key: string; label: string; href: string; taskCount: number }[];
}) {
  const labelFor = (moduleKey: string) => moduleCards.find((c) => c.key === moduleKey)?.label ?? moduleKey;
  const hrefFor = (moduleKey: string) => moduleCards.find((c) => c.key === moduleKey)?.href ?? "#";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-1.5">
            <Workflow className="w-3.5 h-3.5 text-orange" /> My Workflow
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {workflowItems.length === 0 && <p className="text-sm text-light-grey py-2">No workflow items waiting on you.</p>}

        {workflowItems.map((item) => (
          <div key={`${item.moduleKey}-${item.taskId}`} className="border border-border rounded-lg p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-light-grey">{labelFor(item.moduleKey)}</span>
              <span className="text-[11px] font-semibold text-orange bg-orange/10 px-2 py-0.5 rounded-full">{item.stage}</span>
            </div>
            <p className="text-sm font-semibold text-navy mt-1 truncate">{item.title}</p>

            <div className="flex items-center gap-3 mt-1 text-xs text-light-grey">
              {item.dueDate && <span>Due {item.dueDate}</span>}
              <span>Owner: You</span>
              <span className={item.priority === "High" ? "text-red-600 font-semibold" : ""}>{item.priority} priority</span>
            </div>

            {item.progressPct !== null && (
              <div className="mt-2">
                <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                  <div className="h-full bg-orange rounded-full" style={{ width: `${item.progressPct}%` }} />
                </div>
                <p className="text-[11px] text-light-grey mt-0.5">{item.progressPct}% through the workflow</p>
              </div>
            )}

            <Link
              href={item.recordUrl ?? hrefFor(item.moduleKey)}
              className="flex items-center gap-1 text-xs font-semibold text-navy hover:text-orange transition-colors mt-2"
            >
              Continue Working <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ))}

        {workflowHistory.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-light-grey mb-1.5">
              <History className="w-3 h-3" /> Recent History
            </p>
            {workflowHistory.map((h) => (
              <div key={`${h.moduleKey}-${h.taskId}`} className="flex items-center justify-between py-1 text-xs">
                <span className="text-navy truncate">{h.title}</span>
                <span className="text-light-grey shrink-0 ml-2">{h.stage} · {h.completedAt.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
