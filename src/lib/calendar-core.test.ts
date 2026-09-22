import { describe, it, expect } from "vitest";
import { buildMonthGrid, groupEventsByDate, addMonths } from "./calendar-core";

describe("buildMonthGrid", () => {
  it("returns 42 cells starting on a Monday", () => {
    const grid = buildMonthGrid(2026, 8, "2026-09-22"); // September 2026
    expect(grid.length).toBe(42);
    const firstDate = new Date(grid[0].date + "T00:00:00Z");
    expect((firstDate.getUTCDay() + 6) % 7).toBe(0);
  });
  it("marks today correctly", () => {
    const grid = buildMonthGrid(2026, 8, "2026-09-22");
    const todayCell = grid.find((c) => c.date === "2026-09-22");
    expect(todayCell?.isToday).toBe(true);
  });
  it("marks days outside the target month", () => {
    const grid = buildMonthGrid(2026, 8, "2026-09-22");
    expect(grid.some((c) => !c.inCurrentMonth)).toBe(true);
    expect(grid.filter((c) => c.inCurrentMonth).length).toBe(30); // September has 30 days
  });
});

describe("groupEventsByDate", () => {
  it("groups events sharing a date", () => {
    const events = [{ eventDate: "2026-09-22", id: 1 }, { eventDate: "2026-09-22", id: 2 }, { eventDate: "2026-09-23", id: 3 }];
    const grouped = groupEventsByDate(events);
    expect(grouped.get("2026-09-22")?.length).toBe(2);
    expect(grouped.get("2026-09-23")?.length).toBe(1);
  });
});

describe("addMonths", () => {
  it("advances within a year", () => {
    expect(addMonths(2026, 8, 1)).toEqual({ year: 2026, monthIndex0: 9 });
  });
  it("rolls over into the next year", () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, monthIndex0: 0 });
  });
  it("rolls back into the previous year", () => {
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, monthIndex0: 11 });
  });
});
