// Pure logic for "My Focus Today" (Project ORION). Zero DB/Next
// dependencies, same pattern as every other *-core.ts file in this app.
// See docs/EMPLOYEE_DASHBOARD.md.
//
// The brief is explicit: this is NOT another task list. It answers one
// question — "what is the single most important thing I need to
// accomplish today?" — and only ONE focus may be active per employee at
// a time. The underlying work item still lives in My Tasks / My
// Workflow / Calendar / Tenders / Finance; this is a shortcut/highlight
// on top of it, never a second source of truth for the work itself.

export type FocusSource = "Employee" | "Intelligence" | "Manager";
export type FocusStatus = "Not Started" | "In Progress" | "Waiting" | "Blocked" | "Complete";
export type FocusModule = "tenders" | "finance" | "tasks" | "calendar" | "academy";

export interface EmployeeFocus {
  id: string;
  employeeEmail: string;
  title: string;
  moduleKey: FocusModule | null;
  relatedLabel: string | null; // tender/customer/task name, where applicable
  relatedUrl: string | null; // where "Continue" goes
  workflowStage: string | null;
  priority: string | null;
  dueDate: string | null; // ISO date
  estimatedTime: string | null; // free text, e.g. "2 hours"
  progressPct: number | null;
  status: FocusStatus;
  source: FocusSource;
  assignedBy: string | null; // manager email, only when source === "Manager"
  notes: string | null;
  focusDate: string; // ISO date — the workday this focus belongs to
  isActive: boolean;
  lastActivityAt: string;
  createdAt: string;
  completedAt: string | null;
}

/** A candidate item eligible to become a focus — assembled by the caller from already-fetched Company tasks, Personal tasks, workflow items, and upcoming calendar events. Deliberately NOT a new data source: see docs. */
export interface FocusCandidate {
  key: string; // stable id for "Set as My Focus" — e.g. `task:123`
  title: string;
  moduleKey: FocusModule | null;
  relatedLabel: string | null;
  relatedUrl: string | null;
  workflowStage: string | null;
  priority: string | null; // "High" | "Medium" | "Low" | null
  dueDate: string | null;
  isOverdue: boolean;
  isMeeting: boolean; // upcoming calendar event, for "upcoming meetings" signal
}

export interface FocusInput {
  title?: unknown;
  moduleKey?: unknown;
  relatedLabel?: unknown;
  relatedUrl?: unknown;
  workflowStage?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  estimatedTime?: unknown;
}

const VALID_MODULES: FocusModule[] = ["tenders", "finance", "tasks", "calendar", "academy"];
const VALID_STATUSES: FocusStatus[] = ["Not Started", "In Progress", "Waiting", "Blocked", "Complete"];

export function validateFocusInput(input: FocusInput): string | null {
  if (typeof input.title !== "string" || input.title.trim().length === 0) return "A focus needs a title.";
  if (input.title.trim().length > 200) return "Title must be 200 characters or fewer.";
  if (input.moduleKey !== undefined && input.moduleKey !== null && !VALID_MODULES.includes(input.moduleKey as FocusModule)) {
    return "Invalid module.";
  }
  return null;
}

export function isValidFocusStatus(value: unknown): value is FocusStatus {
  return typeof value === "string" && (VALID_STATUSES as string[]).includes(value);
}

export function isValidProgressPct(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

/**
 * "FortunIQ Intelligence Recommendation" — a deterministic, explainable
 * scoring rule over the candidates the caller already fetched for the
 * dashboard (no external AI/LLM call, no new data source — same
 * "real logic now, architected for future automation" posture as
 * Market News's `source` field). Never invents data: a candidate's
 * score is built entirely from fields already on it.
 *
 * Scoring (highest wins): overdue work outranks everything, then
 * closer due dates, then priority, then an upcoming meeting today
 * nudges a candidate up (per the brief's "upcoming meetings" signal).
 * "Manager priorities" and "tender closing dates" fall naturally out
 * of this — a manager-assigned Company task IS a manager priority, and
 * a tender's closing-date task already carries the earliest due date.
 */
export function scoreFocusCandidate(candidate: FocusCandidate, today: string): number {
  let score = 0;
  if (candidate.isOverdue) score += 1000;
  if (candidate.dueDate) {
    const daysOut = daysBetween(today, candidate.dueDate);
    // Closer due dates score higher; clamp so far-future dates don't go negative.
    score += Math.max(0, 200 - daysOut * 10);
  }
  const priorityScore: Record<string, number> = { High: 60, Medium: 30, Low: 10 };
  score += priorityScore[candidate.priority ?? ""] ?? 0;
  if (candidate.isMeeting && candidate.dueDate === today) score += 40;
  return score;
}

/** The single top-recommended candidate, or null if there are none — never fabricates a recommendation from nothing. */
export function recommendFocus(candidates: FocusCandidate[], today: string): FocusCandidate | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => scoreFocusCandidate(b, today) - scoreFocusCandidate(a, today))[0];
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00").getTime();
  const to = new Date(toISO + "T00:00:00").getTime();
  return Math.round((to - from) / 86400000);
}

export function daysRemaining(dueDate: string | null, today: string): number | null {
  if (!dueDate) return null;
  return daysBetween(today, dueDate);
}

/**
 * Daily reset check: an active focus whose `focusDate` is before today,
 * and that isn't already Complete, must never be silently dropped or
 * silently carried forward — the employee is asked what to do with it.
 * A focus dated today (already decided on, or newly set today) needs no
 * prompt at all.
 */
export function needsDailyResetPrompt(focus: EmployeeFocus | null, today: string): boolean {
  if (!focus) return false;
  if (focus.status === "Complete") return false;
  return focus.focusDate < today;
}
