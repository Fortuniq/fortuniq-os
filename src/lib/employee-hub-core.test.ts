import { describe, it, expect } from "vitest";
import { canViewRestrictedEmployeeField, isOwnEmployeeRecord } from "./employee-hub-core";
import type { UserPermissions, RoleKey } from "./permissions-core";

function activeUser(role: RoleKey, email = "test@iqfuels.co.za"): UserPermissions {
  return {
    status: "active",
    email,
    name: "Test User",
    role,
    isAdmin: role === "Super Admin",
    allowedModules: [],
  };
}

describe("Restricted employee fields (banking, tax): fail-closed by default", () => {
  it("denies a signed-out person", () => {
    const signedOut: UserPermissions = { status: "signed-out", isAdmin: false, allowedModules: [] };
    expect(canViewRestrictedEmployeeField(signedOut, "someone@iqfuels.co.za", "banking")).toBe(false);
  });

  it("denies an ordinary Employee viewing a colleague's banking details", () => {
    const employee = activeUser("Employee", "employee@iqfuels.co.za");
    expect(canViewRestrictedEmployeeField(employee, "colleague@iqfuels.co.za", "banking")).toBe(false);
  });

  it("denies Management — broad People visibility is not the same as needing banking data", () => {
    const management = activeUser("Management");
    expect(canViewRestrictedEmployeeField(management, "someone@iqfuels.co.za", "banking")).toBe(false);
    expect(canViewRestrictedEmployeeField(management, "someone@iqfuels.co.za", "tax")).toBe(false);
  });

  it("denies Sales/Marketing", () => {
    const sales = activeUser("Sales/Marketing");
    expect(canViewRestrictedEmployeeField(sales, "someone@iqfuels.co.za", "banking")).toBe(false);
  });
});

describe("Restricted employee fields: who is explicitly allowed", () => {
  it("an employee can always see their own banking details and tax number", () => {
    const employee = activeUser("Employee", "self@iqfuels.co.za");
    expect(canViewRestrictedEmployeeField(employee, "self@iqfuels.co.za", "banking")).toBe(true);
    expect(canViewRestrictedEmployeeField(employee, "self@iqfuels.co.za", "tax")).toBe(true);
  });

  it("own-record matching is case-insensitive", () => {
    const employee = activeUser("Employee", "Self@iqfuels.co.za");
    expect(canViewRestrictedEmployeeField(employee, "self@IQFuels.co.za", "banking")).toBe(true);
  });

  it("HR/Admin can see any employee's restricted fields", () => {
    const hr = activeUser("HR/Admin");
    expect(canViewRestrictedEmployeeField(hr, "someone-else@iqfuels.co.za", "banking")).toBe(true);
    expect(canViewRestrictedEmployeeField(hr, "someone-else@iqfuels.co.za", "tax")).toBe(true);
  });

  it("Finance can see any employee's restricted fields (needed for payroll)", () => {
    const finance = activeUser("Finance");
    expect(canViewRestrictedEmployeeField(finance, "someone-else@iqfuels.co.za", "banking")).toBe(true);
    expect(canViewRestrictedEmployeeField(finance, "someone-else@iqfuels.co.za", "tax")).toBe(true);
  });

  it("Super Admin can see any employee's restricted fields", () => {
    const admin = activeUser("Super Admin");
    expect(canViewRestrictedEmployeeField(admin, "anyone@iqfuels.co.za", "banking")).toBe(true);
  });
});

describe("isOwnEmployeeRecord", () => {
  it("correctly identifies a person's own record", () => {
    const user = activeUser("Employee", "me@iqfuels.co.za");
    expect(isOwnEmployeeRecord(user, "me@iqfuels.co.za")).toBe(true);
    expect(isOwnEmployeeRecord(user, "someone-else@iqfuels.co.za")).toBe(false);
  });

  it("returns false when either email is missing", () => {
    const user = activeUser("Employee", "me@iqfuels.co.za");
    expect(isOwnEmployeeRecord(user, null)).toBe(false);
    expect(isOwnEmployeeRecord(user, undefined)).toBe(false);
  });
});
