import { requireModuleAccess } from "@/lib/permissions";
import { AIView } from "./ai-view";

export default async function AIPage() {
  await requireModuleAccess("ai");
  return <AIView />;
}
