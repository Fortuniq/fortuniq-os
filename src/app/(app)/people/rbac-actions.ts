"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { ROLE_TEMPLATE_PERMISSIONS, type RoleTemplateKey, type RbacModuleKey, type PermissionAction } from "@/lib/rbac-core";
import { getEmployeePermissionSet } from "@/lib/rbac";

async function assertCallerIsAdmin() {
  const caller = await getCurrentUserPermissions();
  if (caller.status !== "active" || !caller.isAdmin) {
    throw new Error("Only a Super Admin can manage System Access & Permissions.");
  }
  return caller;
}

/**
 * Applies a named Role Template to an employee — copies the template's
 * whole permission set onto their individual record. This is a one-time
 * copy, not a live link: editing the template afterward (in
 * rbac-core.ts) never retroactively changes anyone it was already
 * applied to.
 */
export async function applyRoleTemplate(employeeEmail: string, template: RoleTemplateKey) {
  const caller = await assertCallerIsAdmin();
  const supabase = createServiceClient();
  const permissionSet = ROLE_TEMPLATE_PERMISSIONS[template];

  // Clear any existing granular permissions for this person first, so
  // applying a template is a clean reset, not a merge with whatever was
  // there before.
  await supabase.from("employee_module_actions").delete().eq("employee_email", employeeEmail.toLowerCase());

  const rows = Object.entries(permissionSet).map(([moduleKey, actions]) => ({
    employee_email: employeeEmail.toLowerCase(),
    module_key: moduleKey,
    actions,
    role_template: template,
    updated_by: caller.email,
  }));
  if (rows.length > 0) {
    await supabase.from("employee_module_actions").insert(rows);
  }

  await logAudit({
    actorEmail: caller.email!, actorName: caller.name, action: "role_changed",
    targetType: "employee_rbac", targetId: employeeEmail, targetLabel: employeeEmail,
    metadata: { field: "role_template_applied", template },
  });

  revalidatePath(`/people`);
}

/**
 * Sets one module's exact action list for an employee — used for
 * fine-tuning after a template's been applied, or configuring a module
 * individually without using a template at all.
 */
export async function updateModulePermissions(employeeEmail: string, moduleKey: RbacModuleKey, actions: PermissionAction[]) {
  const caller = await assertCallerIsAdmin();
  const supabase = createServiceClient();

  if (actions.length === 0) {
    // "No Access" — remove the row entirely rather than storing an empty
    // array, so this module now genuinely has zero configured actions.
    await supabase.from("employee_module_actions").delete().eq("employee_email", employeeEmail.toLowerCase()).eq("module_key", moduleKey);
  } else {
    await supabase.from("employee_module_actions").upsert({
      employee_email: employeeEmail.toLowerCase(),
      module_key: moduleKey,
      actions,
      role_template: null, // manually customised — no longer attributed to a template
      updated_by: caller.email,
      updated_at: new Date().toISOString(),
    }, { onConflict: "employee_email,module_key" });
  }

  await logAudit({
    actorEmail: caller.email!, actorName: caller.name, action: "team_member_modules_changed",
    targetType: "employee_rbac", targetId: employeeEmail, targetLabel: employeeEmail,
    metadata: { field: "module_permissions_changed", module: moduleKey, actions },
  });

  revalidatePath(`/people`);
}

export async function fetchEmployeePermissionSet(employeeEmail: string) {
  await assertCallerIsAdmin();
  return getEmployeePermissionSet(employeeEmail);
}
