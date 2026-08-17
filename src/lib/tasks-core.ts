// Pure "My Tasks" logic — deliberately has ZERO dependencies on Next.js
// or Supabase, same reasoning as every other *-core.ts file in this app:
// fully unit-testable in isolation. See docs/EMPLOYEE_DASHBOARD.md and
// src/lib/tasks-core.test.ts.

export type TaskStatus = "To Do" | "In Progress" | "Waiting" | "Completed" | "Overdue";
export type TaskPriority = "High" | "Medium" | "Low";

export type MyTask = {
  id: string | number;
  title: string;
  moduleKey: string | null;
  recordId: string | null;
  recordUrl: string | null;
  employeeEmail: string | null;
  dueDate: string | null; // ISO date, e.g. "2026-08-25"
  dueLabel: string | null; // fallback display label when no real due_date exists yet
  priority: TaskPriority | string;
  status: TaskStatus;
  workflowStage: string | null;
  createdAt: string | null;
  completedAt: string | null;
};

/**
 * The single source of truth for whether a task should be displayed as
 * Overdue right now — a task stored as "To Do"/"In Progress"/"Waiting"
 * becomes Overdue the moment its due date has passed, without needing a
 * background job to rewrite the stored status. Completed tasks are never
 * reclassified as Overdue, no matter how late they were finished.
 */
export function effectiveStatus(task: Pick<MyTask, "status" | "dueDate">, today: Date = new Date()): TaskStatus {
  if (task.status === "Completed") return "Completed";
  if (!task.dueDate) return task.status;
  const due = new Date(task.dueDate + "T23:59:59");
  if (due.getTime() < today.getTime()) return "Overdue";
  return task.status;
}

export function isDueToday(task: Pick<MyTask, "dueDate">, today: Date = new Date()): boolean {
  if (!task.dueDate) return false;
  const due = new Date(task.dueDate + "T00:00:00");
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

export type TaskGroups = {
  dueToday: MyTask[];
  upcoming: MyTask[];
  overdue: MyTask[];
  highPriority: MyTask[];
};

/**
 * Groups a person's open tasks into the four buckets the dashboard's My
 * Tasks card shows. A single task can appear in more than one bucket
 * (e.g. due today AND high priority) — these are display groupings, not
 * a partition.
 */
export function groupMyTasks(tasks: MyTask[], today: Date = new Date()): TaskGroups {
  const open = tasks.filter((t) => effectiveStatus(t, today) !== "Completed");
  return {
    dueToday: open.filter((t) => isDueToday(t, today)),
    upcoming: open.filter((t) => !isDueToday(t, today) && effectiveStatus(t, today) !== "Overdue"),
    overdue: open.filter((t) => effectiveStatus(t, today) === "Overdue"),
    highPriority: open.filter((t) => t.priority === "High"),
  };
}

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

/** Overdue first, then by due date ascending (soonest first), then priority. */
export function sortMyTasks(tasks: MyTask[], today: Date = new Date()): MyTask[] {
  return [...tasks].sort((a, b) => {
    const aOverdue = effectiveStatus(a, today) === "Overdue";
    const bOverdue = effectiveStatus(b, today) === "Overdue";
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return (PRIORITY_ORDER[a.priority as string] ?? 3) - (PRIORITY_ORDER[b.priority as string] ?? 3);
  });
}

/**
 * Whether a person is allowed to see a given task, based purely on the
 * module-permission check result already computed by the caller (see
 * hasModuleAccess/checkPermissionAction in permissions.ts/rbac.ts) —
 * this function does not know about roles or Supabase itself, it only
 * combines "is this task mine" with "do I have access to its module."
 * A task with no module_key (a general/internal task) is always visible
 * to its assigned employee.
 */
export function canSeeTask(
  task: Pick<MyTask, "employeeEmail" | "moduleKey">,
  viewerEmail: string,
  hasModuleAccessForTask: (moduleKey: string) => boolean
): boolean {
  if (task.employeeEmail && task.employeeEmail.toLowerCase() !== viewerEmail.toLowerCase()) return false;
  if (!task.moduleKey) return true;
  return hasModuleAccessForTask(task.moduleKey);
}
