import { getEmployeeDirectory } from "@/lib/data";
import { requireModuleAccess, getCurrentUserPermissions } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { PeopleView } from "./people-view";

export default async function PeoplePage() {
  await requireModuleAccess("people");
  const permissions = await getCurrentUserPermissions();
  const [employees, canAdd] = await Promise.all([
    getEmployeeDirectory(),
    checkPermissionAction(permissions, "people", "Create"),
  ]);
  return <PeopleView employees={employees} isAdmin={canAdd} />;
}
