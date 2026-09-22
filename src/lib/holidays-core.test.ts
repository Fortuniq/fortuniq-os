import { describe, it, expect } from "vitest";
import {
  computeEasterSunday, nthWeekdayOfMonth, getSouthAfricanPublicHolidays,
  getInternationalObservances, getSpecialDays, getSpecialDaysInRange,
} from "./holidays-core";

describe("computeEasterSunday", () => {
  it("matches known historical Easter dates", () => {
    expect(computeEasterSunday(2023)).toBe("2023-04-09");
    expect(computeEasterSunday(2024)).toBe("2024-03-31");
  });
});

describe("nthWeekdayOfMonth", () => {
  it("finds the 2nd Sunday of May 2026", () => {
    // May 1 2026 is a Friday, so the first Sunday is May 3, the second is May 10.
    expect(nthWeekdayOfMonth(2026, 5, 0, 2)).toBe("2026-05-10");
  });
});

describe("getSouthAfricanPublicHolidays", () => {
  it("includes all 10 fixed-date holidays plus Good Friday and Family Day", () => {
    const holidays = getSouthAfricanPublicHolidays(2024);
    const names = holidays.map((h) => h.name);
    expect(names).toContain("New Year's Day");
    expect(names).toContain("Christmas Day");
    expect(names).toContain("Good Friday");
    expect(names).toContain("Family Day");
    expect(holidays.length).toBeGreaterThanOrEqual(12);
  });

  it("computes Good Friday and Family Day relative to Easter Sunday", () => {
    const holidays = getSouthAfricanPublicHolidays(2024); // Easter Sunday = 2024-03-31
    const goodFriday = holidays.find((h) => h.name === "Good Friday");
    const familyDay = holidays.find((h) => h.name === "Family Day");
    expect(goodFriday?.date).toBe("2024-03-29");
    expect(familyDay?.date).toBe("2024-04-01");
  });

  it("adds an observed Monday when a fixed holiday falls on a Sunday", () => {
    // 2028-01-01 is a Saturday, not a Sunday — pick a year where a fixed
    // holiday genuinely lands on a Sunday: 2023-01-01 was a Sunday.
    const holidays = getSouthAfricanPublicHolidays(2023);
    const observed = holidays.filter((h) => h.name.includes("(observed)"));
    expect(observed.some((h) => h.date === "2023-01-02" && h.name === "New Year's Day (observed)")).toBe(true);
  });

  it("marks everything as public-holiday", () => {
    const holidays = getSouthAfricanPublicHolidays(2026);
    expect(holidays.every((h) => h.kind === "public-holiday")).toBe(true);
  });
});

describe("getInternationalObservances", () => {
  it("includes well-known fixed-date observances", () => {
    const days = getInternationalObservances(2026);
    const names = days.map((d) => d.name);
    expect(names).toContain("Valentine's Day");
    expect(names).toContain("Nelson Mandela International Day");
    expect(names).toContain("Mother's Day");
    expect(names).toContain("Father's Day");
  });

  it("marks everything as international-day", () => {
    const days = getInternationalObservances(2026);
    expect(days.every((d) => d.kind === "international-day")).toBe(true);
  });
});

describe("getSpecialDays", () => {
  it("combines and sorts both lists", () => {
    const days = getSpecialDays(2026);
    const dates = days.map((d) => d.date);
    expect(dates).toEqual([...dates].sort());
    expect(days.some((d) => d.kind === "public-holiday")).toBe(true);
    expect(days.some((d) => d.kind === "international-day")).toBe(true);
  });
});

describe("getSpecialDaysInRange", () => {
  it("filters to the given window", () => {
    const days = getSpecialDaysInRange("2026-12-20", "2027-01-05");
    const names = days.map((d) => d.name);
    expect(names).toContain("Christmas Day");
    expect(names).toContain("New Year's Day");
    expect(days.every((d) => d.date >= "2026-12-20" && d.date <= "2027-01-05")).toBe(true);
  });
});
