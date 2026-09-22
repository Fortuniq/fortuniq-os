import { requirePermissionAction } from "@/lib/rbac";
import { getAllMarketNewsForAdmin } from "@/lib/market-news-data";
import { MarketNewsAdminView } from "./market-news-admin-view";

export default async function MarketNewsAdminPage() {
  await requirePermissionAction("market-news", "Manage");
  const articles = await getAllMarketNewsForAdmin();
  return <MarketNewsAdminView articles={articles} />;
}
