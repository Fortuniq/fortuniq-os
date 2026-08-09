import { auth } from "@/auth";
import { createServiceClient } from "@/lib/supabase/service";

export type ModuleKey =
  | "dashboard" | "people" | "academy" | "documents" | "tenders"
  | "finance" | "operations" | "customers" | "sales" | "reports"
  | "ai" | "settings";

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
];

const ALL_MODULE_KEYS = ALL_MODULES.map((m) => m.key);

export type UserPermissions = {
  status: "signed-out" | "pending-approval" | "active" | "no-database";
  email?: string;
  name?: string;
  isAdmin: boolean;
  allowedModules: ModuleKey[];
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
 *   automatically becomes the first Admin (bootstrap)
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
    return { status: "no-database", email, name, isAdmin: true, allowedModules: ALL_MODULE_KEYS };
  }

  try {
    const supabase = createServiceClient();

    const { data: existing } = await supabase
      .from("user_permissions")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return {
        status: "active",
        email,
        name: existing.name ?? name,
        isAdmin: existing.is_admin,
        allowedModules: existing.is_admin ? ALL_MODULE_KEYS : (existing.allowed_modules ?? []),
      };
    }

    // No record for this person yet — check if ANYONE exists at all.
    const { count } = await supabase
      .from("user_permissions")
      .select("*", { count: "exact", head: true });

    if (!count || count === 0) {
      // Bootstrap: first person to ever sign in becomes Admin automatically.
      await supabase.from("user_permissions").insert({
        email,
        name,
        is_admin: true,
        allowed_modules: ALL_MODULE_KEYS,
      });
      return { status: "active", email, name, isAdmin: true, allowedModules: ALL_MODULE_KEYS };
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
