import { getDashboardData } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage() {
  const permissions = await requireModuleAccess("dashboard");
  const data = await getDashboardData();
  const firstName = permissions.name?.split(" ")[0] ?? "there";
  return <DashboardView {...data} firstName={firstName} />;
}
