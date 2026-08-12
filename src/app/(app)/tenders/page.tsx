import { getTenders, getTenderChecklist } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { TendersView } from "./tenders-view";

export default async function TendersPage() {
  await requireModuleAccess("tenders");
  const [tenders, checklist] = await Promise.all([getTenders(), getTenderChecklist()]);
  // Anyone who can reach this page (i.e. has Tenders module access at
  // all) can add/edit/delete tenders — the same rule the server actions
  // themselves enforce. There's no separate, stricter admin gate here,
  // unlike Employee Hub's restricted fields.
  return <TendersView tenders={tenders} checklist={checklist} canManage={true} />;
}
