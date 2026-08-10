// Pure logic for who can see an employee's restricted profile fields
// (banking details, tax number) — deliberately zero dependencies on
// Next.js, Auth.js, or Supabase, same reasoning as permissions-core.ts
// and ai-security-core.ts: fully unit testable in isolation. See
// docs/EMPLOYEE_HUB.md and src/lib/employee-hub-core.test.ts.
//
// FAIL-CLOSED BY DESIGN, same as the rest of the security architecture:
// access is only granted for a specific, affirmative reason.

import type { UserPermissions } from "./permissions-core";

export type RestrictedField = "banking" | "tax";

/**
 * Can this person see another employee's banking details or tax number?
 * Three groups can, for three different legitimate reasons:
 *   - the employee themselves (it's their own data)
 *   - HR/Admin and Super Admin (personnel administration)
 *   - Finance (payroll processing needs banking and tax information)
 * Nobody else — including Management, despite Management's otherwise
 * broad visibility into the People module — sees this data. Broad
 * organisational oversight is not the same thing as a legitimate need
 * to see someone's bank account number.
 */
export function canViewRestrictedEmployeeField(
  viewer: UserPermissions,
  employeeEmail: string | null | undefined,
  _field: RestrictedField
): boolean {
  if (viewer.status !== "active" && viewer.status !== "no-database") {
    return false;
  }

  if (viewer.isAdmin) {
    return true;
  }

  const isOwnRecord = !!viewer.email && !!employeeEmail && viewer.email.toLowerCase() === employeeEmail.toLowerCase();
  if (isOwnRecord) {
    return true;
  }

  return viewer.role === "HR/Admin" || viewer.role === "Finance";
}

/**
 * Employees only see their own profile as fully editable/private; anyone
 * with People/Employee Hub module access can view the general directory
 * and non-restricted profile fields of colleagues (name, position,
 * department, office, manager — an ordinary company directory). Only the
 * fields covered by canViewRestrictedEmployeeField above are gated
 * further. This function exists mainly for symmetry/documentation - the
 * real gate for "can you open the Employee Hub at all" is the existing
 * hasModuleAccess(permissions, "people") check, unchanged by this file.
 */
export function isOwnEmployeeRecord(viewer: UserPermissions, employeeEmail: string | null | undefined): boolean {
  return !!viewer.email && !!employeeEmail && viewer.email.toLowerCase() === employeeEmail.toLowerCase();
}
