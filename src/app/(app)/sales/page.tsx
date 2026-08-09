import { getQuotes, getPipeline } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { SalesView } from "./sales-view";

export default async function SalesPage() {
  await requireModuleAccess("sales");
  const [quotes, pipeline] = await Promise.all([getQuotes(), getPipeline()]);
  return <SalesView quotes={quotes} pipeline={pipeline} />;
}
