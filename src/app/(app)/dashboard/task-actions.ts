"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { completeTask, reopenTask } from "@/lib/tasks";
import { logAudit } from "@/lib/audit";

export async function completeMyTaskAction(taskId: string): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };
  const result = await completeTask(taskId, permissions.email);
  if (result.error) return result;
  await logAudit({ actorEmail: permissions.email, actorName: permissions.name, action: "document_status_changed", targetType: "task", targetId: taskId, metadata: { completed: true } });
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
