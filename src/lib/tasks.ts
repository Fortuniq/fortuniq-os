import { createServiceClient } from "@/lib/supabase/service";
import { hasModuleAccess, type UserPermissions, type ModuleKey } from "@/lib/permissions";
import { canSeeTask, sortMyTasks, validatePersonalTaskInput, type MyTask, type TaskPriority } from "@/lib/tasks-core";
import * as mock from "@/lib/mock-data";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

function mapRow(row: Record<string, unknown>): MyTask {
  return {
    id: row.id as string,
    title: row.title as string,
    // Existing rows predate the task_type column entirely — every one of
    // them is workflow-generated, so "Company" is the correct fallback,
    // never "Personal" (see migration_v31_personal_tasks.sql).
    taskType: (row.task_type as MyTask["taskType"]) ?? "Company",
    moduleKey: (row.module_key as string) ?? null,
    recordId: (row.record_id as string) ?? null,
    recordUrl: (row.record_url as string) ?? null,
    employeeEmail: (row.employee_email as string) ?? null,
    dueDate: (row.due_date as string) ?? null,
    dueLabel: (row.due_label as string) ?? null,
    priority: (row.priority as string) ?? "Medium",
    status: (row.status as MyTask["status"]) ?? (row.done ? "Completed" : "To Do"),
    workflowStage: (row.workflow_stage as string) ?? null,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : null,
    reminderAt: (row.reminder_at as string) ?? null,
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
        id: t.id, title: t.title, taskType: "Company" as const, moduleKey: null, recordId: null, recordUrl: null,
        employeeEmail: permissions.email!, dueDate: null, dueLabel: t.due,
        priority: t.priority, status: "To Do" as const, workflowStage: null, sortOrder: null, reminderAt: null,
        createdAt: null, completedAt: null,
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
 * Recently completed Company/workflow tasks for the signed-in employee
 * — feeds the redesigned "My Workflow" widget's history list (Project
 * ORION). A separate, small, explicit query rather than widening
 * getMyTasks() itself, since every other caller of getMyTasks()
 * deliberately wants only OPEN work (see its own `.neq("status",
 * "Completed")` above) and should never silently start receiving
 * completed rows too.
 */
export async function getMyRecentlyCompletedWorkflowTasks(employeeEmail: string, limit = 5): Promise<MyTask[]> {
  if (!supabaseConfigured || !employeeEmail) return [];
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("employee_email", employeeEmail.toLowerCase())
      .eq("status", "Completed")
      .not("workflow_stage", "is", null)
      .order("completed_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map(mapRow);
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
  await createTaskForEmployeeWithId(params);
}

/**
 * Same as createTaskForEmployee() but returns the new task's id —
 * needed by callers that must do something further with the specific
 * row afterward (e.g. syncing a Tender task to Microsoft Planner and
 * storing the returned planner_task_id back on it — see
 * tender-planner.ts). createTaskForEmployee() above is kept as a
 * fire-and-forget wrapper for every caller that doesn't need the id,
 * so nothing else in the app had to change.
 */
export async function createTaskForEmployeeWithId(params: {
  title: string;
  employeeEmail: string;
  moduleKey: ModuleKey;
  recordId?: string;
  recordUrl?: string;
  dueDate?: string;
  priority?: "High" | "Medium" | "Low";
  workflowStage?: string;
  createdBy?: string;
  checklist?: { item: string; done: boolean }[];
  notes?: string;
}): Promise<string | null> {
  if (!supabaseConfigured) return null;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("tasks").insert({
      title: params.title,
      task_type: "Company", // every workflow-generated task is a Company task by definition — see tasks-core.ts
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
      checklist: params.checklist ?? [],
      notes: params.notes ?? null,
    }).select("id").single();
    if (error) throw error;
    return data.id as string;
  } catch (err) {
    // A failure to create a follow-up task should never break the
    // module action that triggered it (e.g. saving a tender) — same
    // "never block the real action" principle as logAudit().
    console.error("createTaskForEmployee failed:", err);
    return null;
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

// =========================================================================
// PERSONAL TASKS — Project ORION, "My Tasks split into Company Tasks
// (manager/workflow-assigned) and Personal Tasks (employee-created,
// private)." Every function below only ever touches rows the caller
// owns AND that are task_type = 'Personal' — an employee can never use
// these to edit or delete a Company task assigned to them (they can
// only complete/reopen those, via completeTask/reopenTask above), and
// can never touch another employee's personal tasks even if they
// somehow guessed the id. See docs/EMPLOYEE_DASHBOARD.md.
// =========================================================================

/** Creates a new personal task for the signed-in employee, appended to the end of their current ordering. Validation happens here (not just in the server action) so this function is safe to call from anywhere. */
export async function createPersonalTask(
  employeeEmail: string,
  input: { title: string; dueDate?: string | null; priority?: TaskPriority; reminderAt?: string | null }
): Promise<{ error?: string; id?: string }> {
  const validationError = validatePersonalTaskInput(input);
  if (validationError) return { error: validationError };
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { count } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("employee_email", employeeEmail.toLowerCase())
      .eq("task_type", "Personal");

    const { data, error } = await supabase.from("tasks").insert({
      title: input.title.trim(),
      task_type: "Personal",
      employee_email: employeeEmail.toLowerCase(),
      module_key: null,
      due_date: input.dueDate || null,
      priority: input.priority ?? "Medium",
      status: "To Do",
      reminder_at: input.reminderAt || null,
      sort_order: count ?? 0,
      created_by: employeeEmail,
      owner: employeeEmail,
    }).select("id").single();
    if (error || !data) return { error: "Couldn't create the task. Please try again." };
    return { id: data.id as string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create task." };
  }
}

/** Edits a personal task's own fields — title/due date/priority/reminder. Never touches status (use completeTask/reopenTask, which already enforce the same ownership check) or task_type (a personal task can never be silently turned into a Company task, or vice versa). */
export async function updatePersonalTask(
  taskId: string,
  actorEmail: string,
  input: { title: string; dueDate?: string | null; priority?: TaskPriority; reminderAt?: string | null }
): Promise<{ error?: string }> {
  const validationError = validatePersonalTaskInput(input);
  if (validationError) return { error: validationError };
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("tasks").select("employee_email, task_type").eq("id", taskId).maybeSingle();
    if (!existing) return { error: "Task not found." };
    if (existing.task_type !== "Personal") return { error: "Only personal tasks can be edited here." };
    if ((existing.employee_email ?? "").toLowerCase() !== actorEmail.toLowerCase()) return { error: "You can only edit your own tasks." };

    await supabase.from("tasks").update({
      title: input.title.trim(),
      due_date: input.dueDate || null,
      priority: input.priority ?? "Medium",
      reminder_at: input.reminderAt || null,
      updated_at: new Date().toISOString(),
    }).eq("id", taskId);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update task." };
  }
}

/** Deletes a personal task outright (unlike Company tasks, which are never deletable from My Tasks — they reflect real assigned work and stay as the record of it). Same ownership + task_type guard as every other personal-task function. */
export async function deletePersonalTask(taskId: string, actorEmail: string): Promise<{ error?: string }> {
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("tasks").select("employee_email, task_type").eq("id", taskId).maybeSingle();
    if (!existing) return { error: "Task not found." };
    if (existing.task_type !== "Personal") return { error: "Only personal tasks can be deleted here." };
    if ((existing.employee_email ?? "").toLowerCase() !== actorEmail.toLowerCase()) return { error: "You can only delete your own tasks." };

    await supabase.from("tasks").delete().eq("id", taskId);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete task." };
  }
}

/**
 * Persists a new drag-and-drop order for the signed-in employee's
 * personal tasks. Takes the full ordered list of ids (not a single
 * moved item + target index) — same "never trust a partial client
 * instruction" posture as dashboard layout saving — and re-numbers them
 * 0..n-1 server-side rather than trusting any position the client sends.
 * Silently ignores any id that isn't actually one of this employee's own
 * personal tasks, rather than failing the whole reorder.
 */
export async function reorderPersonalTasks(employeeEmail: string, orderedIds: string[]): Promise<{ error?: string }> {
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { data: mine } = await supabase
      .from("tasks")
      .select("id")
      .eq("employee_email", employeeEmail.toLowerCase())
      .eq("task_type", "Personal");
    const ownedIds = new Set((mine ?? []).map((r) => r.id as string));

    const updates = orderedIds
      .filter((id) => ownedIds.has(id))
      .map((id, index) => supabase.from("tasks").update({ sort_order: index, updated_at: new Date().toISOString() }).eq("id", id));
    await Promise.all(updates);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reorder tasks." };
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
