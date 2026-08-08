import { getTenders, getTenderChecklist } from "@/lib/data";
import { TendersView } from "./tenders-view";

export default async function TendersPage() {
  const [tenders, checklist] = await Promise.all([getTenders(), getTenderChecklist()]);
  return <TendersView tenders={tenders} checklist={checklist} />;
}
