import { getPersonalisedDashboardData } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage() {
  const permissions = await requireModuleAccess("dashboard");
  const data = await getPersonalisedDashboardData(permissions);
  return <DashboardView {...data} />;
}
