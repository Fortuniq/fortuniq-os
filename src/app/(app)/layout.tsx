import { AppShell } from "@/components/layout/AppShell";
import { auth } from "@/auth";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return <AppShell user={session?.user}>{children}</AppShell>;
}
