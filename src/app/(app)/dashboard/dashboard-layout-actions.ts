"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requireModuleAccess } from "@/lib/permissions";
import { isNextRedirectError } from "@/lib/rbac";
import { getPersonalisedDashboardData } from "@/lib/data";
import { sanitizeDashboardLayoutForSave, type DashboardWidgetLayoutEntry } from "@/lib/dashboard-widgets";

/**
 * Saves the signed-in person's OWN dashboard widget layout — never
 * anyone else's (there's no employeeEmail parameter; it's always
 * derived from the session). Deliberately gated by requireModuleAccess
 * ("dashboard") rather than a granular RBAC action: customizing your
 * own personal widget arrangement isn't "editing the dashboard" in the
 * sense the Edit/Manage RBAC actions mean elsewhere (admin-level
 * control over shared content) — anyone who can see the dashboard at
 * all can rearrange their own view of it.
 *
 * The proposed layout is NEVER trusted as-is, even though it's the
 * person's own data: availableWidgetKeys is recomputed fresh, server
 * -side, via the same getPersonalisedDashboardData() the page itself
 * uses — so a stale client (an old tab open from before a role change,
 * or before they lost access to a module) can't smuggle in a widget key
 * that isn't legitimately available to them right now. See
 * sanitizeDashboardLayoutForSave() / mergeDashboardLayout() in
 * dashboard-widgets.ts for the actual sanitation rules.
 */
export async function saveDashboardLayout(layout: DashboardWidgetLayoutEntry[]): Promise<{ error?: string }> {
  try {
    const permissions = await requireModuleAccess("dashboard");
    if (!permissions.email) return { error: "Couldn't determine your account email." };

    const { availableWidgetKeys } = await getPersonalisedDashboardData(permissions);
    const sanitized = sanitizeDashboardLayoutForSave(availableWidgetKeys, layout);

    const supabase = createServiceClient();
    const { error } = await supabase.from("dashboard_layouts").upsert(
      { employee_email: permissions.email.toLowerCase(), layout: sanitized, updated_at: new Date().toISOString() },
      { onConflict: "employee_email" }
    );
    if (error) {
      console.error("Failed to save dashboard layout:", error);
      return { error: "Couldn't save your dashboard layout. Please try again." };
    }

    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: err instanceof Error ? err.message : "Couldn't save your dashboard layout." };
  }
}

/** Resets the signed-in person's own dashboard layout back to registry defaults by deleting their saved row entirely (not writing default values — deleting means a FUTURE new widget appears automatically too, exactly like a first-time user, rather than being frozen out by a saved-but-default-valued row). */
export async function resetDashboardLayout(): Promise<{ error?: string }> {
  try {
    const permissions = await requireModuleAccess("dashboard");
    if (!permissions.email) return { error: "Couldn't determine your account email." };

    const supabase = createServiceClient();
    const { error } = await supabase.from("dashboard_layouts").delete().eq("employee_email", permissions.email.toLowerCase());
    if (error) {
      console.error("Failed to reset dashboard layout:", error);
      return { error: "Couldn't reset your dashboard layout. Please try again." };
    }

    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: err instanceof Error ? err.message : "Couldn't reset your dashboard layout." };
  }
}
