// Pure logic for South African public holidays + a curated list of
// international observance days, shown on the Personal Calendar and
// dashboard "My Calendar / Upcoming" preview. Zero DB/Next dependencies,
// same pattern as every other *-core.ts file in this app.
//
// Deliberately NOT stored as calendar_events rows: a public holiday or
// "World Health Day" isn't any one employee's event — calendar_events is
// scoped per employee_email, so storing these there would mean either
// one row per employee (wasteful, drifts the moment someone new joins)
// or a schema change to make employee_email nullable everywhere it's
// used (a bigger, riskier change for something that's really just a
// yearly-computable fact). Instead these are computed on the fly for
// whatever year is being viewed and merged into the calendar display —
// always up to date, nothing to seed or maintain in the database.
//
// South African public holidays list is fixed by the Public Holidays
// Act 36 of 1994 (the 12 national holidays) plus the Act's own
// "Mondayisation" rule (s.2(1)): when a holiday falls on a Sunday, the
// following Monday is also a public holiday. Good Friday and Family Day
// (Easter Monday) are computed from Easter Sunday, which itself never
// falls on the fixed-date holidays' clash date, so Mondayisation only
// ever applies to the fixed-date list below.

export type SpecialDayKind = "public-holiday" | "international-day";

export interface SpecialDay {
  date: string; // ISO date
  name: string;
  kind: SpecialDayKind;
}

/**
 * Anonymous Gregorian algorithm (Meeus/Jones/Butcher) — the standard
 * closed-form way to compute the date of Easter Sunday for any Gregorian
 * calendar year. Returns the ISO date.
 */
export function computeEasterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(iso: string): number {
  return new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = Sunday
}

const FIXED_SA_PUBLIC_HOLIDAYS: { md: string; name: string }[] = [
  { md: "01-01", name: "New Year's Day" },
  { md: "03-21", name: "Human Rights Day" },
  { md: "04-27", name: "Freedom Day" },
  { md: "05-01", name: "Workers' Day" },
  { md: "06-16", name: "Youth Day" },
  { md: "08-09", name: "National Women's Day" },
  { md: "09-24", name: "Heritage Day" },
  { md: "12-16", name: "Day of Reconciliation" },
  { md: "12-25", name: "Christmas Day" },
  { md: "12-26", name: "Day of Goodwill" },
];

/** The 12 national public holidays for a given year, including Good Friday/Family Day (from Easter) and s.2(1) "Mondayisation" for any fixed-date holiday that falls on a Sunday. */
export function getSouthAfricanPublicHolidays(year: number): SpecialDay[] {
  const days: SpecialDay[] = [];

  for (const { md, name } of FIXED_SA_PUBLIC_HOLIDAYS) {
    const date = `${year}-${md}`;
    days.push({ date, name, kind: "public-holiday" });
    if (weekdayOf(date) === 0) {
      days.push({ date: addDays(date, 1), name: `${name} (observed)`, kind: "public-holiday" });
    }
  }

  const easter = computeEasterSunday(year);
  days.push({ date: addDays(easter, -2), name: "Good Friday", kind: "public-holiday" });
  days.push({ date: addDays(easter, 1), name: "Family Day", kind: "public-holiday" });

  return days.sort((a, b) => a.date.localeCompare(b.date));
}

/** The nth (1-based) occurrence of a weekday (0=Sunday..6=Saturday) in a given month — used for Mother's/Father's Day below. */
export function nthWeekdayOfMonth(year: number, month1to12: number, weekday: number, n: number): string {
  const first = new Date(Date.UTC(year, month1to12 - 1, 1));
  const firstWeekday = first.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return `${year}-${String(month1to12).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const FIXED_INTERNATIONAL_DAYS: { md: string; name: string }[] = [
  { md: "02-14", name: "Valentine's Day" },
  { md: "03-08", name: "International Women's Day" },
  { md: "03-20", name: "International Day of Happiness" },
  { md: "04-07", name: "World Health Day" },
  { md: "04-22", name: "Earth Day" },
  { md: "04-23", name: "World Book Day" },
  { md: "05-03", name: "World Press Freedom Day" },
  { md: "05-15", name: "International Day of Families" },
  { md: "05-31", name: "World No Tobacco Day" },
  { md: "06-05", name: "World Environment Day" },
  { md: "06-08", name: "World Oceans Day" },
  { md: "06-20", name: "World Refugee Day" },
  { md: "07-11", name: "World Population Day" },
  { md: "07-18", name: "Nelson Mandela International Day" },
  { md: "08-12", name: "International Youth Day" },
  { md: "08-19", name: "World Humanitarian Day" },
  { md: "09-08", name: "International Literacy Day" },
  { md: "09-21", name: "International Day of Peace" },
  { md: "09-27", name: "World Tourism Day" },
  { md: "10-01", name: "International Day of Older Persons" },
  { md: "10-05", name: "World Teachers' Day" },
  { md: "10-10", name: "World Mental Health Day" },
  { md: "10-16", name: "World Food Day" },
  { md: "10-24", name: "United Nations Day" },
  { md: "11-14", name: "World Diabetes Day" },
  { md: "11-19", name: "International Men's Day" },
  { md: "11-20", name: "Universal Children's Day" },
  { md: "11-25", name: "International Day for the Elimination of Violence against Women" },
  { md: "12-01", name: "World AIDS Day" },
  { md: "12-03", name: "International Day of Persons with Disabilities" },
  { md: "12-10", name: "International Human Rights Day" },
];

/**
 * A curated shortlist (~30 days) of internationally/commercially
 * well-known observance days — not the full ~150-day UN official list,
 * by explicit choice, to keep the calendar readable. Add more by
 * extending FIXED_INTERNATIONAL_DAYS above (or the variable-date ones
 * below) — this is a static, hand-maintained list, not fetched from
 * anywhere, same "real data, no external API" posture as Market News.
 */
export function getInternationalObservances(year: number): SpecialDay[] {
  const days: SpecialDay[] = FIXED_INTERNATIONAL_DAYS.map(({ md, name }) => ({
    date: `${year}-${md}`,
    name,
    kind: "international-day" as const,
  }));

  // Mother's Day / Father's Day (South African dates — same as the
  // US/most of the Southern Hemisphere: 2nd Sunday of May, 3rd Sunday
  // of June — rather than the UK's separate "Mothering Sunday").
  days.push({ date: nthWeekdayOfMonth(year, 5, 0, 2), name: "Mother's Day", kind: "international-day" });
  days.push({ date: nthWeekdayOfMonth(year, 6, 0, 3), name: "Father's Day", kind: "international-day" });

  return days.sort((a, b) => a.date.localeCompare(b.date));
}

/** Both lists combined and sorted — what the calendar UI actually renders. */
export function getSpecialDays(year: number): SpecialDay[] {
  return [...getSouthAfricanPublicHolidays(year), ...getInternationalObservances(year)].sort((a, b) => a.date.localeCompare(b.date));
}

/** Special days across a date range that may span two calendar years (e.g. a month grid's leading/trailing days, or a 14-day upcoming window over New Year). */
export function getSpecialDaysInRange(fromISODate: string, toISODate: string): SpecialDay[] {
  const fromYear = Number(fromISODate.slice(0, 4));
  const toYear = Number(toISODate.slice(0, 4));
  const years = new Set<number>();
  for (let y = fromYear; y <= toYear; y++) years.add(y);
  const all = [...years].flatMap((y) => getSpecialDays(y));
  return all.filter((d) => d.date >= fromISODate && d.date <= toISODate);
}
