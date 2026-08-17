// Pure attendance logic — zero dependencies on Next.js, Supabase, or the
// system clock's timezone handling beyond what's passed in. Same
// testable-core pattern as every other *-core.ts file in this app. See
// docs/ATTENDANCE.md and src/lib/attendance-core.test.ts.

export type AttendanceStatus = "Clocked In" | "Clocked Out" | "Missing Clock-Out";

export type AttendanceRecord = {
  id: string;
  employeeEmail: string;
  attendanceDate: string; // ISO date, e.g. "2026-08-17"
  clockInAt: string | null; // ISO timestamp
  clockOutAt: string | null;
  totalMinutes: number | null;
  status: AttendanceStatus;
  late: boolean;
};

export const FORTUNIQ_TIMEZONE = "Africa/Johannesburg";

/** Renders a Date as a YYYY-MM-DD calendar date in the FortunIQ (South African) timezone. */
export function toSATDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: FORTUNIQ_TIMEZONE }); // en-CA gives YYYY-MM-DD
}

export function toSATTimeString(date: Date): string {
  return date.toLocaleTimeString("en-GB", { timeZone: FORTUNIQ_TIMEZONE, hour: "2-digit", minute: "2-digit" });
}

/**
 * Whether clocking in is allowed right now: only if there is no existing
 * record for today, or today's record exists but was never clocked in
 * (defensive — shouldn't normally happen). This is what actually
 * prevents duplicate Clock Ins — see docs/ATTENDANCE.md.
 */
export function canClockIn(existingTodayRecord: AttendanceRecord | null): { allowed: boolean; reason?: string } {
  if (!existingTodayRecord) return { allowed: true };
  if (existingTodayRecord.clockInAt) {
    return { allowed: false, reason: `You clocked in at ${new Date(existingTodayRecord.clockInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: FORTUNIQ_TIMEZONE })}` };
  }
  return { allowed: true };
}

export function canClockOut(existingTodayRecord: AttendanceRecord | null): { allowed: boolean; reason?: string } {
  if (!existingTodayRecord || !existingTodayRecord.clockInAt) {
    return { allowed: false, reason: "You haven't clocked in yet today." };
  }
  if (existingTodayRecord.clockOutAt) {
    return { allowed: false, reason: "You've already clocked out today." };
  }
  return { allowed: true };
}

/** Whole minutes between clock-in and clock-out. Never negative. */
export function computeMinutesWorked(clockInAt: string, clockOutAt: string): number {
  const minutes = Math.round((new Date(clockOutAt).getTime() - new Date(clockInAt).getTime()) / 60000);
  return Math.max(0, minutes);
}

export function formatDuration(totalMinutes: number | null): string {
  if (totalMinutes === null || totalMinutes < 0) return "—";
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m`;
}

/**
 * Late is determined against a configurable work-start time + grace
 * period — no hard-coded employment rule beyond a sensible default, per
 * the brief's "do not hard-code employment rules unnecessarily." Callers
 * that haven't configured working hours yet can omit the second
 * argument entirely; late is then always false rather than guessed.
 */
export type WorkingHoursConfig = { startHour: number; startMinute: number; graceMinutes: number };

export function isLateClockIn(clockInAt: string, config?: WorkingHoursConfig): boolean {
  if (!config) return false;
  const d = new Date(clockInAt);
  const localHour = Number(d.toLocaleString("en-US", { timeZone: FORTUNIQ_TIMEZONE, hour: "2-digit", hour12: false }));
  const localMinute = Number(d.toLocaleString("en-US", { timeZone: FORTUNIQ_TIMEZONE, minute: "2-digit" }));
  const actualMinutesFromMidnight = localHour * 60 + localMinute;
  const cutoff = config.startHour * 60 + config.startMinute + config.graceMinutes;
  return actualMinutesFromMidnight > cutoff;
}

/**
 * A record left "Clocked In" from a previous calendar day (not today) is
 * a missed clock-out and should be surfaced to HR, per the brief. Only
 * ever compares calendar dates, never assumes a specific cutoff time.
 */
export function isMissingClockOut(record: AttendanceRecord, todayDateString: string): boolean {
  return record.status === "Clocked In" && record.attendanceDate !== todayDateString && !record.clockOutAt;
}
