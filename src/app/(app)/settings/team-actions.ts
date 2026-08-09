"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentUserPermissions, ALL_MODULES, type ModuleKey } from "@/lib/permissions";

async function assertCallerIsAdmin() {
  const caller = await getCurrentUserPermissions();
  if (caller.status !== "active" || !caller.isAdmin) {
    throw new Error("Only an administrator can do this.");
  }
  return caller;
}

export async function addTeamMember(formData: FormData) {
  await assertCallerIsAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!email) throw new Error("An email address is required.");

  const supabase = createServiceClient();
  await supabase.from("user_permissions").insert({
    email,
    name: name || email,
    is_admin: false,
    allowed_modules: ["dashboard", "settings"],
  });

  revalidatePath("/settings");
}

export async function updateTeamMemberModules(email: string, allowedModules: ModuleKey[]) {
  await assertCallerIsAdmin();
  const supabase = createServiceClient();
  await supabase
    .from("user_permissions")
    .update({ allowed_modules: allowedModules, updated_at: new Date().toISOString() })
    .eq("email", email);
  revalidatePath("/settings");
}

export async function setTeamMemberAdmin(email: string, isAdmin: boolean) {
  const caller = await assertCallerIsAdmin();
  if (caller.email === email && !isAdmin) {
    throw new Error("You can't remove your own admin access.");
  }
  const supabase = createServiceClient();
  const updates: Record<string, unknown> = { is_admin: isAdmin, updated_at: new Date().toISOString() };
  if (isAdmin) updates.allowed_modules = ALL_MODULES.map((m) => m.key);
  await supabase.from("user_permissions").update(updates).eq("email", email);
  revalidatePath("/settings");
}

export async function removeTeamMember(email: string) {
  const caller = await assertCallerIsAdmin();
  if (caller.email === email) {
    throw new Error("You can't remove yourself.");
  }
  const supabase = createServiceClient();
  await supabase.from("user_permissions").delete().eq("email", email);
  revalidatePath("/settings");
}
