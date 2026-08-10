"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentUserPermissions, ROLE_DEFAULT_MODULES, type ModuleKey, type RoleKey } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

async function assertCallerIsAdmin() {
  const caller = await getCurrentUserPermissions();
  if (caller.status !== "active" || !caller.isAdmin) {
    throw new Error("Only a Super Admin can do this.");
  }
  return caller;
}

export async function addTeamMember(formData: FormData) {
  const caller = await assertCallerIsAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!email) throw new Error("An email address is required.");

  const role: RoleKey = "Employee"; // safest default — an Admin upgrades from here
  const supabase = createServiceClient();
  await supabase.from("user_permissions").insert({
    email,
    name: name || email,
    role,
    is_admin: false,
    allowed_modules: ROLE_DEFAULT_MODULES[role],
  });

  await logAudit({
    actorEmail: caller.email!,
    actorName: caller.name,
    action: "team_member_added",
    targetType: "user",
    targetId: email,
    targetLabel: name || email,
    metadata: { role },
  });

  revalidatePath("/settings");
}

export async function updateTeamMemberModules(email: string, allowedModules: ModuleKey[]) {
  const caller = await assertCallerIsAdmin();
  const supabase = createServiceClient();

  const { data: before } = await supabase.from("user_permissions").select("allowed_modules").eq("email", email).maybeSingle();

  await supabase
    .from("user_permissions")
    .update({ allowed_modules: allowedModules, updated_at: new Date().toISOString() })
    .eq("email", email);

  await logAudit({
    actorEmail: caller.email!,
    actorName: caller.name,
    action: "team_member_modules_changed",
    targetType: "user",
    targetId: email,
    targetLabel: email,
    metadata: { before: before?.allowed_modules ?? [], after: allowedModules },
  });

  revalidatePath("/settings");
}

/**
 * Assigns a named role to someone, which resets their modules to that
 * role's documented defaults (see docs/ROLES_AND_PERMISSIONS.md). An
 * Admin can still fine-tune individual modules afterwards via
 * updateTeamMemberModules — this just sets the sensible starting point
 * and records, for audit purposes, that a deliberate role change happened.
 */
export async function setTeamMemberRole(email: string, role: RoleKey) {
  const caller = await assertCallerIsAdmin();
  if (caller.email === email && role !== "Super Admin") {
    throw new Error("You can't remove your own Super Admin access.");
  }

  const supabase = createServiceClient();
  const { data: before } = await supabase.from("user_permissions").select("role").eq("email", email).maybeSingle();

  await supabase
    .from("user_permissions")
    .update({
      role,
      is_admin: role === "Super Admin",
      allowed_modules: ROLE_DEFAULT_MODULES[role],
      updated_at: new Date().toISOString(),
    })
    .eq("email", email);

  await logAudit({
    actorEmail: caller.email!,
    actorName: caller.name,
    action: "role_changed",
    targetType: "user",
    targetId: email,
    targetLabel: email,
    metadata: { before: before?.role ?? null, after: role },
  });

  revalidatePath("/settings");
}

export async function removeTeamMember(email: string) {
  const caller = await assertCallerIsAdmin();
  if (caller.email === email) {
    throw new Error("You can't remove yourself.");
  }
  const supabase = createServiceClient();
  await supabase.from("user_permissions").delete().eq("email", email);

  await logAudit({
    actorEmail: caller.email!,
    actorName: caller.name,
    action: "team_member_removed",
    targetType: "user",
    targetId: email,
    targetLabel: email,
  });

  revalidatePath("/settings");
}
