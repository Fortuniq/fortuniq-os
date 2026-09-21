import { createServiceClient } from "@/lib/supabase/service";
import type { RawLayoutEntry } from "@/lib/dashboard-widgets";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Fetches a person's raw saved dashboard layout (or null if they've
 * never customized anything). Deliberately returns the RAW, unsanitized
 * jsonb array — sanitation happens in one place only, via
 * mergeDashboardLayout() in dashboard-widgets.ts, called by the
 * dashboard page with that request's actual `availableKeys`. This
 * function never fails open into a fabricated layout on error; it
 * returns null, which mergeDashboardLayout() treats identically to "no
 * saved layout" (i.e. falls back to sensible registry defaults).
 */
export async function getDashboardLayout(employeeEmail: string | null | undefined): Promise<RawLayoutEntry[] | null> {
  if (!supabaseConfigured || !employeeEmail) return null;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("dashboard_layouts")
      .select("layout")
      .eq("employee_email", employeeEmail.toLowerCase())
      .maybeSingle();
    if (error || !data) return null;
    return Array.isArray(data.layout) ? (data.layout as RawLayoutEntry[]) : null;
  } catch {
    return null;
  }
}
