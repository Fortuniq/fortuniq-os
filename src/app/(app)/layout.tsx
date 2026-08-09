import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { auth } from "@/auth";
import { getCurrentUserPermissions } from "@/lib/permissions";

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

  return (
    <AppShell user={session?.user} permissions={permissions}>
      {children}
    </AppShell>
  );
}
