import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentUserPermissions, hasModuleAccess, type UserPermissions } from "@/lib/permissions";
import {
  hasPermissionAction, type EmployeePermissionSet, type RbacModuleKey, type PermissionAction,
} from "@/lib/rbac-core";

/**
 * Fetches an employee's full granular permission set from the database.
 * Returns an empty set if RBAC hasn't been configured for this person on
 * any module yet — see requirePermissionAction() below for how that's
 * handled safely (it does NOT mean "no access to anything").
 */
export async function getEmployeePermissionSet(email: string): Promise<EmployeePermissionSet> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("employee_module_actions").select("module_key, actions").eq("employee_email", email.toLowerCase());
    const set: EmployeePermissionSet = {};
    for (const row of data ?? []) {
      set[row.module_key as RbacModuleKey] = row.actions as PermissionAction[];
    }
    return set;
  } catch {
    return {};
  }
}

/**
 * The real enforcement function — call this in a server action or API
 * route before performing a Create/Edit/Delete/Approve/Export action,
 * not just at the page level.
 *
 * Rollout design, deliberately: granular RBAC is opt-in per employee per
 * module, not a hard cutover. If nobody has ever configured this specific
 * person's permissions for this specific module in System Access &
 * Permissions, this falls back to the existing coarse module-level gate
 * (hasModuleAccess) — exactly the behaviour the app already had before
 * this feature existed. The moment an admin explicitly sets this
 * person's permissions for this module (even to an empty/"No Access"
 * set), granular enforcement takes over for them, strictly, from then on.
 * This avoids silently locking out an entire team the moment this
 * migration runs, while still giving real, enforceable teeth to RBAC for
 * anyone it's actually been configured for.
 *
 * Super Admins always pass, consistent with how they bypass every other
 * fine-grained check in this app (classification, restricted employee
 * fields, and so on).
 */
export async function requirePermissionAction(moduleKey: RbacModuleKey, action: PermissionAction): Promise<UserPermissions> {
  const { redirect } = await import("next/navigation");
  const permissions = await getCurrentUserPermissions();

  if (permissions.status === "signed-out") redirect("/auth/signin");
  if (permissions.status === "pending-approval") redirect("/auth/pending");
  if (!hasModuleAccess(permissions, moduleKey)) redirect("/access-denied");
  if (permissions.isAdmin) return permissions;

  const permissionSet = await getEmployeePermissionSet(permissions.email ?? "");
  const hasAnyConfiguredEntryForModule = moduleKey in permissionSet;

  if (!hasAnyConfiguredEntryForModule) {
    // Not yet configured for this person/module — fall back to the
    // existing coarse gate, which already passed above.
    return permissions;
  }

  if (!hasPermissionAction(permissionSet, moduleKey, action)) {
    redirect("/access-denied");
  }
  return permissions;
}

/**
 * Same logic as requirePermissionAction, but returns a boolean instead
 * of redirecting — for UI code that wants to conditionally show/hide a
 * button rather than block an entire page.
 */
export async function checkPermissionAction(
  permissions: UserPermissions, moduleKey: RbacModuleKey, action: PermissionAction
): Promise<boolean> {
  if (!hasModuleAccess(permissions, moduleKey)) return false;
  if (permissions.isAdmin) return true;

  const permissionSet = await getEmployeePermissionSet(permissions.email ?? "");
  if (!(moduleKey in permissionSet)) return true; // not yet configured — falls back to allow, same as above
  return hasPermissionAction(permissionSet, moduleKey, action);
}
