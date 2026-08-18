import { describe, it, expect } from "vitest";
import {
  maskIdNumber, canViewIdentity, canViewPayroll, isDirectManagerOf, canManagerAccessTeamMember,
  calculateWorkingDays, balanceKeyForLeaveType, canTransitionLeaveStatus, deductLeaveBalance, restoreLeaveBalance,
  isWithinDays, isAnniversaryToday,
  type LeaveBalance,
} from "./hcm-core";
import type { UserPermissions, RoleKey } from "./permissions-core";

function activeUser(role: RoleKey, email = "test@iqfuels.co.za"): UserPermissions {
  return { status: "active", email, name: "Test User", role, isAdmin: role === "Super Admin", allowedModules: [] };
}

describe("maskIdNumber", () => {
  it("masks down to the last 3 digits, matching the brief's example format", () => {
    expect(maskIdNumber("8501015800082")).toBe("****** **** 082");
  });
  it("fully masks a short value", () => {
    expect(maskIdNumber("12")).toBe("**");
  });
  it("returns an em-dash for no ID at all", () => {
    expect(maskIdNumber(null)).toBe("—");
  });
});

describe("canViewIdentity", () => {
  it("HR/Admin and Super Admin get full access to anyone's Identity", () => {
    expect(canViewIdentity(activeUser("HR/Admin"), "someone@iqfuels.co.za")).toBe("full");
    expect(canViewIdentity(activeUser("Super Admin"), "someone@iqfuels.co.za")).toBe("full");
  });
  it("an employee sees their own Identity, but only masked", () => {
    const emp = activeUser("Employee", "me@iqfuels.co.za");
    expect(canViewIdentity(emp, "me@iqfuels.co.za")).toBe("masked");
  });
  it("an employee gets no access to someone else's Identity", () => {
    const emp = activeUser("Employee", "me@iqfuels.co.za");
    expect(canViewIdentity(emp, "someone-else@iqfuels.co.za")).toBe("none");
  });
  it("a signed-out person gets nothing", () => {
    const signedOut: UserPermissions = { status: "signed-out", isAdmin: false, allowedModules: [] };
    expect(canViewIdentity(signedOut, "anyone@iqfuels.co.za")).toBe("none");
  });
});

describe("canViewPayroll", () => {
  it("Finance, HR/Admin, and Super Admin can view payroll", () => {
    expect(canViewPayroll(activeUser("Finance"))).toBe(true);
    expect(canViewPayroll(activeUser("HR/Admin"))).toBe(true);
    expect(canViewPayroll(activeUser("Super Admin"))).toBe(true);
  });
  it("an employee cannot view even their OWN payroll — no self-access exception, unlike banking", () => {
    expect(canViewPayroll(activeUser("Employee"))).toBe(false);
  });
  it("Management and Sales/Marketing cannot view payroll", () => {
    expect(canViewPayroll(activeUser("Management"))).toBe(false);
    expect(canViewPayroll(activeUser("Sales/Marketing"))).toBe(false);
  });
});

describe("isDirectManagerOf / canManagerAccessTeamMember", () => {
  it("identifies a direct manager relationship via manager_id", () => {
    expect(isDirectManagerOf("mgr-1", "mgr-1")).toBe(true);
    expect(isDirectManagerOf("mgr-1", "mgr-2")).toBe(false);
  });
  it("grants a manager access to their own direct report", () => {
    const manager = activeUser("Employee");
    expect(canManagerAccessTeamMember(manager, "mgr-1", "mgr-1")).toBe(true);
  });
  it("denies a non-manager, non-HR colleague access to someone who isn't their report", () => {
    const colleague = activeUser("Employee");
    expect(canManagerAccessTeamMember(colleague, "someone-else", "mgr-1")).toBe(false);
  });
  it("HR/Admin and Super Admin always have team access regardless of the manager_id relationship", () => {
    expect(canManagerAccessTeamMember(activeUser("HR/Admin"), null, "mgr-1")).toBe(true);
    expect(canManagerAccessTeamMember(activeUser("Super Admin"), null, "mgr-1")).toBe(true);
  });
});

