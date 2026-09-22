// Pure logic for the redesigned Personal Calendar (Project ORION). Zero
// DB/Next dependencies, same pattern as every other *-core.ts file.

export interface CalendarDayCell {
  date: string; // ISO date
  inCurrentMonth: boolean;
  isToday: boolean;
}

/**
 * Builds a full 6-week (42-day) month grid starting on a Monday, the way
 * every month-view calendar UI needs one — including the leading/
 * trailing days from adjacent months so every week row is full.
 */
export function buildMonthGrid(year: number, monthIndex0: number, today: string): CalendarDayCell[] {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex0, 1));
  const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - firstWeekday);

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    cells.push({
      date: iso,
      inCurrentMonth: d.getUTCMonth() === monthIndex0,
      isToday: iso === today,
    });
  }
  return cells;
}

/** Groups a flat event list by ISO date, for O(1) lookup while rendering a month/week grid. */
export function groupEventsByDate<T extends { eventDate: string }>(events: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const e of events) {
    const list = map.get(e.eventDate);
    if (list) list.push(e);
    else map.set(e.eventDate, [e]);
  }
  return map;
}

export function addMonths(year: number, monthIndex0: number, delta: number): { year: number; monthIndex0: number } {
  const total = year * 12 + monthIndex0 + delta;
  return { year: Math.floor(total / 12), monthIndex0: ((total % 12) + 12) % 12 };
}

export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
