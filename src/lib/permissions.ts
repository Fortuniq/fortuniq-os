import { auth } from "@/auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  ALL_MODULES,
  ALL_MODULE_KEYS,
  ALL_ROLES,
  ROLE_DEFAULT_MODULES,
  hasModuleAccess,
  type ModuleKey,
  type RoleKey,
  type UserPermissions,
} from "@/lib/permissions-core";

// Re-export the pure, testable core so existing imports of "@/lib/permissions"
// throughout the app keep working unchanged.
export {
  ALL_MODULES,
  ALL_ROLES,
  ROLE_DEFAULT_MODULES,
  hasModuleAccess,
  type ModuleKey,
  type RoleKey,
  type UserPermissions,
};

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Works out what the currently signed-in person can see.
 *
 * - Not signed in -> "signed-out"
 * - No database connected yet -> "no-database" (everyone sees everything,
 *   since there's nowhere to store permissions yet — this only applies
 *   during initial setup)
 * - Signed in, but nobody has been set up as a user yet -> this person
 *   automatically becomes the first Super Admin (bootstrap)
 * - Signed in, permissions table has people, but not this person ->
 *   "pending-approval" (an Admin needs to add them)
 * - Signed in and provisioned -> "active", with their real permissions
 */
export async function getCurrentUserPermissions(): Promise<UserPermissions> {
  const session = await auth();
  if (!session?.user?.email) {
    return { isAdmin: false, allowedModules: [], status: "signed-out" };
  }

  const email = session.user.email.toLowerCase();
  const name = session.user.name ?? email;

  if (!supabaseConfigured) {
    return { status: "no-database", email, name, role: "Super Admin", isAdmin: true, allowedModules: ALL_MODULE_KEYS };
  }

  try {
    const supabase = createServiceClient();

    const { data: existing } = await supabase
      .from("user_permissions")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      const role = (existing.role as RoleKey) ?? (existing.is_admin ? "Super Admin" : "Employee");
      return {
        status: "active",
        email,
        name: existing.name ?? name,
        role,
        isAdmin: role === "Super Admin",
        allowedModules: role === "Super Admin" ? ALL_MODULE_KEYS : (existing.allowed_modules ?? []),
      };
    }

    // No record for this person yet — check if ANYONE exists at all.
    const { count } = await supabase
      .from("user_permissions")
      .select("*", { count: "exact", head: true });

    if (!count || count === 0) {
      // Bootstrap: first person to ever sign in becomes Super Admin automatically.
      await supabase.from("user_permissions").insert({
        email,
        name,
        role: "Super Admin",
        is_admin: true,
        allowed_modules: ALL_MODULE_KEYS,
      });
      return { status: "active", email, name, role: "Super Admin", isAdmin: true, allowedModules: ALL_MODULE_KEYS };
    }

    // Other people already exist, but not this person — they need an Admin
    // to add them.
    return { status: "pending-approval", email, name, isAdmin: false, allowedModules: [] };
  } catch {
    // If anything goes wrong reading permissions, fail safe: no access
    // rather than accidentally granting everything.
    return { status: "pending-approval", email, name, isAdmin: false, allowedModules: [] };
  }
}

export const isSupabaseConfiguredForPermissions = supabaseConfigured;

/**
 * Call this at the top of any module's page.tsx to enforce access.
 * Redirects to sign-in, the pending-approval screen, or an access-denied
 * page as appropriate — otherwise returns the user's permissions so the
 * page can use them if needed.
 */
export async function requireModuleAccess(moduleKey: ModuleKey): Promise<UserPermissions> {
  const { redirect } = await import("next/navigation");
  const permissions = await getCurrentUserPermissions();

  if (permissions.status === "signed-out") {
    redirect("/auth/signin");
  }
  if (permissions.status === "pending-approval") {
    redirect("/auth/pending");
  }
  if (!hasModuleAccess(permissions, moduleKey)) {
    redirect("/access-denied");
  }
  return permissions;
}
