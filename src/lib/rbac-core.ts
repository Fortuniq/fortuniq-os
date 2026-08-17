// Pure, granular Role-Based Access Control logic — zero dependencies on
// Next.js, Auth.js, or Supabase, same reasoning as every other *-core.ts
// file in this app: fully unit-testable in isolation. See
// docs/RBAC.md and src/lib/rbac-core.test.ts.
//
// HOW THIS RELATES TO THE EXISTING PERMISSION SYSTEM (permissions-core.ts):
// The existing system answers "can this person open this module's page
// at all" — a coarse, module-level gate, still fully in force and
// unchanged. This file answers a finer question, WITHIN a module a
// person can already open: "can they View / Create / Edit / Delete /
// Approve / Export / Manage here specifically." Both layers apply
// together — a person needs module access AND the specific action
// granted to actually do something.

export type PermissionAction = "View" | "Create" | "Edit" | "Delete" | "Approve" | "Export" | "Manage";

export const ALL_PERMISSION_ACTIONS: PermissionAction[] = ["View", "Create", "Edit", "Delete", "Approve", "Export", "Manage"];

// The module list from the RBAC brief, mapped onto FortunIQ OS's actual
// existing module keys — "People & Culture" is this app's "people"
// module, "CRM"/"Quotes" are covered by "sales" and "customers" rather
// than being separate modules that don't otherwise exist in the app.
export type RbacModuleKey =
  | "dashboard" | "people" | "academy" | "documents" | "tenders"
  | "finance" | "operations" | "customers" | "sales" | "reports"
  | "ai" | "settings" | "audit" | "attendance";

export const ALL_RBAC_MODULES: { key: RbacModuleKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "people", label: "People & Culture (Employee Hub)" },
  { key: "academy", label: "Academy" },
  { key: "documents", label: "Documents" },
  { key: "tenders", label: "Tenders" },
  { key: "finance", label: "Finance" },
  { key: "operations", label: "Operations" },
  { key: "customers", label: "Customers" },
  { key: "sales", label: "Sales & Quotes" },
  { key: "reports", label: "Reports" },
  { key: "ai", label: "FortunIQ Intelligence" },
  { key: "settings", label: "Settings" },
  { key: "audit", label: "Audit Logs" },
  { key: "attendance", label: "Attendance Management" },
];

// A person's complete, granular permission set: which actions they hold
// in each module. A module simply absent from this map means "No
// Access" — there's no need for an explicit empty-array entry.
export type EmployeePermissionSet = Partial<Record<RbacModuleKey, PermissionAction[]>>;

/**
 * The actual, enforceable check: does this permission set include this
 * specific action for this specific module? Fails closed by
 * construction — an unlisted module or an unlisted action both simply
 * return false, never true by default.
 */
export function hasPermissionAction(
  permissionSet: EmployeePermissionSet,
  moduleKey: RbacModuleKey,
  action: PermissionAction
): boolean {
  const actions = permissionSet[moduleKey];
  if (!actions) return false;
  // "Manage" is a superset — anyone granted Manage on a module can do
  // everything else there too, without needing every action listed
  // individually. This mirrors the brief's own examples (e.g. Finance
  // Officer's implicit full control over Finance).
  if (actions.includes("Manage")) return true;
  return actions.includes(action);
}

/**
 * Convenience check for the most common case — "can this person see
 * this module's data at all" — equivalent to hasPermissionAction(...,
 * "View"), but named for readability at call sites.
 */
export function canView(permissionSet: EmployeePermissionSet, moduleKey: RbacModuleKey): boolean {
  return hasPermissionAction(permissionSet, moduleKey, "View");
}

// =========================================================================
// ROLE TEMPLATES
// =========================================================================
// Reusable, named starting points — applying one to an employee copies
// this exact permission set onto their individual record, which an
// admin can then further customise. Templates are NOT live/linked after
// that point (unlike the coarser role system in permissions-core.ts) —
// editing a template here does not retroactively change anyone who
// already had it applied. This matches the brief: "Instead of assigning
// permissions one by one every time, HR should be able to select a
// predefined role. Permissions may then be customised if required."

