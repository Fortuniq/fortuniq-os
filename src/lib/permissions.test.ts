import { describe, it, expect } from "vitest";
import {
  hasModuleAccess,
  ROLE_DEFAULT_MODULES,
  ALL_MODULES,
  ALL_ROLES,
  type UserPermissions,
  type ModuleKey,
  type RoleKey,
} from "./permissions-core";

// Builds a UserPermissions object the way getCurrentUserPermissions()
// would for a real, active person with a given role — without needing a
// real database or session, so these tests run instantly, anywhere,
// with no setup.
function activeUserWithRole(role: RoleKey): UserPermissions {
  return {
    status: "active",
    email: "test@iqfuels.co.za",
    name: "Test User",
    role,
    isAdmin: role === "Super Admin",
    allowedModules: ROLE_DEFAULT_MODULES[role],
  };
}

describe("Role default modules match the documented matrix", () => {
  it("Super Admin has every module", () => {
    const allKeys = ALL_MODULES.map((m) => m.key);
    expect(new Set(ROLE_DEFAULT_MODULES["Super Admin"])).toEqual(new Set(allKeys));
  });

  it("every role is defined with at least Dashboard and Settings", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_DEFAULT_MODULES[role]).toContain("dashboard");
      expect(ROLE_DEFAULT_MODULES[role]).toContain("settings");
    }
  });
});

describe("Critical requirement: Finance must not see HR information", () => {
  const finance = activeUserWithRole("Finance");

  it("Finance role does not include People", () => {
    expect(ROLE_DEFAULT_MODULES.Finance).not.toContain("people");
  });

  it("hasModuleAccess denies Finance access to People", () => {
    expect(hasModuleAccess(finance, "people")).toBe(false);
  });

  it("Finance can still access its own module and Reports", () => {
    expect(hasModuleAccess(finance, "finance")).toBe(true);
    expect(hasModuleAccess(finance, "reports")).toBe(true);
  });
});

describe("Critical requirement: Marketing must not see confidential finance records", () => {
  const salesMarketing = activeUserWithRole("Sales/Marketing");

  it("Sales/Marketing role does not include Finance", () => {
    expect(ROLE_DEFAULT_MODULES["Sales/Marketing"]).not.toContain("finance");
  });

  it("hasModuleAccess denies Sales/Marketing access to Finance", () => {
    expect(hasModuleAccess(salesMarketing, "finance")).toBe(false);
  });

  it("Sales/Marketing can still access Customers and Sales", () => {
    expect(hasModuleAccess(salesMarketing, "customers")).toBe(true);
    expect(hasModuleAccess(salesMarketing, "sales")).toBe(true);
  });
});

describe("Critical requirement: Interns (Employee role) must not have admin access", () => {
  const employee = activeUserWithRole("Employee");

  it("Employee role is never flagged as admin", () => {
    expect(employee.isAdmin).toBe(false);
  });

  it("Employee cannot access Audit Logs", () => {
    expect(hasModuleAccess(employee, "audit")).toBe(false);
  });

  it("Employee cannot access People, Finance, Tenders, Operations, Customers, or Sales", () => {
    const restricted: ModuleKey[] = ["people", "finance", "tenders", "operations", "customers", "sales"];
    for (const m of restricted) {
      expect(hasModuleAccess(employee, m)).toBe(false);
    }
  });

  it("Employee still has Dashboard, Academy, Documents, AI Assistant, Settings", () => {
    const allowed: ModuleKey[] = ["dashboard", "academy", "documents", "ai", "settings"];
    for (const m of allowed) {
      expect(hasModuleAccess(employee, m)).toBe(true);
    }
  });
});

describe("Audit Logs are restricted to Super Admin and HR/Admin only", () => {
  it("Super Admin can access Audit Logs", () => {
    expect(hasModuleAccess(activeUserWithRole("Super Admin"), "audit")).toBe(true);
  });
  it("HR/Admin can access Audit Logs", () => {
    expect(hasModuleAccess(activeUserWithRole("HR/Admin"), "audit")).toBe(true);
  });
  it("Management cannot access Audit Logs", () => {
    expect(hasModuleAccess(activeUserWithRole("Management"), "audit")).toBe(false);
  });
  it("Finance cannot access Audit Logs", () => {
    expect(hasModuleAccess(activeUserWithRole("Finance"), "audit")).toBe(false);
  });
  it("Sales/Marketing cannot access Audit Logs", () => {
    expect(hasModuleAccess(activeUserWithRole("Sales/Marketing"), "audit")).toBe(false);
  });
  it("Employee cannot access Audit Logs", () => {
    expect(hasModuleAccess(activeUserWithRole("Employee"), "audit")).toBe(false);
  });
});

