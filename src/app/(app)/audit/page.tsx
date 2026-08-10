import { requireModuleAccess } from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/data";
import { AuditView } from "./audit-view";

export default async function AuditPage() {
  await requireModuleAccess("audit");

  let entries: Awaited<ReturnType<typeof fetchEntries>> = [];
  let signIns = 0, permissionChanges = 0, documentViews = 0;

  if (isSupabaseConfigured) {
    entries = await fetchEntries();
    const supabase = createServiceClient();
    const [{ count: signInCount }, { count: permCount }, { count: viewCount }] = await Promise.all([
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).eq("action", "sign_in"),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).in("action", ["role_changed", "team_member_modules_changed", "team_member_added", "team_member_removed"]),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).eq("action", "document_previewed"),
    ]);
    signIns = signInCount ?? 0;
    permissionChanges = permCount ?? 0;
    documentViews = viewCount ?? 0;
  }

  return <AuditView entries={entries} roleCounts={{ signIns, permissionChanges, documentViews }} />;
}

async function fetchEntries() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}
