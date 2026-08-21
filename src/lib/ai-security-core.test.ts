import { describe, it, expect } from "vitest";
import { canAccessDocumentForAI, canAccessDocumentByClassification, filterDocumentsForAI, type ClassifiableDocument } from "./ai-security-core";
import type { UserPermissions, RoleKey } from "./permissions-core";

function activeUser(role: RoleKey, overrides: Partial<UserPermissions> = {}): UserPermissions {
  return {
    status: "active",
    email: "test@iqfuels.co.za",
    name: "Test User",
    role,
    isAdmin: role === "Super Admin",
    allowedModules: role === "Super Admin"
      ? ["dashboard", "people", "academy", "documents", "tenders", "finance", "operations", "customers", "sales", "reports", "ai", "settings", "audit"]
      : ["dashboard", "academy", "documents", "ai", "settings"],
    ...overrides,
  };
}

function doc(overrides: Partial<ClassifiableDocument> = {}): ClassifiableDocument {
  return {
    classification: "Internal",
    authorizedRoles: [],
    authorizedEmails: [],
    aiExcluded: false,
    employeeId: null,
    ...overrides,
  };
}

describe("Fail-closed: identity and status checks", () => {
  it("denies a signed-out person, even for a General document", () => {
    const signedOut: UserPermissions = { status: "signed-out", isAdmin: false, allowedModules: [] };
    expect(canAccessDocumentForAI(signedOut, doc({ classification: "General" }))).toBe(false);
  });

  it("denies a pending-approval person, even for a General document", () => {
    const pending: UserPermissions = { status: "pending-approval", email: "new@iqfuels.co.za", isAdmin: false, allowedModules: [] };
    expect(canAccessDocumentForAI(pending, doc({ classification: "General" }))).toBe(false);
  });

  it("denies anyone without Documents module access, even for a General document", () => {
    const noDocsAccess = activeUser("Employee", { allowedModules: ["dashboard", "settings"] });
    expect(canAccessDocumentForAI(noDocsAccess, doc({ classification: "General" }))).toBe(false);
  });
});

describe("General and Internal: ordinary Documents access is enough", () => {
  it("an Employee with Documents access can see a General document", () => {
    expect(canAccessDocumentForAI(activeUser("Employee"), doc({ classification: "General" }))).toBe(true);
  });
  it("an Employee with Documents access can see an Internal document", () => {
    expect(canAccessDocumentForAI(activeUser("Employee"), doc({ classification: "Internal" }))).toBe(true);
  });
});

describe("Confidential and Highly Confidential: explicit authorisation required", () => {
  it("denies an ordinary Employee by default, with no authorisation set", () => {
    expect(canAccessDocumentForAI(activeUser("Employee"), doc({ classification: "Confidential" }))).toBe(false);
    expect(canAccessDocumentForAI(activeUser("Employee"), doc({ classification: "Highly Confidential" }))).toBe(false);
  });

  it("denies Finance a Confidential document not authorised for their role", () => {
    expect(canAccessDocumentForAI(activeUser("Finance"), doc({ classification: "Confidential", authorizedRoles: ["HR/Admin"] }))).toBe(false);
  });

  it("allows a role explicitly listed in authorizedRoles", () => {
    const finance = activeUser("Finance");
    expect(canAccessDocumentForAI(finance, doc({ classification: "Confidential", authorizedRoles: ["Finance"] }))).toBe(true);
  });

  it("allows a specific person explicitly listed in authorizedEmails, regardless of role", () => {
    const employee = activeUser("Employee", { email: "board.member@iqfuels.co.za" });
    expect(
      canAccessDocumentForAI(employee, doc({ classification: "Highly Confidential", authorizedEmails: ["board.member@iqfuels.co.za"] }))
    ).toBe(true);
  });

  it("email authorisation is case-insensitive", () => {
    const employee = activeUser("Employee", { email: "Board.Member@iqfuels.co.za" });
    expect(
      canAccessDocumentForAI(employee, doc({ classification: "Highly Confidential", authorizedEmails: ["board.member@iqfuels.co.za"] }))
    ).toBe(true);
  });

  it("Super Admin can see Confidential and Highly Confidential documents even with no explicit authorisation", () => {
    const admin = activeUser("Super Admin");
    expect(canAccessDocumentForAI(admin, doc({ classification: "Confidential" }))).toBe(true);
    expect(canAccessDocumentForAI(admin, doc({ classification: "Highly Confidential" }))).toBe(true);
  });
});

describe("ai_excluded is an absolute override", () => {
  it("denies even Super Admin when ai_excluded is true", () => {
    const admin = activeUser("Super Admin");
    expect(canAccessDocumentForAI(admin, doc({ classification: "General", aiExcluded: true }))).toBe(false);
  });

  it("denies even an explicitly authorised person when ai_excluded is true", () => {
    const employee = activeUser("Employee", { email: "board.member@iqfuels.co.za" });
    expect(
      canAccessDocumentForAI(employee, doc({ classification: "Highly Confidential", authorizedEmails: ["board.member@iqfuels.co.za"], aiExcluded: true }))
    ).toBe(false);
  });
});

