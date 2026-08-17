// Pure permission logic — deliberately has ZERO dependencies on Next.js,
// Auth.js, or Supabase. This is what makes it possible to unit test with
// permissions.test.ts in complete isolation, instantly, with no server,
// database, or Microsoft account required — see docs/ROLES_AND_PERMISSIONS.md.
//
// src/lib/permissions.ts re-exports everything here, plus the parts that
// DO need a real session/database (getCurrentUserPermissions,
// requireModuleAccess). Application code should keep importing from
// "@/lib/permissions" as normal — this file exists purely so the core
// rules can be tested on their own.

export type ModuleKey =
  | "dashboard" | "people" | "academy" | "documents" | "tenders"
  | "finance" | "operations" | "customers" | "sales" | "reports"
  | "ai" | "settings" | "audit" | "attendance";

export const ALL_MODULES: { key: ModuleKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "people", label: "People" },
  { key: "academy", label: "Academy" },
  { key: "documents", label: "Documents" },
  { key: "tenders", label: "Tenders" },
  { key: "finance", label: "Finance" },
  { key: "operations", label: "Operations" },
  { key: "customers", label: "Customers" },
  { key: "sales", label: "Sales" },
  { key: "reports", label: "Reports" },
  { key: "ai", label: "AI Assistant" },
  { key: "settings", label: "Settings" },
  { key: "audit", label: "Audit Logs" },
  { key: "attendance", label: "Attendance Management" },
];

export const ALL_MODULE_KEYS = ALL_MODULES.map((m) => m.key);

export type RoleKey = "Super Admin" | "Management" | "HR/Admin" | "Finance" | "Sales/Marketing" | "Employee";

export const ALL_ROLES: RoleKey[] = ["Super Admin", "Management", "HR/Admin", "Finance", "Sales/Marketing", "Employee"];

export const ROLE_DEFAULT_MODULES: Record<RoleKey, ModuleKey[]> = {
  "Super Admin": ALL_MODULE_KEYS,
  "Management": ["dashboard", "people", "academy", "documents", "tenders", "finance", "operations", "customers", "sales", "reports", "ai", "settings"],
  "HR/Admin": ["dashboard", "people", "academy", "documents", "ai", "settings", "audit", "attendance"],
  "Finance": ["dashboard", "finance", "reports", "academy", "documents", "ai", "settings"],
  "Sales/Marketing": ["dashboard", "customers", "sales", "reports", "academy", "documents", "ai", "settings"],
  "Employee": ["dashboard", "academy", "documents", "ai", "settings"],
};

export type UserPermissions = {
  status: "signed-out" | "pending-approval" | "active" | "no-database";
  email?: string;
  name?: string;
  role?: RoleKey;
  isAdmin: boolean;
  allowedModules: ModuleKey[];
};

export function hasModuleAccess(permissions: UserPermissions, moduleKey: ModuleKey): boolean {
  // Dashboard and Settings are always available to anyone provisioned —
  // Dashboard so there's always a home to land on, Settings so everyone
  // can see their own access status even if nothing else is granted yet.
  if (moduleKey === "dashboard" || moduleKey === "settings") {
    return permissions.status === "active" || permissions.status === "no-database";
  }
  if (permissions.status === "no-database") return true;
  if (permissions.status !== "active") return false;
  if (permissions.isAdmin) return true;
  return permissions.allowedModules.includes(moduleKey);
}
