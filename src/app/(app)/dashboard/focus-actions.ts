"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import {
  setFocus, carryForwardFocus, updateFocusProgress, deactivateFocus, getMyDirectReports,
  type SetFocusInput,
} from "@/lib/focus-data";
import type { FocusModule, FocusSource, FocusStatus } from "@/lib/focus-core";

// Every action derives the acting employee from the SESSION, never a
// client-supplied email — same posture as note-actions.ts/task-actions.ts.
// The real ownership check still lives in focus-data.ts.

export interface FocusFormInput {
  title: string;
  moduleKey?: FocusModule | null;
  relatedLabel?: string | null;
  relatedUrl?: string | null;
  workflowStage?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  estimatedTime?: string | null;
}

/** "Set as My Focus" — the employee picking their own focus, from any eligible item already on their dashboard (a task, workflow item, or calendar event). */
export async function setMyFocusAction(input: FocusFormInput): Promise<{ error?: string; id?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };

  const result = await setFocus({ ...input, employeeEmail: permissions.email, source: "Employee" as FocusSource });
  if (result.error) return result;

  await logAudit({ actorEmail: permissions.email, action: "focus_set", targetType: "employee_focus", targetId: result.id, targetLabel: input.title });
  revalidatePath("/dashboard");
  return result;
}

/** Employee accepting FortunIQ Intelligence's recommendation — never called automatically; only from an explicit "Accept" click. */
export async function acceptFocusRecommendationAction(input: FocusFormInput): Promise<{ error?: string; id?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };

  const result = await setFocus({ ...input, employeeEmail: permissions.email, source: "Intelligence" as FocusSource });
  if (result.error) return result;

  await logAudit({ actorEmail: permissions.email, action: "focus_recommendation_accepted", targetType: "employee_focus", targetId: result.id, targetLabel: input.title });
  revalidatePath("/dashboard");
  return result;
}

/** Manager assigning a focus to a direct report. Gated on the target actually being a direct report of the signed-in person — reuses the existing employees.manager_id relationship (see focus-data.ts), since FortunIQ OS doesn't have a separate "is a manager" permission today. */
export async function assignFocusToReportAction(targetEmail: string, input: FocusFormInput): Promise<{ error?: string; id?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };

  const reports = await getMyDirectReports(permissions.email);
  if (!reports.some((r) => r.email.toLowerCase() === targetEmail.toLowerCase())) {
    return { error: "You can only assign a focus to one of your direct reports." };
  }

  const setInput: SetFocusInput = { ...input, employeeEmail: targetEmail, source: "Manager", assignedBy: permissions.email };
  const result = await setFocus(setInput);
  if (result.error) return result;

  await logAudit({ actorEmail: permissions.email, action: "focus_assigned_by_manager", targetType: "employee_focus", targetId: result.id, targetLabel: input.title, metadata: { assignedTo: targetEmail } });
  revalidatePath("/dashboard");
  return result;
}

/** "Continue Yesterday's Focus" from the daily-reset prompt. */
export async function continueYesterdaysFocusAction(focusId: string): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };
  const result = await carryForwardFocus(focusId, permissions.email);
  if (result.error) return result;
  revalidatePath("/dashboard");
  return {};
}

export async function updateFocusProgressAction(
  focusId: string,
  status: FocusStatus,
  progressPct: number | null,
  notes: string | null
): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };

  const result = await updateFocusProgress(focusId, permissions.email, { status, progressPct, notes });
  if (result.error) return result;

  await logAudit({
    actorEmail: permissions.email,
    action: status === "Complete" ? "focus_completed" : "focus_progress_updated",
    targetType: "employee_focus",
    targetId: focusId,
  });
  revalidatePath("/dashboard");
  return {};
}

/** "Change Focus" / "Mark Blocked" from the daily-reset prompt — deactivates without completing. */
export async function changeFocusAction(focusId: string): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };
  const result = await deactivateFocus(focusId, permissions.email);
  if (result.error) return result;
  await logAudit({ actorEmail: permissions.email, action: "focus_changed", targetType: "employee_focus", targetId: focusId });
  revalidatePath("/dashboard");
  return {};
}
