// Pure logic for the Daily Planner (Project ORION). Zero DB/Next
// dependencies, same pattern as every other *-core.ts file in this app.
//
// Deliberately built on TOP of the existing `calendar_events` table
// rather than a new parallel schedule — a "time block" is just a
// calendar event that carries a duration and an optional category, per
// the "avoid a second system" principle used throughout ORION (see
// tasks-core.ts's Company/Personal split, workflow-core.ts). This also
// means every planner block automatically flows through the same
// Outlook two-way sync as the rest of the calendar — see
// docs/EMPLOYEE_DASHBOARD.md for why that satisfies the brief's
// "optional Outlook sync" without a second Graph integration.

export type PlannerBlockCategory = "Deep Work" | "Meeting" | "Task" | "Break" | "Personal";

export const PLANNER_BLOCK_CATEGORIES: PlannerBlockCategory[] = ["Deep Work", "Meeting", "Task", "Break", "Personal"];

export interface PlannerBlock {
  id: string;
  title: string;
  startTime: string; // "HH:MM"
  durationMinutes: number;
  category: PlannerBlockCategory;
  recordUrl: string | null;
  moduleKey: string | null;
  source: "fortuniq" | "outlook";
}

export interface PlannerBlockInput {
  title?: unknown;
  startTime?: unknown;
  durationMinutes?: unknown;
  category?: unknown;
}

export function validatePlannerBlockInput(input: PlannerBlockInput): string | null {
  if (typeof input.title !== "string" || input.title.trim().length === 0) return "A time block needs a title.";
  if (input.title.trim().length > 200) return "Title must be 200 characters or fewer.";
  if (typeof input.startTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) {
    return "Start time must be in HH:MM (24-hour) format.";
  }
  if (typeof input.durationMinutes !== "number" || !Number.isFinite(input.durationMinutes) || input.durationMinutes < 5 || input.durationMinutes > 720) {
    return "Duration must be between 5 minutes and 12 hours.";
  }
  if (input.category !== undefined && input.category !== null && !PLANNER_BLOCK_CATEGORIES.includes(input.category as PlannerBlockCategory)) {
    return "Invalid block category.";
  }
  return null;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function sortBlocksByTime(blocks: PlannerBlock[]): PlannerBlock[] {
  return [...blocks].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}

export interface BlockOverlapWarning {
  blockId: string;
  overlapsWithId: string;
}

/**
 * Flags overlapping blocks for the UI to warn about — never blocks the
 * save. A day plan is the employee's own; two things genuinely can
 * happen "at once" (a call during a meeting), so this is advisory only.
 */
export function findOverlappingBlocks(blocks: PlannerBlock[]): BlockOverlapWarning[] {
  const sorted = sortBlocksByTime(blocks);
  const warnings: BlockOverlapWarning[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const currentEnd = toMinutes(current.startTime) + current.durationMinutes;
    if (currentEnd > toMinutes(next.startTime)) {
      warnings.push({ blockId: current.id, overlapsWithId: next.id });
    }
  }
  return warnings;
}

/** Total planned minutes for the day — used for a lightweight "X hours planned" summary line. */
export function totalPlannedMinutes(blocks: PlannerBlock[]): number {
  return blocks.reduce((sum, b) => sum + b.durationMinutes, 0);
}
