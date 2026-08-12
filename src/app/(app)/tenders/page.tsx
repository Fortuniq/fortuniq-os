import { getTenders, getTenderChecklist } from "@/lib/data";
import { requireModuleAccess, getCurrentUserPermissions } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { TendersView } from "./tenders-view";

export default async function TendersPage() {
  await requireModuleAccess("tenders");
  const permissions = await getCurrentUserPermissions();
  const [tenders, checklist, canCreate] = await Promise.all([
    getTenders(),
    getTenderChecklist(),
    checkPermissionAction(permissions, "tenders", "Create"),
  ]);
  // Real, granular check — someone with Tenders View-only access (e.g.
  // a Sales Representative under RBAC) genuinely doesn't see the
  // Add/Edit/Delete controls, not just a cosmetic hide. See docs/RBAC.md.
  return <TendersView tenders={tenders} checklist={checklist} canManage={canCreate} />;
}
