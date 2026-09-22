import { createServiceClient } from "@/lib/supabase/service";
import { validateFocusInput, type EmployeeFocus, type FocusInput, type FocusSource, type FocusStatus } from "@/lib/focus-core";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): EmployeeFocus {
  return {
    id: row.id,
    employeeEmail: row.employee_email,
    title: row.title,
    moduleKey: row.module_key ?? null,
    relatedLabel: row.related_label ?? null,
    relatedUrl: row.related_url ?? null,
    workflowStage: row.workflow_stage ?? null,
    priority: row.priority ?? null,
    dueDate: row.due_date ?? null,
    estimatedTime: row.estimated_time ?? null,
    progressPct: row.progress_pct ?? null,
    status: row.status,
    source: row.source,
    assignedBy: row.assigned_by ?? null,
    notes: row.notes ?? null,
    focusDate: row.focus_date,
    isActive: row.is_active,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
  };
}

/** The employee's current active focus, if any — at most one row per employee has is_active=true (enforced by a unique index; see migration_v34). */
export async function getMyActiveFocus(employeeEmail: string): Promise<EmployeeFocus | null> {
  if (!supabaseConfigured || !employeeEmail) return null;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("employee_focus")
      .select("*")
      .eq("employee_email", employeeEmail.toLowerCase())
      .eq("is_active", true)
      .maybeSingle();
    if (error || !data) return null;
    return mapRow(data);
  } catch {
    return null;
  }
}

/** Recently completed focuses, newest first — the "Focus history" the design implies (see brief's "Daily Reset" / "When completed" sections). */
export async function getMyFocusHistory(employeeEmail: string, limit = 10): Promise<EmployeeFocus[]> {
  if (!supabaseConfigured || !employeeEmail) return [];
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("employee_focus")
      .select("*")
      .eq("employee_email", employeeEmail.toLowerCase())
      .eq("is_active", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map(mapRow);
  } catch {
    return [];
  }
}

export interface SetFocusInput extends FocusInput {
  employeeEmail: string;
  source: FocusSource;
  assignedBy?: string | null; // required (and RBAC-checked by the caller) when source === "Manager"
}

/**
 * Sets a new active focus — enforces "only ONE active focus may exist"
 * by deactivating any current active row first. Never overwrites an
 * existing active focus silently when called from the recommendation
 * flow: the caller (focus-actions.ts) only reaches this after the
 * employee has explicitly accepted a recommendation or made their own
 * choice, per the brief ("must never automatically replace the
 * employee's chosen focus").
 */
export async function setFocus(input: SetFocusInput): Promise<{ error?: string; id?: string }> {
  const validationError = validateFocusInput(input);
  if (validationError) return { error: validationError };
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const email = input.employeeEmail.toLowerCase();

    await supabase.from("employee_focus").update({ is_active: false }).eq("employee_email", email).eq("is_active", true);

    const { data, error } = await supabase
      .from("employee_focus")
      .insert({
        employee_email: email,
        title: (input.title as string).trim(),
        module_key: input.moduleKey ?? null,
        related_label: input.relatedLabel ?? null,
        related_url: input.relatedUrl ?? null,
        workflow_stage: input.workflowStage ?? null,
        priority: input.priority ?? null,
        due_date: input.dueDate ?? null,
        estimated_time: input.estimatedTime ?? null,
        status: "Not Started",
        source: input.source,
        assigned_by: input.source === "Manager" ? (input.assignedBy ?? null) : null,
        focus_date: new Date().toISOString().slice(0, 10),
        is_active: true,
        last_activity_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !data) return { error: "Couldn't set that as your focus. Please try again." };
    return { id: data.id as string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to set focus." };
  }
}

/** Re-activates yesterday's incomplete focus under today's date — the "Continue Yesterday's Focus" daily-reset option. Never happens automatically; only in response to the employee's explicit choice. */
export async function carryForwardFocus(focusId: string, actorEmail: string): Promise<{ error?: string }> {
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("employee_focus").select("employee_email").eq("id", focusId).maybeSingle();
    if (!existing) return { error: "Focus not found." };
    if ((existing.employee_email ?? "").toLowerCase() !== actorEmail.toLowerCase()) return { error: "You can only manage your own focus." };

    await supabase.from("employee_focus").update({
      focus_date: new Date().toISOString().slice(0, 10),
      last_activity_at: new Date().toISOString(),
    }).eq("id", focusId);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to carry the focus forward." };
  }
}

export interface UpdateFocusProgressInput {
  status?: FocusStatus;
  progressPct?: number | null;
  notes?: string | null;
}

export async function updateFocusProgress(focusId: string, actorEmail: string, input: UpdateFocusProgressInput): Promise<{ error?: string }> {
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("employee_focus").select("employee_email").eq("id", focusId).maybeSingle();
    if (!existing) return { error: "Focus not found." };
    if ((existing.employee_email ?? "").toLowerCase() !== actorEmail.toLowerCase()) return { error: "You can only update your own focus." };

    const patch: Record<string, unknown> = { last_activity_at: new Date().toISOString() };
    if (input.status !== undefined) patch.status = input.status;
    if (input.progressPct !== undefined) patch.progress_pct = input.progressPct;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.status === "Complete") {
      patch.completed_at = new Date().toISOString();
      patch.is_active = false;
      patch.progress_pct = 100;
    }

    await supabase.from("employee_focus").update(patch).eq("id", focusId);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update focus." };
  }
}

/** "Change Focus" — deactivates the current focus without marking it Complete (it stays in history at whatever status it was left at). */
export async function deactivateFocus(focusId: string, actorEmail: string): Promise<{ error?: string }> {
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("employee_focus").select("employee_email").eq("id", focusId).maybeSingle();
    if (!existing) return { error: "Focus not found." };
    if ((existing.employee_email ?? "").toLowerCase() !== actorEmail.toLowerCase()) return { error: "You can only manage your own focus." };

    await supabase.from("employee_focus").update({ is_active: false, last_activity_at: new Date().toISOString() }).eq("id", focusId);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to change focus." };
  }
}

/**
 * Direct reports of a manager, via the existing employees.manager_id
 * relationship (see getEmployeeDirectory in data.ts) — reused rather
 * than inventing a second "who manages whom" concept for this feature.
 */
export async function getMyDirectReports(managerEmail: string): Promise<{ email: string; name: string }[]> {
  if (!supabaseConfigured || !managerEmail) return [];
  try {
    const supabase = createServiceClient();
    const { data: manager } = await supabase.from("employees").select("id").eq("email", managerEmail.toLowerCase()).maybeSingle();
    if (!manager) return [];
    const { data: reports } = await supabase.from("employees").select("name, email").eq("manager_id", manager.id);
    return (reports ?? []).filter((r) => !!r.email).map((r) => ({ email: r.email as string, name: r.name as string }));
  } catch {
    return [];
  }
}