export type RoleTemplateKey =
  | "CEO" | "Director" | "HR Manager" | "Finance Officer" | "Sales Representative"
  | "Tender Administrator" | "Marketing" | "Operations" | "Administrator" | "Intern";

export const ALL_ROLE_TEMPLATES: RoleTemplateKey[] = [
  "CEO", "Director", "HR Manager", "Finance Officer", "Sales Representative",
  "Tender Administrator", "Marketing", "Operations", "Administrator", "Intern",
];

const FULL: PermissionAction[] = ["Manage"];
const VIEW: PermissionAction[] = ["View"];
const VIEW_EXPORT: PermissionAction[] = ["View", "Export"];
const VIEW_CREATE_EDIT: PermissionAction[] = ["View", "Create", "Edit"];
const VIEW_CREATE_EDIT_EXPORT: PermissionAction[] = ["View", "Create", "Edit", "Export"];
const VIEW_APPROVE: PermissionAction[] = ["View", "Approve"];
const VIEW_EDIT: PermissionAction[] = ["View", "Edit"];

export const ROLE_TEMPLATE_PERMISSIONS: Record<RoleTemplateKey, EmployeePermissionSet> = {
  // Full unrestricted access to every module — per the brief exactly.
  "CEO": Object.fromEntries(ALL_RBAC_MODULES.map((m) => [m.key, FULL])) as EmployeePermissionSet, // includes attendance

  // Broad oversight, not full system administration — sees and can act
  // across the business, but Manage-level control stays with CEO/Administrator.
  "Director": {
    dashboard: VIEW, people: VIEW, academy: VIEW, documents: VIEW_EXPORT,
    tenders: VIEW_APPROVE, finance: VIEW_EXPORT, operations: VIEW_EDIT,
    customers: VIEW, sales: VIEW, reports: VIEW_EXPORT, ai: VIEW, settings: VIEW,
  },

  "HR Manager": {
    dashboard: VIEW, people: FULL, academy: FULL, documents: VIEW_CREATE_EDIT,
    ai: VIEW, settings: VIEW, attendance: FULL,
    // Deliberately no entry for finance/tenders/operations/customers/sales/reports
    // — "No access to HR confidential information unless explicitly assigned"
    // works both ways: HR Manager doesn't get commercial data by default either.
  },

  // Exactly the worked example from the brief.
  "Finance Officer": {
    dashboard: VIEW,
    finance: VIEW_CREATE_EDIT_EXPORT,
    // "Expenses" and "Payroll" aren't separate top-level modules in
    // FortunIQ OS today — both live inside Finance, so their Approve/Edit
    // grants apply to the Finance module as a whole. See docs/RBAC.md.
    reports: VIEW, customers: VIEW, sales: VIEW,
  },

  "Sales Representative": {
    dashboard: VIEW, customers: VIEW_CREATE_EDIT, sales: VIEW_CREATE_EDIT,
    documents: VIEW, reports: VIEW, ai: VIEW,
  },

  // Exactly the worked example from the brief.
  "Tender Administrator": {
    dashboard: VIEW, tenders: VIEW_CREATE_EDIT, documents: VIEW_CREATE_EDIT,
    customers: VIEW, sales: VIEW, reports: VIEW,
  },

  // Exactly the worked example from the brief.
  "Marketing": {
    dashboard: VIEW, customers: VIEW_EDIT, sales: VIEW_EDIT, reports: VIEW, documents: VIEW,
  },

  "Operations": {
    dashboard: VIEW, operations: FULL, documents: VIEW_CREATE_EDIT,
    reports: VIEW, tenders: VIEW, ai: VIEW,
  },

  // System administration — full control over the platform itself
  // (Settings, People, Documents) without necessarily holding CEO-level
  // authority over commercial decisions like Finance approvals.
  "Administrator": {
    dashboard: FULL, people: FULL, academy: FULL, documents: FULL, settings: FULL,
    audit: VIEW, tenders: VIEW, finance: VIEW, operations: VIEW,
    customers: VIEW, sales: VIEW, reports: VIEW, ai: VIEW, attendance: FULL,
  },

  // The most restrictive template — matches the existing "Employee" role
  // default, deliberately kept minimal.
  "Intern": {
    dashboard: VIEW, academy: VIEW, documents: VIEW, ai: VIEW,
  },
};
