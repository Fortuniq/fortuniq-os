import { auth } from "@/auth";
import { isSupabaseConfigured } from "@/lib/data";
import { requireModuleAccess, getCurrentUserPermissions, type ModuleKey, type RoleKey } from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  await requireModuleAccess("settings");
  const session = await auth();
  const permissions = await getCurrentUserPermissions();
  const aiConfigured = !!process.env.ANTHROPIC_API_KEY;

  let teamMembers: { email: string; name: string | null; is_admin: boolean; role: RoleKey | null; allowed_modules: ModuleKey[] }[] = [];
  if (permissions.isAdmin && isSupabaseConfigured) {
    const supabase = createServiceClient();
    const { data } = await supabase.from("user_permissions").select("*").order("created_at");
    teamMembers = (data ?? []).map((row) => ({
      email: row.email,
      name: row.name,
      is_admin: row.is_admin,
      role: (row.role ?? null) as RoleKey | null,
      allowed_modules: (row.allowed_modules ?? []) as ModuleKey[],
    }));
  }

  return (
    <SettingsView
      user={session?.user}
      supabaseConfigured={isSupabaseConfigured}
      aiConfigured={aiConfigured}
      permissions={permissions}
      teamMembers={teamMembers}
    />
  );
}
