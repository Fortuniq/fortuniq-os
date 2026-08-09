import { getRevenueByProduct, getPipeline, getCustomers } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { ReportsView } from "./reports-view";

export default async function ReportsPage() {
  await requireModuleAccess("reports");
  const [revenueByProduct, pipeline, customers] = await Promise.all([
    getRevenueByProduct(),
    getPipeline(),
    getCustomers(),
  ]);
  return <ReportsView revenueByProduct={revenueByProduct} pipeline={pipeline} customers={customers} />;
}
