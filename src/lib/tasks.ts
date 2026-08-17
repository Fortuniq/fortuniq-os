import { createServiceClient } from "@/lib/supabase/service";
import { hasModuleAccess, type UserPermissions, type ModuleKey } from "@/lib/permissions";
import { canSeeTask, sortMyTasks, type MyTask } from "@/lib/tasks-core";
import * as mock from "@/lib/mock-data";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

function mapRow(row: Record<string, unknown>): MyTask {
  return {
    id: row.id as string,
    title: row.title as string,
    moduleKey: (row.module_key as string) ?? null,
    recordId: (row.record_id as string) ?? null,
    recordUrl: (row.record_url as string) ?? null,
    employeeEmail: (row.employee_email as string) ?? null,
    dueDate: (row.due_date as string) ?? null,
    dueLabel: (row.due_label as string) ?? null,
    priority: (row.priority as string) ?? "Medium",
    status: (row.status as MyTask["status"]) ?? (row.done ? "Completed" : "To Do"),
    workflowStage: (row.workflow_stage as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
  };
}

/**
 * Fetches the signed-in employee's own task queue — "My Tasks" — pulled
 * together from across every module, permission-filtered both by
 * employee_email (only their own tasks) AND by the same module access
 * rules enforced everywhere else in the app (see docs/EMPLOYEE_DASHBOARD.md).
 *
 * Module admins/managers only see other people's tasks through the
 * relevant module's own screens (e.g. the Tender Register) — My Tasks on
 * the dashboard is always "mine," by design, matching the brief exactly.
 */
export async function getMyTasks(permissions: UserPermissions): Promise<MyTask[]> {
  if (!permissions.email) return [];

  if (!supabaseConfigured) {
    // Mock fallback: treat the mock task list as if it belonged to the
    // signed-in person, so the personalised dashboard still has
    // something real to show before a database is connected.
    return sortMyTasks(
      mock.tasks.map((t) => ({
        id: t.id, title: t.title, moduleKey: null, recordId: null, recordUrl: null,
        employeeEmail: permissions.email!, dueDate: null, dueLabel: t.due,
        priority: t.priority, status: "To Do" as const, workflowStage: null, createdAt: null, completedAt: null,
      }))
    );
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("employee_email", permissions.email)
      .neq("status", "Completed")
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error || !data) return [];

    const tasks = data.map(mapRow);

    // Defense in depth: even though the query already filters by
    // employee_email, re-check module access per task here too — a task
    // whose module the person has since lost access to (or never had)
    // must never surface, even if it's technically assigned to them.
    const visible: MyTask[] = [];
    for (const task of tasks) {
      const ok = canSeeTask(task, permissions.email, (moduleKey) => {
        if (!hasModuleAccess(permissions, moduleKey as ModuleKey)) return false;
        return true;
      });
      if (ok) visible.push(task);
    }
    return sortMyTasks(visible);
  } catch {
    return [];
  }
}

/**
 * Creates a task tied to a specific module record — the mechanism the
 * brief calls "workflow-generated tasks." Other modules' server actions
 * call this instead of maintaining their own separate task system (see
 * tender-actions.ts, finance actions, etc.) — this is the single unified
 * task layer the brief explicitly asks for.
 */
export async function createTaskForEmployee(params: {
  title: string;
  employeeEmail: string;
  moduleKey: ModuleKey;
  recordId?: string;
  recordUrl?: string;
  dueDate?: string; // ISO date
  priority?: "High" | "Medium" | "Low";
  workflowStage?: string;
  createdBy?: string;
}): Promise<void> {
  if (!supabaseConfigured) return; // no-op until a database is connected
  try {
    const supabase = createServiceClient();
    await supabase.from("tasks").insert({
      title: params.title,
      employee_email: params.employeeEmail.toLowerCase(),
      module_key: params.moduleKey,
      record_id: params.recordId ?? null,
      record_url: params.recordUrl ?? null,
      due_date: params.dueDate ?? null,
      priority: params.priority ?? "Medium",
      status: "To Do",
      workflow_stage: params.workflowStage ?? null,
      created_by: params.createdBy ?? null,
      owner: params.employeeEmail,
    });
  } catch (err) {
    // A failure to create a follow-up task should never break the
    // module action that triggered it (e.g. saving a tender) — same
    // "never block the real action" principle as logAudit().
    console.error("createTaskForEmployee failed:", err);
  }
}

/**
 * Marks a task complete. Requires the caller to already be the task's
 * owner (checked here, not just trusted from the client) — an employee
 * can only complete their own tasks. If the task originated from another
 * module record, that underlying record is left untouched — completing
 * a My Tasks entry never deletes the module data it points to.
 */
export async function completeTask(taskId: string, actorEmail: string): Promise<{ error?: string }> {
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("tasks").select("employee_email").eq("id", taskId).maybeSingle();
    if (!existing) return { error: "Task not found." };
    if ((existing.employee_email ?? "").toLowerCase() !== actorEmail.toLowerCase()) {
      return { error: "You can only complete your own tasks." };
    }
    await supabase.from("tasks").update({
      status: "Completed", done: true, completed_at: new Date().toISOString(), completed_by: actorEmail,
    }).eq("id", taskId);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to complete task." };
  }
}

export async function reopenTask(taskId: string, actorEmail: string): Promise<{ error?: string }> {
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("tasks").select("employee_email").eq("id", taskId).maybeSingle();
    if (!existing) return { error: "Task not found." };
    if ((existing.employee_email ?? "").toLowerCase() !== actorEmail.toLowerCase()) {
      return { error: "You can only reopen your own tasks." };
    }
    await supabase.from("tasks").update({ status: "To Do", done: false, completed_at: null, completed_by: null }).eq("id", taskId);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reopen task." };
  }
}

/**
 * Organisation-wide task counts, only ever surfaced to people whose
 * permissions grant broader visibility (Super Admin / Management) — see
 * requireDashboardBroadVisibility() in data.ts for the gate that decides
 * whether to even call this.
 */
export async function getOrganisationTaskStats(): Promise<{ total: number; overdue: number }> {
  if (!supabaseConfigured) return { total: mock.tasks.length, overdue: 0 };
  try {
    const supabase = createServiceClient();
    const { count: total } = await supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "Completed");
    const { count: overdue } = await supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "Overdue");
    return { total: total ?? 0, overdue: overdue ?? 0 };
  } catch {
    return { total: 0, overdue: 0 };
  }
}
