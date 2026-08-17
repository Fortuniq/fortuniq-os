import { createServiceClient } from "@/lib/supabase/service";
import { hasModuleAccess, type UserPermissions, type ModuleKey } from "@/lib/permissions";

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
  };
}

/**
 * Fetches a person's upcoming calendar entries, permission-filtered the
 * same way as My Tasks — module-linked events only show if the person
 * still has access to that module. Outlook events are not fetched here
 * yet; see docs/EMPLOYEE_DASHBOARD.md for why (no Calendars.Read scope
 * requested so far) — this function is already shaped to include them
 * transparently once that changes, since `source` and the row shape
 * already support it.
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
