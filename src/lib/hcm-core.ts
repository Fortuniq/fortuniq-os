// Pure logic for Identity, Leave, Performance, and Payroll — zero
// dependencies on Next.js or Supabase, same testable-core pattern as
// every other *-core.ts file in this app. See docs/HCM_PHASE3.md and
// hcm-core.test.ts.

import type { UserPermissions } from "./permissions-core";

// =========================================================================
// IDENTITY
// =========================================================================

/**
 * Masks a South African ID number (or similar) down to the last three
 * digits — "****** **** 082" style, matching the brief's own example
 * exactly. Anything under 3 characters is fully masked (nothing
 * meaningful left to reveal).
 */
export function maskIdNumber(idNumber: string | null): string {
  if (!idNumber) return "—";
  const digits = idNumber.trim();
  if (digits.length <= 3) return "*".repeat(digits.length);
  const last3 = digits.slice(-3);
  const maskedLength = digits.length - 3;
  const first = "*".repeat(Math.min(6, maskedLength));
  const rest = maskedLength > 6 ? " " + "*".repeat(maskedLength - 6) : "";
  return `${first}${rest} ${last3}`;
}

/**
 * HR/Super Admin see full Identity. The employee themselves sees their
 * own, but MASKED (see maskIdNumber) — "view" per the brief does not
 * mean "view unmasked." Nobody else, including Manager, sees Identity
 * at all.
 */
export function canViewIdentity(viewer: UserPermissions, employeeEmail: string | null | undefined): "full" | "masked" | "none" {
  if (viewer.status !== "active" && viewer.status !== "no-database") return "none";
  if (viewer.isAdmin) return "full";
  if (viewer.role === "HR/Admin") return "full";
  const isOwn = !!viewer.email && !!employeeEmail && viewer.email.toLowerCase() === employeeEmail.toLowerCase();
  return isOwn ? "masked" : "none";
}

// =========================================================================
// PAYROLL
// =========================================================================

/**
 * Payroll is Finance/HR/Super Admin ONLY. Deliberately does NOT extend
 * to the employee themselves — the brief is explicit: "Employees should
 * NOT see salary or payroll information at this stage." Managers never
 * see it either.
 */
export function canViewPayroll(viewer: UserPermissions): boolean {
  if (viewer.status !== "active" && viewer.status !== "no-database") return false;
  if (viewer.isAdmin) return true;
  return viewer.role === "Finance" || viewer.role === "HR/Admin";
}

// =========================================================================
// MANAGER RELATIONSHIP
// =========================================================================
// "Manager" is not a new top-level RoleKey — it's derived from the
// existing employees.manager_id relationship. Anyone, regardless of
// their RoleKey, gets manager-scoped access to whoever's manager_id
// points at them.

export function isDirectManagerOf(viewerEmployeeId: string | null, targetManagerId: string | null): boolean {
  return !!viewerEmployeeId && !!targetManagerId && viewerEmployeeId === targetManagerId;
}

/** Managers see team members' Leave requests and can create Performance reviews for them — nothing else HR-restricted. */
export function canManagerAccessTeamMember(viewer: UserPermissions, viewerEmployeeId: string | null, targetManagerId: string | null): boolean {
  if (viewer.status !== "active" && viewer.status !== "no-database") return false;
  if (viewer.isAdmin || viewer.role === "HR/Admin") return true;
  return isDirectManagerOf(viewerEmployeeId, targetManagerId);
}

// =========================================================================
// LEAVE
// =========================================================================

export type LeaveType = "Annual" | "Sick" | "Family Responsibility" | "Study" | "Maternity" | "Paternity" | "Unpaid";
export type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";
export type LeaveBalance = { annual: number; sick: number; family_responsibility: number; study: number };

/**
 * Working days between two dates, inclusive, excluding weekends. Public
 * holidays are a documented future enhancement per the brief — this
 * deliberately does not hard-code a holiday calendar that would go
 * stale year to year.
 */
export function calculateWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  if (end < start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

const LEAVE_TYPE_TO_BALANCE_KEY: Partial<Record<LeaveType, keyof LeaveBalance>> = {
  "Annual": "annual",
  "Sick": "sick",
  "Family Responsibility": "family_responsibility",
  "Study": "study",
};

/** Maternity/Paternity/Unpaid don't draw down a tracked balance bucket. */
export function balanceKeyForLeaveType(leaveType: LeaveType): keyof LeaveBalance | null {
  return LEAVE_TYPE_TO_BALANCE_KEY[leaveType] ?? null;
}

export function canTransitionLeaveStatus(from: LeaveStatus, to: LeaveStatus): boolean {
  const allowed: Record<LeaveStatus, LeaveStatus[]> = {
    "Pending": ["Approved", "Rejected", "Cancelled"],
    "Approved": ["Cancelled"],
    "Rejected": [],
    "Cancelled": [],
  };
  return from === to || allowed[from]?.includes(to);
}

/**
 * Deducts requested days from the matching balance bucket — called only
 * when a request moves to Approved. Never goes negative.
 */
export function deductLeaveBalance(balance: LeaveBalance, leaveType: LeaveType, days: number): LeaveBalance {
  const key = balanceKeyForLeaveType(leaveType);
  if (!key) return balance;
  return { ...balance, [key]: Math.max(0, balance[key] - days) };
}

/** The exact inverse of deductLeaveBalance — used when an Approved request is later Cancelled. */
export function restoreLeaveBalance(balance: LeaveBalance, leaveType: LeaveType, days: number): LeaveBalance {
  const key = balanceKeyForLeaveType(leaveType);
  if (!key) return balance;
  return { ...balance, [key]: balance[key] + days };
}

// =========================================================================
// DASHBOARD REMINDERS
// =========================================================================

/** Whether a date falls within the next N days from today (0 = today, negative = already past — never matches). */
export function isWithinDays(dateStr: string | null, days: number, today: Date = new Date()): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((target.getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= days;
}

/** True when a recurring annual date (birthday, work anniversary) falls today, comparing month+day only. */
export function isAnniversaryToday(dateStr: string | null, today: Date = new Date()): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr + "T00:00:00");
  return target.getMonth() === today.getMonth() && target.getDate() === today.getDate();
}