describe("calculateWorkingDays", () => {
  it("counts a single weekday as 1 day", () => {
    expect(calculateWorkingDays("2026-08-17", "2026-08-17")).toBe(1); // Monday
  });
  it("excludes weekends from a range spanning a full week", () => {
    // Mon 2026-08-17 to Fri 2026-08-21 = 5 working days
    expect(calculateWorkingDays("2026-08-17", "2026-08-21")).toBe(5);
    // Mon 2026-08-17 to Sun 2026-08-23 = still 5 (weekend excluded)
    expect(calculateWorkingDays("2026-08-17", "2026-08-23")).toBe(5);
  });
  it("returns 0 for an end date before the start date", () => {
    expect(calculateWorkingDays("2026-08-21", "2026-08-17")).toBe(0);
  });
});

describe("balanceKeyForLeaveType", () => {
  it("maps tracked leave types to their balance bucket", () => {
    expect(balanceKeyForLeaveType("Annual")).toBe("annual");
    expect(balanceKeyForLeaveType("Sick")).toBe("sick");
  });
  it("returns null for leave types with no tracked balance bucket", () => {
    expect(balanceKeyForLeaveType("Maternity")).toBeNull();
    expect(balanceKeyForLeaveType("Unpaid")).toBeNull();
  });
});

describe("canTransitionLeaveStatus", () => {
  it("allows Pending to move to Approved, Rejected, or Cancelled", () => {
    expect(canTransitionLeaveStatus("Pending", "Approved")).toBe(true);
    expect(canTransitionLeaveStatus("Pending", "Rejected")).toBe(true);
    expect(canTransitionLeaveStatus("Pending", "Cancelled")).toBe(true);
  });
  it("allows an Approved request to be Cancelled (restoring balance)", () => {
    expect(canTransitionLeaveStatus("Approved", "Cancelled")).toBe(true);
  });
  it("does not allow a Rejected or Cancelled request to transition anywhere", () => {
    expect(canTransitionLeaveStatus("Rejected", "Approved")).toBe(false);
    expect(canTransitionLeaveStatus("Cancelled", "Pending")).toBe(false);
  });
});

describe("deductLeaveBalance / restoreLeaveBalance", () => {
  const balance: LeaveBalance = { annual: 15, sick: 10, family_responsibility: 3, study: 0 };

  it("deducts from the correct bucket", () => {
    expect(deductLeaveBalance(balance, "Annual", 5)).toEqual({ ...balance, annual: 10 });
  });
  it("never goes negative", () => {
    expect(deductLeaveBalance(balance, "Sick", 100)).toEqual({ ...balance, sick: 0 });
  });
  it("leaves the balance untouched for a leave type with no tracked bucket", () => {
    expect(deductLeaveBalance(balance, "Maternity", 30)).toEqual(balance);
  });
  it("restoreLeaveBalance is the exact inverse of deductLeaveBalance", () => {
    const deducted = deductLeaveBalance(balance, "Annual", 5);
    expect(restoreLeaveBalance(deducted, "Annual", 5)).toEqual(balance);
  });
});

describe("isWithinDays", () => {
  const TODAY = new Date("2026-08-17T09:00:00");
  it("matches a date within the window, inclusive of today", () => {
    expect(isWithinDays("2026-08-17", 14, TODAY)).toBe(true);
    expect(isWithinDays("2026-08-25", 14, TODAY)).toBe(true);
  });
  it("does not match a date beyond the window", () => {
    expect(isWithinDays("2026-09-05", 14, TODAY)).toBe(false);
  });
  it("does not match a date already in the past", () => {
    expect(isWithinDays("2026-08-10", 14, TODAY)).toBe(false);
  });
  it("returns false for no date at all", () => {
    expect(isWithinDays(null, 14, TODAY)).toBe(false);
  });
});

describe("isAnniversaryToday", () => {
  const TODAY = new Date("2026-08-17T09:00:00");
  it("matches month and day regardless of year", () => {
    expect(isAnniversaryToday("1990-08-17", TODAY)).toBe(true);
    expect(isAnniversaryToday("2020-08-17", TODAY)).toBe(true);
  });
  it("does not match a different day", () => {
    expect(isAnniversaryToday("1990-08-18", TODAY)).toBe(false);
  });
  it("returns false for no date at all", () => {
    expect(isAnniversaryToday(null, TODAY)).toBe(false);
  });
});
