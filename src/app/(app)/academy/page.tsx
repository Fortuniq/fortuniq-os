import { getSchools } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { AcademyView } from "./academy-view";

export default async function AcademyPage() {
  const permissions = await requireModuleAccess("academy");
  const [schools, canManage] = await Promise.all([
    getSchools(permissions.email),
    checkPermissionAction(permissions, "academy", "Manage"),
  ]);
  return <AcademyView schools={schools} isAdmin={canManage} />;
}
