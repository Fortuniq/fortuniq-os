import { describe, it, expect } from "vitest";
import {
  canClockIn, canClockOut, computeMinutesWorked, formatDuration,
  isLateClockIn, isMissingClockOut, toSATDateString, type AttendanceRecord,
} from "./attendance-core";

function record(overrides: Partial<AttendanceRecord>): AttendanceRecord {
  return {
    id: "1", employeeEmail: "person@iqfuels.co.za", attendanceDate: "2026-08-17",
    clockInAt: null, clockOutAt: null, totalMinutes: null, status: "Clocked In", late: false,
    ...overrides,
  };
}

describe("canClockIn", () => {
  it("allows clocking in when there's no record for today yet", () => {
    expect(canClockIn(null)).toEqual({ allowed: true });
  });

  it("blocks a second clock-in for the same day", () => {
    const result = canClockIn(record({ clockInAt: "2026-08-17T06:03:00Z" }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("You clocked in at");
  });
});

describe("canClockOut", () => {
  it("blocks clocking out before clocking in", () => {
    expect(canClockOut(null).allowed).toBe(false);
  });

  it("allows clocking out once clocked in and not yet clocked out", () => {
    expect(canClockOut(record({ clockInAt: "2026-08-17T06:03:00Z" })).allowed).toBe(true);
  });

  it("blocks a second clock-out for the same session", () => {
    const result = canClockOut(record({ clockInAt: "2026-08-17T06:03:00Z", clockOutAt: "2026-08-17T14:30:00Z" }));
    expect(result.allowed).toBe(false);
  });
});

describe("computeMinutesWorked", () => {
  it("computes whole minutes between clock-in and clock-out", () => {
    expect(computeMinutesWorked("2026-08-17T06:00:00Z", "2026-08-17T14:30:00Z")).toBe(510);
  });

  it("never returns a negative duration", () => {
    expect(computeMinutesWorked("2026-08-17T14:00:00Z", "2026-08-17T06:00:00Z")).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formats hours and minutes with zero-padding", () => {
    expect(formatDuration(267)).toBe("04h 27m");
    expect(formatDuration(0)).toBe("00h 00m");
  });

  it("renders an em-dash when there's no duration yet", () => {
    expect(formatDuration(null)).toBe("—");
  });
});

describe("isLateClockIn", () => {
  it("returns false when no working-hours config has been set up yet, never a guess", () => {
    expect(isLateClockIn("2026-08-17T10:00:00Z")).toBe(false);
  });

  it("flags a clock-in after start time + grace period", () => {
    // 09:15 SAST is 07:15 UTC (SAST = UTC+2)
    const late = isLateClockIn("2026-08-17T07:15:00.000Z", { startHour: 8, startMinute: 0, graceMinutes: 15 });
    expect(late).toBe(true);
  });

  it("does not flag a clock-in within the grace period", () => {
    // 08:10 SAST is 06:10 UTC
    const onTime = isLateClockIn("2026-08-17T06:10:00.000Z", { startHour: 8, startMinute: 0, graceMinutes: 15 });
    expect(onTime).toBe(false);
  });
});

describe("isMissingClockOut", () => {
  it("flags a record still Clocked In from a previous day", () => {
    const r = record({ status: "Clocked In", attendanceDate: "2026-08-14", clockOutAt: null });
    expect(isMissingClockOut(r, "2026-08-17")).toBe(true);
  });

  it("does not flag today's still-open session", () => {
    const r = record({ status: "Clocked In", attendanceDate: "2026-08-17", clockOutAt: null });
    expect(isMissingClockOut(r, "2026-08-17")).toBe(false);
  });
});

describe("toSATDateString", () => {
  it("produces a YYYY-MM-DD date string", () => {
    expect(toSATDateString(new Date("2026-08-17T22:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
