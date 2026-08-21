"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { completeTask, reopenTask } from "@/lib/tasks";
import { logAudit } from "@/lib/audit";
import { auth } from "@/auth";
import { syncTaskCompletionToPlanner } from "@/lib/tender-planner";

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
