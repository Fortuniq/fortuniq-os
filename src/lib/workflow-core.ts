// Pure logic for the redesigned "My Workflow" widget (Project ORION).
// Zero DB/Next dependencies, same pattern as every other *-core.ts file
// in this app. See docs/EMPLOYEE_DASHBOARD.md.
//
// The brief: "My Workflow redesign: show current workflow/stage/owner/
// progress/due date, a 'Continue Working' button, and recent workflow
// history." Deliberately built on TOP of the existing unified task
// layer (MyTask, already carrying moduleKey/workflowStage/recordUrl/
// dueDate) rather than a new workflow-tracking system — a "workflow
// item" here is just an open Company task that happens to carry a
// workflow_stage, viewed through a richer lens. See tasks-core.ts.

import type { MyTask } from "@/lib/tasks-core";
import { TENDER_WORKFLOW_STAGE_ORDER } from "@/lib/tender-core";

export interface WorkflowItem {
  taskId: string | number;
  moduleKey: string;
  title: string;
  stage: string;
  recordUrl: string | null;
  dueDate: string | null;
  priority: string;
  ownerEmail: string | null;
  /** null when this module has no known stage sequence to compute a fraction from (only Tenders does today) — never fabricated. */
  progressPct: number | null;
}

export interface WorkflowHistoryEntry {
  taskId: string | number;
  moduleKey: string;
  title: string;
  stage: string;
  completedAt: string;
}

/**
 * Where a stage's position is known (today: only Tenders, via
 * TENDER_WORKFLOW_STAGE_ORDER), returns how far through the sequence it
 * is as a percentage. Returns null for any module/stage this app
 * doesn't have an ordered sequence for — the UI must show "no progress
 * bar" rather than guessing, per this app's "never fabricate a number"
 * convention (see tender-core.ts's ComplianceResult).
 */
export function computeStageProgressPct(moduleKey: string, stage: string | null): number | null {
  if (!stage) return null;
  if (moduleKey === "tenders") {
    const index = TENDER_WORKFLOW_STAGE_ORDER.indexOf(stage as (typeof TENDER_WORKFLOW_STAGE_ORDER)[number]);
    if (index === -1) return null;
    return Math.round(((index + 1) / TENDER_WORKFLOW_STAGE_ORDER.length) * 100);
  }
  return null;
}

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

/**
 * Picks ONE current workflow item per module — the most urgent open
 * Company task that carries a workflow_stage (soonest due date first,
 * then highest priority, then most recently created). "My Workflow"
 * shows one focused line per module you have live work in, not every
 * open task (My Tasks already lists those in full).
 */
export function pickCurrentWorkflowItemsByModule(tasks: MyTask[]): WorkflowItem[] {
  const candidates = tasks.filter(
    (t) => t.taskType !== "Personal" && t.moduleKey && t.workflowStage && t.status !== "Completed"
  );

  const byModule = new Map<string, MyTask>();
  for (const t of candidates) {
    const moduleKey = t.moduleKey as string;
    const current = byModule.get(moduleKey);
    if (!current || isMoreUrgent(t, current)) byModule.set(moduleKey, t);
  }

  return [...byModule.entries()].map(([moduleKey, t]) => ({
    taskId: t.id,
    moduleKey,
    title: t.title,
    stage: t.workflowStage as string,
    recordUrl: t.recordUrl,
    dueDate: t.dueDate,
    priority: t.priority as string,
    ownerEmail: t.employeeEmail,
    progressPct: computeStageProgressPct(moduleKey, t.workflowStage),
  }));
}

function isMoreUrgent(a: MyTask, b: MyTask): boolean {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate;
  if (a.dueDate && !b.dueDate) return true;
  if (!a.dueDate && b.dueDate) return false;
  const aPriority = PRIORITY_ORDER[a.priority as string] ?? 3;
  const bPriority = PRIORITY_ORDER[b.priority as string] ?? 3;
  if (aPriority !== bPriority) return aPriority < bPriority;
  return (a.createdAt ?? "") > (b.createdAt ?? "");
}

/** Recently completed workflow tasks (Company, with a workflow_stage), newest first — the "recent workflow history" the brief asks for. Caller passes already-fetched completed tasks; this is display shaping only. */
export function buildWorkflowHistory(completedTasks: MyTask[], limit = 5): WorkflowHistoryEntry[] {
  return completedTasks
    .filter((t) => t.taskType !== "Personal" && t.moduleKey && t.workflowStage && t.completedAt)
    .sort((a, b) => (b.completedAt as string).localeCompare(a.completedAt as string))
    .slice(0, limit)
    .map((t) => ({
      taskId: t.id,
      moduleKey: t.moduleKey as string,
      title: t.title,
      stage: t.workflowStage as string,
      completedAt: t.completedAt as string,
    }));
}
