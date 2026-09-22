"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { completeTask, reopenTask, createPersonalTask, updatePersonalTask, deletePersonalTask, reorderPersonalTasks } from "@/lib/tasks";
import { logAudit } from "@/lib/audit";
import { auth } from "@/auth";
import { syncTaskCompletionToPlanner } from "@/lib/tender-planner";
import type { TaskPriority } from "@/lib/tasks-core";

export async function completeMyTaskAction(taskId: string): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };
  const result = await completeTask(taskId, permissions.email);
  if (result.error) return result;
  await logAudit({ actorEmail: permissions.email, actorName: permissions.name, action: "document_status_changed", targetType: "task", targetId: taskId, metadata: { completed: true } });

  // Best-effort — if this task is a synced Tender task, reflect
  // completion on its Planner card too. Never blocks the real
  // completion above if it fails. See docs/TENDER_PLANNER.md.
  const session = await auth();
  if (session?.accessToken) {
    await syncTaskCompletionToPlanner(taskId, session.accessToken as string);
  }

  revalidatePath("/dashboard");
  return {};
}

export async function reopenMyTaskAction(taskId: string): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };
  const result = await reopenTask(taskId, permissions.email);
  if (result.error) return result;
  await logAudit({ actorEmail: permissions.email, actorName: permissions.name, action: "document_status_changed", targetType: "task", targetId: taskId, metadata: { completed: false } });
  revalidatePath("/dashboard");
  return {};
}

// =========================================================================
// PERSONAL TASKS — Project ORION My Tasks split. Every action here is
// scoped to the SIGNED-IN person's own tasks only (no employeeEmail
// parameter — always derived from the session), and the real ownership
// + task_type ("Personal" only) checks live in tasks.ts, not just here.
// =========================================================================

function readPersonalTaskFields(formData: FormData) {
  const priority = String(formData.get("priority") ?? "Medium");
  return {
    title: String(formData.get("title") ?? "").trim(),
    dueDate: String(formData.get("dueDate") ?? "").trim() || null,
    priority: (["High", "Medium", "Low"].includes(priority) ? priority : "Medium") as TaskPriority,
    reminderAt: String(formData.get("reminderAt") ?? "").trim() || null,
  };
}

export async function createPersonalTaskAction(formData: FormData): Promise<{ error?: string; id?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };
  const result = await createPersonalTask(permissions.email, readPersonalTaskFields(formData));
  if (result.error) return result;
  revalidatePath("/dashboard");
  return result;
}

export async function updatePersonalTaskAction(taskId: string, formData: FormData): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };
  const result = await updatePersonalTask(taskId, permissions.email, readPersonalTaskFields(formData));
  if (result.error) return result;
  revalidatePath("/dashboard");
  return {};
}

export async function deletePersonalTaskAction(taskId: string): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };
  const result = await deletePersonalTask(taskId, permissions.email);
  if (result.error) return result;
  revalidatePath("/dashboard");
  return {};
}

export async function reorderPersonalTasksAction(orderedIds: string[]): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };
  const result = await reorderPersonalTasks(permissions.email, orderedIds);
  if (result.error) return result;
  revalidatePath("/dashboard");
  return {};
}
