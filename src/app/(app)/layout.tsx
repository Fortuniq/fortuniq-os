import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { auth } from "@/auth";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { getEmployeePermissionSet } from "@/lib/rbac";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const permissions = await getCurrentUserPermissions();

  if (permissions.status === "pending-approval") {
    redirect("/auth/pending");
  }

  // Fetched here, server-side, so the sidebar can also hide a module a
  // person has been granularly denied View on — separate from, and in
  // addition to, the coarser module-level gate already enforced
  // everywhere. See docs/RBAC.md.
  const permissionSet = permissions.email ? await getEmployeePermissionSet(permissions.email) : {};

  return (
    <AppShell user={session?.user} permissions={permissions} permissionSet={permissionSet}>
      {children}
    </AppShell>
  );
}
