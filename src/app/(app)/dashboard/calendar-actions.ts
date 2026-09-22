"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import {
  createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, syncOutlookCalendar,
  deleteOutlookEvent, type CreateCalendarEventInput, type UpdateCalendarEventInput,
} from "@/lib/calendar";
import { validatePlannerBlockInput } from "@/lib/planner-core";

const isOutlookConfigured = !!process.env.AUTH_MICROSOFT_ENTRA_ID_ID;

async function requireGraphAccessToken(): Promise<{ accessToken?: string; error?: string }> {
  const session = await auth();
  if (!session?.accessToken) return { error: "Your Microsoft session needs refreshing — try signing out and back in." };
  return { accessToken: session.accessToken as string };
}

/** Client-facing input — never accepts an employeeEmail from the caller; the server action always derives it from the session (below). */
export type ClientCalendarEventInput = Omit<CreateCalendarEventInput, "employeeEmail">;

/** Used by both the Personal Calendar's "Add event" and the Daily Planner's "Add block" (a block is just an event with a duration/category — see planner-core.ts). */
export async function createCalendarEventAction(input: ClientCalendarEventInput): Promise<{ error?: string; id?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };

  if (input.durationMinutes !== undefined && input.durationMinutes !== null) {
    const validationError = validatePlannerBlockInput({
      title: input.title, startTime: input.eventTime ?? "09:00", durationMinutes: input.durationMinutes, category: input.blockCategory,
    });
    if (validationError) return { error: validationError };
  }

  const result = await createCalendarEvent({ ...input, employeeEmail: permissions.email });
  if (result.error) return result;
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  return result;
}

export async function updateCalendarEventAction(eventId: string, input: UpdateCalendarEventInput): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };

  const result = await updateCalendarEvent(eventId, permissions.email, input);
  if (result.error) return result;
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  return {};
}

export async function deleteCalendarEventAction(eventId: string): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };

  const result = await deleteCalendarEvent(eventId, permissions.email);
  if (result.error) return { error: result.error };

  // Best-effort: a synced event also gets removed from Outlook. Failing
  // to reach Graph never blocks the local delete that already happened.
  if (result.outlookEventId && isOutlookConfigured) {
    const token = await requireGraphAccessToken();
    if (token.accessToken) {
      try { await deleteOutlookEvent(token.accessToken, result.outlookEventId); } catch { /* best-effort */ }
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  return {};
}

/** Runs the two-way Outlook sync pass for the signed-in employee. See syncOutlookCalendar() in calendar.ts for exactly what "sync" means here. */
export async function syncOutlookCalendarAction(): Promise<{ error?: string; pushed?: number; pulled?: number }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };
  if (!isOutlookConfigured) return { error: "Outlook isn't connected for this deployment." };

  const token = await requireGraphAccessToken();
  if (!token.accessToken) return { error: token.error };

  const result = await syncOutlookCalendar(token.accessToken, permissions.email);
  await logAudit({
    actorEmail: permissions.email, action: "outlook_calendar_synced",
    metadata: { pushed: result.pushed, pulled: result.pulled, errorCount: result.errors.length },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  if (result.errors.length > 0) return { error: result.errors[0], pushed: result.pushed, pulled: result.pulled };
  return { pushed: result.pushed, pulled: result.pulled };
}

/** Retimes a Daily Planner block via drag-and-drop — a focused update that also keeps a synced block's Outlook copy in step. */
export async function rescheduleTimeBlockAction(eventId: string, newStartTime: string): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };

  const result = await updateCalendarEvent(eventId, permissions.email, { eventTime: newStartTime });
  if (result.error) return result;
  revalidatePath("/dashboard");
  return {};
}