describe("filterDocumentsForAI", () => {
  it("returns only the documents a person is actually allowed to see", () => {
    const finance = activeUser("Finance");
    const documents = [
      { id: 1, ...doc({ classification: "General" }) },
      { id: 2, ...doc({ classification: "Confidential", authorizedRoles: ["Finance"] }) },
      { id: 3, ...doc({ classification: "Confidential", authorizedRoles: ["HR/Admin"] }) },
      { id: 4, ...doc({ classification: "Highly Confidential" }) },
    ];
    const visible = filterDocumentsForAI(finance, documents);
    expect(visible.map((d) => d.id)).toEqual([1, 2]);
  });

  it("returns an empty list for a signed-out person, regardless of classification", () => {
    const signedOut: UserPermissions = { status: "signed-out", isAdmin: false, allowedModules: [] };
    const documents = [{ id: 1, ...doc({ classification: "General" }) }];
    expect(filterDocumentsForAI(signedOut, documents)).toEqual([]);
  });
});

describe("Real-world scenario: HR, payroll, banking, board, legal, executive material", () => {
  it("an ordinary Employee cannot see a payroll document classified Highly Confidential", () => {
    const employee = activeUser("Employee");
    const payroll = doc({ classification: "Highly Confidential", authorizedRoles: ["HR/Admin"], authorizedEmails: ["cfo@iqfuels.co.za"] });
    expect(canAccessDocumentForAI(employee, payroll)).toBe(false);
  });

  it("HR/Admin can see the payroll document when explicitly authorised by role", () => {
    const hr = activeUser("HR/Admin");
    const payroll = doc({ classification: "Highly Confidential", authorizedRoles: ["HR/Admin"], authorizedEmails: ["cfo@iqfuels.co.za"] });
    expect(canAccessDocumentForAI(hr, payroll)).toBe(true);
  });

  it("Finance role alone cannot see an HR-authorised payroll document without being separately named", () => {
    const finance = activeUser("Finance");
    const payroll = doc({ classification: "Highly Confidential", authorizedRoles: ["HR/Admin"], authorizedEmails: ["cfo@iqfuels.co.za"] });
    expect(canAccessDocumentForAI(finance, payroll)).toBe(false);
  });

  it("a board pack excluded from AI entirely is invisible even to Super Admin's AI queries", () => {
    const admin = activeUser("Super Admin");
    const boardPack = doc({ classification: "Highly Confidential", aiExcluded: true });
    expect(canAccessDocumentForAI(admin, boardPack)).toBe(false);
  });
});

describe("canAccessDocumentByClassification (used by the Documents module itself, not just AI)", () => {
  it("does not require Documents module access itself — the page checks that separately", () => {
    const employee = activeUser("Employee");
    expect(canAccessDocumentByClassification(employee, doc({ classification: "General" }))).toBe(true);
  });

  it("still denies Confidential material without authorisation, same rule as the AI check", () => {
    const employee = activeUser("Employee");
    expect(canAccessDocumentByClassification(employee, doc({ classification: "Confidential" }))).toBe(false);
  });

  it("is not affected by ai_excluded — a document can be AI-excluded but still humanly visible to authorised people", () => {
    const admin = activeUser("Super Admin");
    expect(canAccessDocumentByClassification(admin, doc({ classification: "General", aiExcluded: true }))).toBe(true);
  });
});

describe("Employee-document security trimming", () => {
  it("hides an employee-linked document from someone who is neither the employee, HR, nor Super Admin, even at General classification", () => {
    const marketing = activeUser("Sales/Marketing");
    const employmentContract = doc({ classification: "General", employeeId: "emp-1" });
    expect(canAccessDocumentByClassification(marketing, employmentContract, null)).toBe(false);
  });

  it("shows the document to the employee it belongs to", () => {
    const employee = activeUser("Employee");
    const employmentContract = doc({ classification: "General", employeeId: "emp-1" });
    expect(canAccessDocumentByClassification(employee, employmentContract, "emp-1")).toBe(true);
  });

  it("does not show it to a DIFFERENT employee, even with a valid employee id of their own", () => {
    const employee = activeUser("Employee");
    const employmentContract = doc({ classification: "General", employeeId: "emp-1" });
    expect(canAccessDocumentByClassification(employee, employmentContract, "emp-2")).toBe(false);
  });

  it("shows it to HR/Admin regardless of whose document it is", () => {
    const hr = activeUser("HR/Admin");
    const employmentContract = doc({ classification: "General", employeeId: "emp-1" });
    expect(canAccessDocumentByClassification(hr, employmentContract, null)).toBe(true);
  });

  it("shows it to Super Admin regardless of whose document it is", () => {
    const admin = activeUser("Super Admin");
    const employmentContract = doc({ classification: "General", employeeId: "emp-1" });
    expect(canAccessDocumentByClassification(admin, employmentContract, null)).toBe(true);
  });

  it("a non-employee-linked document (employeeId null) is unaffected by this rule — falls through to ordinary classification checks", () => {
    const marketing = activeUser("Sales/Marketing");
    const policy = doc({ classification: "General", employeeId: null });
    expect(canAccessDocumentByClassification(marketing, policy, null)).toBe(true);
  });

  it("flows through filterDocumentsForAI and canAccessDocumentForAI the same way", () => {
    const marketing = activeUser("Sales/Marketing");
    const docs = [
      doc({ classification: "General", employeeId: "emp-1" }), // someone else's contract
      doc({ classification: "General", employeeId: null }), // ordinary policy
    ];
    const visible = filterDocumentsForAI(marketing, docs, null);
    expect(visible.length).toBe(1);
    expect(visible[0].employeeId).toBeNull();
  });
});

describe("Public classification (alias for General)", () => {
  it("treats Public the same as General — universally visible to anyone with Documents access", () => {
    const employee = activeUser("Employee");
    expect(canAccessDocumentByClassification(employee, doc({ classification: "Public" }), null)).toBe(true);
  });
});
