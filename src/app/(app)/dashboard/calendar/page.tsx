import { requireModuleAccess } from "@/lib/permissions";
import { getMyEventsInRange } from "@/lib/calendar";
import { addMonths } from "@/lib/calendar-core";
import { CalendarView } from "./CalendarView";

/**
 * Personal Calendar redesign (Project ORION) — a full interactive
 * month view, internal-first (works with zero Outlook connection), with
 * Outlook-sourced events shown alongside FortunIQ ones once synced (see
 * MyFocusCard/DailyPlannerCard's sibling, calendar-actions.ts's
 * syncOutlookCalendarAction). Reached from the dashboard's "My Calendar
 * / Upcoming" preview via "Open full calendar".
 */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const permissions = await requireModuleAccess("dashboard");
  const params = await searchParams;

  const now = new Date();
  const year = params.y ? Number(params.y) : now.getUTCFullYear();
  const monthIndex0 = params.m ? Number(params.m) - 1 : now.getUTCMonth();

  // Fetch a one-month padded window so the leading/trailing grid days
  // from adjacent months (buildMonthGrid in calendar-core.ts) still
  // have their events available.
  const prev = addMonths(year, monthIndex0, -1);
  const next = addMonths(year, monthIndex0, 1);
  const fromISODate = `${prev.year}-${String(prev.monthIndex0 + 1).padStart(2, "0")}-01`;
  const toISODate = `${next.year}-${String(next.monthIndex0 + 1).padStart(2, "0")}-28`;

  const events = await getMyEventsInRange(permissions, fromISODate, toISODate);
  const todayISO = new Date().toISOString().slice(0, 10);

  return <CalendarView events={events} year={year} monthIndex0={monthIndex0} todayISO={todayISO} />;
}
