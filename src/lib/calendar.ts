import { createServiceClient } from "@/lib/supabase/service";
import { hasModuleAccess, type UserPermissions, type ModuleKey } from "@/lib/permissions";
import { getOutlookEvents, createOutlookEvent, updateOutlookEvent, deleteOutlookEvent } from "@/lib/graph";
import type { PlannerBlockCategory } from "@/lib/planner-core";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export type CalendarEvent = {
  id: string;
  title: string;
  eventDate: string; // ISO date
  eventTime: string | null; // "HH:MM"
  allDay: boolean;
  eventType: string;
  moduleKey: string | null;
  recordUrl: string | null;
  source: "fortuniq" | "outlook";
  outlookEventId: string | null;
  durationMinutes: number | null;
  blockCategory: PlannerBlockCategory | null;
};

function mapRow(row: Record<string, unknown>): CalendarEvent {
  return {
    id: row.id as string,
    title: row.title as string,
    eventDate: row.event_date as string,
    eventTime: (row.event_time as string) ?? null,
    allDay: !!row.all_day,
    eventType: (row.event_type as string) ?? "General",
    moduleKey: (row.module_key as string) ?? null,
    recordUrl: (row.record_url as string) ?? null,
    source: (row.source as "fortuniq" | "outlook") ?? "fortuniq",
    outlookEventId: (row.outlook_event_id as string) ?? null,
    durationMinutes: (row.duration_minutes as number) ?? null,
    blockCategory: (row.block_category as PlannerBlockCategory) ?? null,
  };
}

/**
 * Fetches a person's upcoming calendar entries, permission-filtered the
 * same way as My Tasks — module-linked events only show if the person
 * still has access to that module. Outlook events show up here exactly
 * like FortunIQ ones once `syncOutlookCalendar()` has mirrored them into
 * this table (source='outlook') — this function itself only ever reads
 * calendar_events, so it needed no change to start including them.
 */
export async function getMyUpcomingEvents(permissions: UserPermissions, daysAhead = 14): Promise<CalendarEvent[]> {
  if (!supabaseConfigured || !permissions.email) return [];
  try {
    const supabase = createServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const until = new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("employee_email", permissions.email)
      .gte("event_date", today)
      .lte("event_date", until)
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true, nullsFirst: false });

    if (error || !data) return [];

    return data
      .map(mapRow)
      .filter((e) => !e.moduleKey || hasModuleAccess(permissions, e.moduleKey as ModuleKey));
  } catch {
    return [];
  }
}

/**
 * Creates a calendar entry linked to a module record — e.g. a tender's
 * closing date — so date-based work naturally shows up on the
 * responsible employee's calendar without a separate calendar feature
 * per module. Called from module server actions (see tender-actions.ts).
 * Best-effort: never throws, matching createTaskForEmployee's behaviour.
 */
export async function createCalendarEventForEmployee(params: {
  title: string;
  employeeEmail: string;
  eventDate: string;
  eventTime?: string;
  eventType?: CalendarEvent["eventType"];
  moduleKey?: ModuleKey;
  recordUrl?: string;
  createdBy?: string;
}): Promise<void> {
  if (!supabaseConfigured) return;
  try {
    const supabase = createServiceClient();
    await supabase.from("calendar_events").insert({
      title: params.title,
      employee_email: params.employeeEmail.toLowerCase(),
      event_date: params.eventDate,
      event_time: params.eventTime ?? null,
      event_type: params.eventType ?? "General",
      module_key: params.moduleKey ?? null,
      record_url: params.recordUrl ?? null,
      source: "fortuniq",
      created_by: params.createdBy ?? null,
    });
  } catch (err) {
    console.error("createCalendarEventForEmployee failed:", err);
  }
}

/** Fetches every event (any date, past or future) in an arbitrary window — the redesigned Personal Calendar's month/week view needs a range, not just "next N days". Same permission filtering as getMyUpcomingEvents. */
export async function getMyEventsInRange(permissions: UserPermissions, fromISODate: string, toISODate: string): Promise<CalendarEvent[]> {
  if (!supabaseConfigured || !permissions.email) return [];
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("employee_email", permissions.email)
      .gte("event_date", fromISODate)
      .lte("event_date", toISODate)
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true, nullsFirst: false });

    if (error || !data) return [];
    return data
      .map(mapRow)
      .filter((e) => !e.moduleKey || hasModuleAccess(permissions, e.moduleKey as ModuleKey));
  } catch {
    return [];
  }
}

export interface CreateCalendarEventInput {
  title: string;
  employeeEmail: string;
  eventDate: string;
  eventTime?: string | null;
  allDay?: boolean;
  eventType?: CalendarEvent["eventType"];
  durationMinutes?: number | null;
  blockCategory?: PlannerBlockCategory | null;
}

/** Employee/planner-authored version of createCalendarEventForEmployee — returns the new row's id (needed for immediate Outlook push) and surfaces errors instead of swallowing them, since this is a direct user action, not a background side-effect of another module. */
export async function createCalendarEvent(input: CreateCalendarEventInput): Promise<{ error?: string; id?: string }> {
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        title: input.title,
        employee_email: input.employeeEmail.toLowerCase(),
        event_date: input.eventDate,
        event_time: input.eventTime ?? null,
        all_day: !!input.allDay,
        event_type: input.eventType ?? "General",
        source: "fortuniq",
        duration_minutes: input.durationMinutes ?? null,
        block_category: input.blockCategory ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return { error: "Couldn't save the calendar entry. Please try again." };
    return { id: data.id as string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save calendar entry." };
  }
}