describe("HR/Admin: has people & training data, not commercial data", () => {
  const hr = activeUserWithRole("HR/Admin");
  it("HR/Admin has People and Academy", () => {
    expect(hasModuleAccess(hr, "people")).toBe(true);
    expect(hasModuleAccess(hr, "academy")).toBe(true);
  });
  it("HR/Admin does not have Finance, Sales, Customers, Tenders, Operations", () => {
    const restricted: ModuleKey[] = ["finance", "sales", "customers", "tenders", "operations"];
    for (const m of restricted) {
      expect(hasModuleAccess(hr, m)).toBe(false);
    }
  });
});

describe("Management: broad visibility, but not Team Management or Audit Logs", () => {
  const management = activeUserWithRole("Management");
  it("Management sees essentially every business module", () => {
    const expected: ModuleKey[] = ["dashboard", "people", "academy", "documents", "tenders", "finance", "operations", "customers", "sales", "reports", "ai", "settings"];
    for (const m of expected) {
      expect(hasModuleAccess(management, m)).toBe(true);
    }
  });
  it("Management is not flagged as admin (no Team Management access)", () => {
    expect(management.isAdmin).toBe(false);
  });
  it("Management cannot access Audit Logs", () => {
    expect(hasModuleAccess(management, "audit")).toBe(false);
  });
});

describe("Universal rules that apply regardless of role", () => {
  it("Dashboard and Settings are available to every active role", () => {
    for (const role of ALL_ROLES) {
      const user = activeUserWithRole(role);
      expect(hasModuleAccess(user, "dashboard")).toBe(true);
      expect(hasModuleAccess(user, "settings")).toBe(true);
    }
  });

  it("A signed-out person has no access to anything", () => {
    const signedOut: UserPermissions = { status: "signed-out", isAdmin: false, allowedModules: [] };
    for (const m of ALL_MODULES) {
      expect(hasModuleAccess(signedOut, m.key)).toBe(false);
    }
  });

  it("A pending-approval person has no access to anything", () => {
    const pending: UserPermissions = { status: "pending-approval", email: "new@iqfuels.co.za", isAdmin: false, allowedModules: [] };
    for (const m of ALL_MODULES) {
      expect(hasModuleAccess(pending, m.key)).toBe(false);
    }
  });

  it("Super Admin has access to every single module, including Audit Logs and Settings", () => {
    const admin = activeUserWithRole("Super Admin");
    for (const m of ALL_MODULES) {
      expect(hasModuleAccess(admin, m.key)).toBe(true);
    }
  });
});

describe("Full role x module matrix (exact match against documented table)", () => {
  // This mirrors the table in docs/ROLES_AND_PERMISSIONS.md exactly — if
  // you change one, change the other, and re-run this test.
  const EXPECTED: Record<RoleKey, Record<ModuleKey, boolean>> = {
    "Super Admin": { dashboard: true, people: true, academy: true, documents: true, tenders: true, finance: true, operations: true, customers: true, sales: true, reports: true, ai: true, settings: true, audit: true },
    "Management": { dashboard: true, people: true, academy: true, documents: true, tenders: true, finance: true, operations: true, customers: true, sales: true, reports: true, ai: true, settings: true, audit: false },
    "HR/Admin": { dashboard: true, people: true, academy: true, documents: true, tenders: false, finance: false, operations: false, customers: false, sales: false, reports: false, ai: true, settings: true, audit: true },
    "Finance": { dashboard: true, people: false, academy: true, documents: true, tenders: false, finance: true, operations: false, customers: false, sales: false, reports: true, ai: true, settings: true, audit: false },
    "Sales/Marketing": { dashboard: true, people: false, academy: true, documents: true, tenders: false, finance: false, operations: false, customers: true, sales: true, reports: true, ai: true, settings: true, audit: false },
    "Employee": { dashboard: true, people: false, academy: true, documents: true, tenders: false, finance: false, operations: false, customers: false, sales: false, reports: false, ai: true, settings: true, audit: false },
  };

  for (const role of ALL_ROLES) {
    describe(`Role: ${role}`, () => {
      const user = activeUserWithRole(role);
      for (const m of ALL_MODULES) {
        const expected = EXPECTED[role][m.key];
        it(`${expected ? "CAN" : "cannot"} access ${m.label}`, () => {
          expect(hasModuleAccess(user, m.key)).toBe(expected);
        });
      }
    });
  }
});
