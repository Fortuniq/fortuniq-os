import { describe, it, expect } from "vitest";
import {
  hasPermissionAction, canView, ROLE_TEMPLATE_PERMISSIONS, ALL_ROLE_TEMPLATES, ALL_RBAC_MODULES,
  type EmployeePermissionSet,
} from "./rbac-core";

describe("hasPermissionAction: fail-closed by default", () => {
  it("denies an action on a module with no entry at all", () => {
    const perms: EmployeePermissionSet = { tenders: ["View"] };
    expect(hasPermissionAction(perms, "finance", "View")).toBe(false);
  });

  it("denies an action not explicitly granted, even if the module has other actions", () => {
    const perms: EmployeePermissionSet = { tenders: ["View"] };
    expect(hasPermissionAction(perms, "tenders", "Delete")).toBe(false);
  });

  it("allows an action explicitly granted", () => {
    const perms: EmployeePermissionSet = { tenders: ["View", "Create"] };
    expect(hasPermissionAction(perms, "tenders", "Create")).toBe(true);
  });

  it("an empty permission set denies everything", () => {
    expect(hasPermissionAction({}, "dashboard", "View")).toBe(false);
  });
});

describe("Manage is a superset of every other action", () => {
  it("Manage grants View even when View isn't separately listed", () => {
    const perms: EmployeePermissionSet = { finance: ["Manage"] };
    expect(hasPermissionAction(perms, "finance", "View")).toBe(true);
    expect(hasPermissionAction(perms, "finance", "Delete")).toBe(true);
    expect(hasPermissionAction(perms, "finance", "Approve")).toBe(true);
  });

  it("Manage on one module does not grant anything on a different module", () => {
    const perms: EmployeePermissionSet = { finance: ["Manage"] };
    expect(hasPermissionAction(perms, "people", "View")).toBe(false);
  });
});

describe("canView convenience helper", () => {
  it("matches hasPermissionAction(..., 'View')", () => {
    const perms: EmployeePermissionSet = { customers: ["View", "Edit"] };
    expect(canView(perms, "customers")).toBe(true);
    expect(canView(perms, "sales")).toBe(false);
  });
});

describe("Role templates exist for every named role in the brief", () => {
  it("has exactly the 10 specified role templates", () => {
    expect(ALL_ROLE_TEMPLATES.sort()).toEqual([
      "Administrator", "CEO", "Director", "Finance Officer", "HR Manager",
      "Intern", "Marketing", "Operations", "Sales Representative", "Tender Administrator",
    ].sort());
  });

  it("every template is defined with at least one module", () => {
    for (const role of ALL_ROLE_TEMPLATES) {
      expect(Object.keys(ROLE_TEMPLATE_PERMISSIONS[role]).length).toBeGreaterThan(0);
    }
  });
});

describe("CEO: full unrestricted access to every module (exact brief requirement)", () => {
  const ceo = ROLE_TEMPLATE_PERMISSIONS["CEO"];
  it("has Manage on every single module", () => {
    for (const m of ALL_RBAC_MODULES) {
      expect(hasPermissionAction(ceo, m.key, "Manage")).toBe(true);
    }
  });
  it("can therefore do literally anything, anywhere", () => {
    expect(hasPermissionAction(ceo, "finance", "Delete")).toBe(true);
    expect(hasPermissionAction(ceo, "people", "Approve")).toBe(true);
    expect(hasPermissionAction(ceo, "settings", "Manage")).toBe(true);
  });
});