export interface UpdateCalendarEventInput {
  title?: string;
  eventDate?: string;
  eventTime?: string | null;
  durationMinutes?: number | null;
  blockCategory?: PlannerBlockCategory | null;
}

/** Ownership-scoped update — used by both the Personal Calendar UI and the Daily Planner drag-to-retime action. */
export async function updateCalendarEvent(eventId: string, actorEmail: string, input: UpdateCalendarEventInput): Promise<{ error?: string }> {
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("calendar_events").select("employee_email").eq("id", eventId).maybeSingle();
    if (!existing) return { error: "Calendar entry not found." };
    if ((existing.employee_email ?? "").toLowerCase() !== actorEmail.toLowerCase()) return { error: "You can only edit your own calendar entries." };

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.title !== undefined) patch.title = input.title;
    if (input.eventDate !== undefined) patch.event_date = input.eventDate;
    if (input.eventTime !== undefined) patch.event_time = input.eventTime;
    if (input.durationMinutes !== undefined) patch.duration_minutes = input.durationMinutes;
    if (input.blockCategory !== undefined) patch.block_category = input.blockCategory;

    await supabase.from("calendar_events").update(patch).eq("id", eventId);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update calendar entry." };
  }
}

/** Ownership-scoped delete. A linked Outlook event (outlook_event_id set) should be deleted by the caller via deleteOutlookEvent() first — kept as two steps so a Graph failure never silently blocks removing the local entry. */
export async function deleteCalendarEvent(eventId: string, actorEmail: string): Promise<{ error?: string; outlookEventId?: string | null }> {
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("calendar_events").select("employee_email, outlook_event_id").eq("id", eventId).maybeSingle();
    if (!existing) return { error: "Calendar entry not found." };
    if ((existing.employee_email ?? "").toLowerCase() !== actorEmail.toLowerCase()) return { error: "You can only delete your own calendar entries." };

    await supabase.from("calendar_events").delete().eq("id", eventId);
    return { outlookEventId: (existing.outlook_event_id as string) ?? null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete calendar entry." };
  }
}

/**
 * Outlook Calendar two-way sync (Project ORION). Run on-demand (e.g.
 * when the Personal Calendar page loads, or a "Sync now" button) rather
 * than as a scheduled job — there's no background worker in this
 * Netlify/Next.js deployment to run one from. Two directions, kept
 * intentionally simple:
 *
 * 1. PUSH: any FortunIQ-sourced event with no outlook_event_id yet gets
 *    created in Outlook and stamped with the id Graph returns.
 * 2. PULL: Outlook events in the window that aren't already mirrored
 *    locally (matched by outlook_event_id) are inserted as
 *    source='outlook' rows.
 *
 * Never deletes anything on either side automatically — Outlook-side
 * deletions are not detected by this pass (would require diffing the
 * full remote set); a person removing an Outlook event they'd synced in
 * will still see it here until they delete it from FortunIQ OS too.
 * That asymmetry is a deliberate, documented limitation, not a bug.
 */
export async function syncOutlookCalendar(accessToken: string, employeeEmail: string, daysAhead = 14): Promise<{ pushed: number; pulled: number; errors: string[] }> {
  const errors: string[] = [];
  let pushed = 0;
  let pulled = 0;
  if (!supabaseConfigured) return { pushed, pulled, errors };

  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10);

  // PUSH
  try {
    const { data: unsynced } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("employee_email", employeeEmail.toLowerCase())
      .eq("source", "fortuniq")
      .is("outlook_event_id", null)
      .gte("event_date", today)
      .lte("event_date", until);

    for (const row of unsynced ?? []) {
      try {
        const startISO = `${row.event_date}T${row.event_time ?? "09:00"}:00`;
        const durationMinutes = row.duration_minutes ?? 30;
        const endISO = new Date(new Date(startISO).getTime() + durationMinutes * 60000).toISOString().slice(0, 19);
        const outlookId = await createOutlookEvent(accessToken, {
          subject: row.title, startISO, endISO, isAllDay: !!row.all_day,
        });
        await supabase.from("calendar_events").update({ outlook_event_id: outlookId, last_synced_at: new Date().toISOString() }).eq("id", row.id);
        pushed++;
      } catch (err) {
        errors.push(`Push failed for "${row.title}": ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Push phase failed.");
  }

  // PULL
  try {
    const outlookEvents = await getOutlookEvents(accessToken, today, until);
    const { data: alreadyMirrored } = await supabase
      .from("calendar_events")
      .select("outlook_event_id")
      .eq("employee_email", employeeEmail.toLowerCase())
      .not("outlook_event_id", "is", null);
    const mirroredIds = new Set((alreadyMirrored ?? []).map((r) => r.outlook_event_id));

    for (const evt of outlookEvents) {
      if (mirroredIds.has(evt.id)) continue;
      try {
        const eventDate = evt.start.slice(0, 10);
        const eventTime = evt.isAllDay ? null : evt.start.slice(11, 16);
        await supabase.from("calendar_events").insert({
          title: evt.subject,
          employee_email: employeeEmail.toLowerCase(),
          event_date: eventDate,
          event_time: eventTime,
          all_day: evt.isAllDay,
          event_type: "General",
          source: "outlook",
          outlook_event_id: evt.id,
          last_synced_at: new Date().toISOString(),
        });
        pulled++;
      } catch (err) {
        errors.push(`Pull failed for "${evt.subject}": ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Pull phase failed.");
  }

  return { pushed, pulled, errors };
}

export { updateOutlookEvent, deleteOutlookEvent };
