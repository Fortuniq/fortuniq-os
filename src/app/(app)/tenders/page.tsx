import { getTenders, getTenderChecklist } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { TendersView } from "./tenders-view";

export default async function TendersPage() {
  await requireModuleAccess("tenders");
  const [tenders, checklist] = await Promise.all([getTenders(), getTenderChecklist()]);
  return <TendersView tenders={tenders} checklist={checklist} />;
}