describe("Tender Administrator: exact worked example from the brief", () => {
  const role = ROLE_TEMPLATE_PERMISSIONS["Tender Administrator"];
  it("Dashboard: View only", () => {
    expect(hasPermissionAction(role, "dashboard", "View")).toBe(true);
    expect(hasPermissionAction(role, "dashboard", "Edit")).toBe(false);
  });
  it("Tenders: View, Create, Edit", () => {
    expect(hasPermissionAction(role, "tenders", "View")).toBe(true);
    expect(hasPermissionAction(role, "tenders", "Create")).toBe(true);
    expect(hasPermissionAction(role, "tenders", "Edit")).toBe(true);
    expect(hasPermissionAction(role, "tenders", "Delete")).toBe(false);
  });
  it("Documents: View, Create (upload)", () => {
    expect(hasPermissionAction(role, "documents", "View")).toBe(true);
    expect(hasPermissionAction(role, "documents", "Create")).toBe(true);
  });
  it("Customers and Sales: View only", () => {
    expect(hasPermissionAction(role, "customers", "View")).toBe(true);
    expect(hasPermissionAction(role, "customers", "Edit")).toBe(false);
    expect(hasPermissionAction(role, "sales", "View")).toBe(true);
    expect(hasPermissionAction(role, "sales", "Edit")).toBe(false);
  });
  it("Reports: View only", () => {
    expect(hasPermissionAction(role, "reports", "View")).toBe(true);
  });
  it("Finance: No Access", () => {
    expect(hasPermissionAction(role, "finance", "View")).toBe(false);
  });
  it("People & Culture: No Access", () => {
    expect(hasPermissionAction(role, "people", "View")).toBe(false);
  });
  it("Settings: No Access", () => {
    expect(hasPermissionAction(role, "settings", "View")).toBe(false);
  });
});

describe("Finance Officer: exact worked example from the brief", () => {
  const role = ROLE_TEMPLATE_PERMISSIONS["Finance Officer"];
  it("Dashboard: View", () => {
    expect(hasPermissionAction(role, "dashboard", "View")).toBe(true);
  });
  it("Finance: View, Create, Edit, Export", () => {
    expect(hasPermissionAction(role, "finance", "View")).toBe(true);
    expect(hasPermissionAction(role, "finance", "Create")).toBe(true);
    expect(hasPermissionAction(role, "finance", "Edit")).toBe(true);
    expect(hasPermissionAction(role, "finance", "Export")).toBe(true);
  });
  it("Reports, Customers, Sales: View", () => {
    expect(hasPermissionAction(role, "reports", "View")).toBe(true);
    expect(hasPermissionAction(role, "customers", "View")).toBe(true);
    expect(hasPermissionAction(role, "sales", "View")).toBe(true);
  });
  it("No access to HR confidential information unless explicitly assigned", () => {
    expect(hasPermissionAction(role, "people", "View")).toBe(false);
  });
});

describe("Marketing: exact worked example from the brief", () => {
  const role = ROLE_TEMPLATE_PERMISSIONS["Marketing"];
  it("Dashboard: View", () => {
    expect(hasPermissionAction(role, "dashboard", "View")).toBe(true);
  });
  it("Customers and Sales (CRM): View, Edit", () => {
    expect(hasPermissionAction(role, "customers", "Edit")).toBe(true);
    expect(hasPermissionAction(role, "sales", "Edit")).toBe(true);
  });
  it("Reports and Documents: View", () => {
    expect(hasPermissionAction(role, "reports", "View")).toBe(true);
    expect(hasPermissionAction(role, "documents", "View")).toBe(true);
  });
  it("No access to Payroll, Finance or HR", () => {
    expect(hasPermissionAction(role, "finance", "View")).toBe(false);
    expect(hasPermissionAction(role, "people", "View")).toBe(false);
  });
});

describe("Intern: minimal access, matching the most restrictive existing role", () => {
  const role = ROLE_TEMPLATE_PERMISSIONS["Intern"];
  it("has only Dashboard, Academy, Documents, and AI", () => {
    expect(canView(role, "dashboard")).toBe(true);
    expect(canView(role, "academy")).toBe(true);
    expect(canView(role, "documents")).toBe(true);
    expect(canView(role, "ai")).toBe(true);
  });
  it("has no access to any commercially or personally sensitive module", () => {
    expect(canView(role, "finance")).toBe(false);
    expect(canView(role, "people")).toBe(false);
    expect(canView(role, "customers")).toBe(false);
    expect(canView(role, "settings")).toBe(false);
  });
  it("cannot manage anything, anywhere — no path to admin capability", () => {
    for (const m of ALL_RBAC_MODULES) {
      expect(hasPermissionAction(role, m.key, "Manage")).toBe(false);
    }
  });
});
